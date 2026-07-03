/**
 * Keep jobs.positions_filled in sync with hired applications for a job.
 */
async function syncJobPositions(db, jobId, options = {}) {
  const { autoCloseWhenFull = true, autoReopenWhenOpen = false } = options;

  const hiredResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM applications
     WHERE job_id = $1 AND LOWER(status) = 'hired'`,
    [jobId]
  );
  const positionsFilled = hiredResult.rows[0]?.count || 0;

  const jobResult = await db.query(
    `SELECT positions_available, status FROM jobs WHERE id = $1`,
    [jobId]
  );
  if (jobResult.rows.length === 0) return null;

  const positionsAvailable = Math.max(1, Number(jobResult.rows[0].positions_available) || 1);
  let status = jobResult.rows[0].status || 'draft';
  const remaining = Math.max(0, positionsAvailable - positionsFilled);

  if (autoCloseWhenFull && remaining === 0 && status === 'active') {
    status = 'closed';
  }

  if (autoReopenWhenOpen && remaining > 0 && status === 'closed') {
    status = 'active';
  }

  await db.query(
    `UPDATE jobs
     SET positions_filled = $1,
         positions_available = $2,
         status = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [positionsFilled, positionsAvailable, status, jobId]
  );

  return {
    positions_available: positionsAvailable,
    positions_filled: positionsFilled,
    remaining,
    status,
    is_full: remaining === 0,
  };
}

module.exports = { syncJobPositions };

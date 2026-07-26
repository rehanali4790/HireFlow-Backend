const { verifyAuthToken } = require('./auth-token');

function isPlatformWide(req) {
  return Boolean(req.isSuperAdmin && !req.employerId);
}

/**
 * Add tenant employer filter to a query builder.
 * Super admin without selected tenant reads across all companies.
 */
function applyEmployerScope(req, params, where, {
  tableAlias = 'j',
  column = 'employer_id',
} = {}) {
  if (isPlatformWide(req)) {
    return {
      ok: true,
      platformWide: true,
      employerRef: `${tableAlias}.${column}`,
    };
  }

  if (!req.employerId) {
    return { ok: false, status: 400, error: 'Company context required' };
  }

  params.push(req.employerId);
  const idx = params.length;
  where.push(`${tableAlias}.${column} = $${idx}`);
  return {
    ok: true,
    platformWide: false,
    employerRef: `$${idx}`,
  };
}

function buildWhereClause(whereParts) {
  return whereParts.length > 0 ? whereParts.join(' AND ') : 'TRUE';
}

/**
 * Resolve employer for application-scoped actions.
 * - Company user / SA with X-Tenant-Id → req.employerId
 * - SA platform-wide → employer from application's job
 */
async function resolveEmployerIdForApplication(db, req, applicationId) {
  if (req.employerId) return req.employerId;
  if (!req.isSuperAdmin || !applicationId) return null;

  const result = await db.query(
    `SELECT j.employer_id
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.id = $1
     LIMIT 1`,
    [applicationId]
  );
  return result.rows[0]?.employer_id || null;
}

/**
 * Resolve employer for job-scoped actions (e.g. bulk upload).
 * - Company user / SA with X-Tenant-Id → req.employerId
 * - SA platform-wide → employer from job row
 */
async function resolveEmployerIdForJob(db, req, jobId) {
  if (req.employerId) return req.employerId;
  if (!req.isSuperAdmin || !jobId) return null;

  const result = await db.query(
    `SELECT employer_id FROM jobs WHERE id = $1 LIMIT 1`,
    [jobId]
  );
  return result.rows[0]?.employer_id || null;
}

/** Optional auth for public routes (e.g. GET /jobs). */
function resolveOptionalAuth(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { isSuperAdmin: false, employerId: null };
  }

  try {
    const payload = verifyAuthToken(token);
    if (payload.userType === 'super_admin') {
      const tenantId = req.headers['x-tenant-id'] || req.headers['x-employer-id'] || null;
      const employerId = tenantId && tenantId !== 'super-admin' ? tenantId : null;
      return { isSuperAdmin: true, employerId };
    }

    return {
      isSuperAdmin: false,
      employerId: payload.employerId || null,
      userType: payload.userType || null,
    };
  } catch {
    return { isSuperAdmin: false, employerId: null };
  }
}

module.exports = {
  isPlatformWide,
  applyEmployerScope,
  buildWhereClause,
  resolveOptionalAuth,
  resolveEmployerIdForApplication,
  resolveEmployerIdForJob,
};

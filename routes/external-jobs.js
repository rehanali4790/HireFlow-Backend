const express = require('express');
const basicAuthExternal = require('../middleware/basic-auth-external');

const router = express.Router();

const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 100;

const JOB_STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  closed: 'Closed',
};

function getJobStatusLabel(status) {
  const key = String(status || '').toLowerCase();
  return JOB_STATUS_LABELS[key] || key || 'Unknown';
}

function getAppBaseUrl() {
  const base = String(process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  return base.replace(/\/+$/, '');
}

function mapExternalJob(row) {
  const jobStatus = String(row.status || '').toLowerCase();
  return {
    id: row.id,
    job_title: row.title,
    job_description: row.description,
    requirements: row.requirements || null,
    responsibilities: row.responsibilities || null,
    required_skills: Array.isArray(row.skills_required) ? row.skills_required : [],
    location: row.location || null,
    work_type: row.work_type || null,
    remote_policy: row.remote_policy || null,
    experience_level: row.experience_level || null,
    department: row.department || null,
    min_salary: row.salary_min != null ? Number(row.salary_min) : null,
    max_salary: row.salary_max != null ? Number(row.salary_max) : null,
    currency: row.salary_currency || null,
    apply_link: `${getAppBaseUrl()}/apply/${row.id}`,
    job_status: jobStatus,
    job_status_label: getJobStatusLabel(jobStatus),
    status: jobStatus,
    created_at: row.created_at,
  };
}

async function getFilterOptions(db, employerId) {
  const [locationsResult, departmentsResult, jobTypesResult] = await Promise.all([
    db.query(
      `SELECT name FROM (
         SELECT name FROM job_locations WHERE employer_id = $1
         UNION
         SELECT btrim(location) AS name FROM jobs
         WHERE employer_id = $1 AND location IS NOT NULL AND btrim(location) <> ''
       ) locs
       ORDER BY lower(name) ASC`,
      [employerId]
    ),
    db.query(
      `SELECT name FROM (
         SELECT name FROM job_departments WHERE employer_id = $1
         UNION
         SELECT btrim(department) AS name FROM jobs
         WHERE employer_id = $1 AND department IS NOT NULL AND btrim(department) <> ''
       ) depts
       ORDER BY lower(name) ASC`,
      [employerId]
    ),
    db.query(
      `SELECT name FROM (
         SELECT DISTINCT btrim(work_type) AS name
         FROM jobs
         WHERE employer_id = $1
           AND work_type IS NOT NULL
           AND btrim(work_type) <> ''
       ) types
       ORDER BY lower(name) ASC`,
      [employerId]
    ),
  ]);

  return {
    locations: locationsResult.rows.map((row) => row.name),
    departments: departmentsResult.rows.map((row) => row.name),
    job_types: jobTypesResult.rows.map((row) => row.name),
  };
}

function parseLimit(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (String(raw).toLowerCase() === 'all') return null;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(MAX_PAGE_LIMIT, parsed);
}

/**
 * Single external jobs API for company career websites.
 *
 * - Returns only active jobs + filter_options
 * - q / location / department / job_type → filtered active jobs
 * - page & limit → optional pagination (e.g. limit=10&page=1)
 */
router.get('/', basicAuthExternal, async (req, res) => {
  const db = req.app.locals.db;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = parseLimit(req.query.limit);
  const offset = limit ? (page - 1) * limit : 0;

  const q = String(req.query.q || req.query.title || '').trim();
  const location = String(req.query.location || '').trim();
  const department = String(req.query.department || '').trim();
  const jobType = String(req.query.job_type || req.query.work_type || '').trim();

  try {
    // Ensure organization metadata is complete (esp. legacy env auth)
    if (!req.externalOrganization?.name && req.employerId) {
      const orgResult = await db.query(
        `SELECT id, company_name, external_api_slug
         FROM employers WHERE id = $1`,
        [req.employerId]
      );
      if (orgResult.rows[0]) {
        req.externalOrganization = {
          id: orgResult.rows[0].id,
          name: orgResult.rows[0].company_name,
          slug: orgResult.rows[0].external_api_slug || req.externalOrganization?.slug || null,
        };
      }
    }

    const filterOptions = await getFilterOptions(db, req.employerId);

    const params = [req.employerId];
    const where = ['j.employer_id = $1', "lower(j.status) = 'active'"];

    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(`lower(j.title) LIKE $${params.length}`);
    }

    if (location) {
      params.push(location);
      where.push(`lower(btrim(j.location)) = lower(btrim($${params.length}))`);
    }

    if (department) {
      params.push(department);
      where.push(`lower(btrim(j.department)) = lower(btrim($${params.length}))`);
    }

    if (jobType) {
      params.push(jobType);
      where.push(`lower(btrim(j.work_type)) = lower(btrim($${params.length}))`);
    }

    const whereClause = where.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM jobs j WHERE ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    const listParams = [...params];
    let listSql = `
      SELECT j.id, j.title, j.description, j.requirements, j.responsibilities,
             j.skills_required, j.location, j.work_type, j.remote_policy,
             j.experience_level, j.department, j.salary_min, j.salary_max,
             j.salary_currency, j.status, j.created_at
      FROM jobs j
      WHERE ${whereClause}
      ORDER BY j.created_at DESC`;

    if (limit) {
      listParams.push(limit, offset);
      listSql += ` LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`;
    }

    const listResult = await db.query(listSql, listParams);
    const effectiveLimit = limit || total || 0;
    const totalPages = limit ? Math.max(1, Math.ceil(total / limit)) : 1;

    res.json({
      organization: req.externalOrganization || {
        id: req.employerId,
        name: null,
        slug: null,
      },
      filter_options: filterOptions,
      jobs: listResult.rows.map(mapExternalJob),
      pagination: {
        page: limit ? page : 1,
        limit: effectiveLimit,
        total,
        total_pages: totalPages,
        has_next: limit ? page < totalPages : false,
        has_prev: limit ? page > 1 : false,
        paginated: Boolean(limit),
      },
      filters_applied: {
        q: q || null,
        location: location || null,
        department: department || null,
        job_type: jobType || null,
        job_status: 'active',
      },
    });
  } catch (error) {
    console.error('External jobs list error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

module.exports = router;

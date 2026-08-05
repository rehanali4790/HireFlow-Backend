/**
 * Basic Auth for external job feed integrations.
 *
 * Primary: per-organization credentials stored on employers
 * Fallback: legacy EXTERNAL_API_* env vars (single tenant) — optional
 */
const bcrypt = require('bcryptjs');

function unauthorized(res, message = 'Invalid credentials') {
  res.set('WWW-Authenticate', 'Basic realm="HireFlow External API"');
  return res.status(401).json({ error: message });
}

async function resolveEmployerFromDb(db, username, password) {
  const result = await db.query(
    `SELECT id, company_name, external_api_slug, external_api_password_hash, external_api_enabled
     FROM employers
     WHERE lower(external_api_username) = lower($1)
       AND company_name <> '__HireFlow Platform Templates__'
     LIMIT 1`,
    [username]
  );

  if (result.rows.length === 0) return null;

  const employer = result.rows[0];
  if (!employer.external_api_enabled) {
    return { error: 'External API is disabled for this organization' };
  }
  if (!employer.external_api_password_hash) {
    return { error: 'External API credentials are not configured for this organization' };
  }

  const valid = await bcrypt.compare(password, employer.external_api_password_hash);
  if (!valid) return { error: 'Invalid credentials' };

  return {
    employerId: employer.id,
    companyName: employer.company_name,
    slug: employer.external_api_slug || null,
  };
}

function resolveEmployerFromEnv(username, password) {
  const expectedUser = process.env.EXTERNAL_API_USERNAME;
  const expectedPass = process.env.EXTERNAL_API_PASSWORD;
  const employerId = process.env.EXTERNAL_API_EMPLOYER_ID;

  if (!expectedUser || !expectedPass || !employerId) return null;
  if (username !== expectedUser || password !== expectedPass) return null;

  return {
    employerId,
    companyName: null,
    slug: null,
    legacyEnv: true,
  };
}

async function basicAuthExternal(req, res, next) {
  const authHeader = String(req.headers.authorization || '');

  if (!authHeader.startsWith('Basic ')) {
    return unauthorized(res, 'Basic authentication required');
  }

  let decoded = '';
  try {
    decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  } catch {
    return unauthorized(res, 'Invalid authorization header');
  }

  const separatorIndex = decoded.indexOf(':');
  const username = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded;
  const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';

  if (!username || !password) {
    return unauthorized(res, 'Invalid credentials');
  }

  try {
    const db = req.app.locals.db;
    const fromDb = await resolveEmployerFromDb(db, username, password);

    if (fromDb?.error) {
      return unauthorized(res, fromDb.error);
    }

    if (fromDb?.employerId) {
      req.employerId = fromDb.employerId;
      req.externalOrganization = {
        id: fromDb.employerId,
        name: fromDb.companyName,
        slug: fromDb.slug,
      };
      return next();
    }

    // Careful fallback for existing single-tenant env setup
    const fromEnv = resolveEmployerFromEnv(username, password);
    if (fromEnv?.employerId) {
      req.employerId = fromEnv.employerId;
      req.externalOrganization = {
        id: fromEnv.employerId,
        name: null,
        slug: null,
      };
      return next();
    }

    return unauthorized(res, 'Invalid credentials');
  } catch (error) {
    console.error('External basic auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = basicAuthExternal;

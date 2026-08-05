const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'new_password',
  'confirm_password',
  'token',
  'access_token',
  'refresh_token',
]);

function sanitizeDetails(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeDetails);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((clean, [key, nestedValue]) => {
      clean[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : sanitizeDetails(nestedValue);
      return clean;
    }, {});
  }

  return value;
}

function inferAction(method) {
  if (method === 'POST') return 'create';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  return method.toLowerCase();
}

function inferResourceType(path) {
  const [resource] = path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  return resource || 'unknown';
}

function inferResourceId(req) {
  return req.params?.id || req.params?.applicationId || req.params?.jobId || req.params?.offerId || null;
}

function inferResponseResourceId(body) {
  if (!body || typeof body !== 'object') {
    return null;
  }

  if (body.id) return body.id;
  if (body.application_id) return body.application_id;
  if (body.job_id) return body.job_id;
  if (body.data?.id) return body.data.id;
  return null;
}

async function getActor(db, userId, employerId) {
  if (userId === 'super-admin') {
    try {
      const { getSuperAdminCredentials } = require('../utils/super-admin');
      const creds = getSuperAdminCredentials();
      return {
        actorName: 'Super Admin',
        actorEmail: creds?.email || null,
      };
    } catch {
      return { actorName: 'Super Admin', actorEmail: null };
    }
  }

  if (!userId || !employerId) {
    return { actorName: 'Unknown', actorEmail: null };
  }

  if (userId === employerId) {
    const owner = await db.query(
      'SELECT company_name, contact_email FROM employers WHERE id = $1',
      [employerId]
    );

    if (owner.rows.length > 0) {
      return {
        actorName: owner.rows[0].company_name || owner.rows[0].contact_email || 'Owner',
        actorEmail: owner.rows[0].contact_email || null,
      };
    }
  }

  const user = await db.query(
    'SELECT first_name, last_name, email FROM users WHERE id = $1 AND employer_id = $2',
    [userId, employerId]
  );

  if (user.rows.length > 0) {
    const row = user.rows[0];
    return {
      actorName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email,
      actorEmail: row.email,
    };
  }

  return { actorName: 'Unknown', actorEmail: null };
}

async function logActivity(req, overrides = {}) {
  const db = req.app.locals.db;
  const employerId = overrides.employerId || req.employerId;

  if (!db || !employerId) {
    return;
  }

  try {
    const actor = overrides.actorName || overrides.actorEmail
      ? { actorName: overrides.actorName || 'Unknown', actorEmail: overrides.actorEmail || null }
      : await getActor(db, overrides.userId || req.userId, employerId);
    const actorUserId = overrides.userId || req.userId || null;
    const logUserId = actorUserId && actorUserId !== employerId ? actorUserId : null;
    const action = overrides.action || inferAction(req.method);
    const resourceType = overrides.resourceType || inferResourceType(req.originalUrl || req.path);
    const details = sanitizeDetails(overrides.details || {
      body: req.body || {},
      params: req.params || {},
      query: req.query || {},
    });

    await db.query(
      `INSERT INTO user_activity_log (
        user_id, employer_id, actor_name, actor_email, action, resource_type,
        resource_id, details, request_method, request_path, status_code, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        logUserId,
        employerId,
        actor.actorName,
        actor.actorEmail,
        action,
        resourceType,
        overrides.resourceId || inferResourceId(req),
        JSON.stringify(details),
        req.method,
        req.originalUrl || req.path,
        overrides.statusCode || null,
      ]
    );
  } catch (error) {
    console.log('Activity log skipped:', error.message);
  }
}

function auditLogMiddleware(req, res, next) {
  const method = req.method.toUpperCase();
  const shouldAudit = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const isAuthRoute = (req.originalUrl || '').startsWith('/api/auth/');

  if (!shouldAudit || isAuthRoute) {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.locals.responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    // Never log super admin actions anywhere
    if (req.userType === 'super_admin' || req.isSuperAdmin) {
      return;
    }

    if (res.statusCode >= 400 || !req.employerId || res.locals.auditLogged) {
      return;
    }

    logActivity(req, {
      statusCode: res.statusCode,
      resourceId: inferResourceId(req) || inferResponseResourceId(res.locals.responseBody),
      details: {
        body: req.body || {},
        params: req.params || {},
        query: req.query || {},
        response: res.locals.responseBody || null,
      },
    });
  });

  next();
}

module.exports = {
  auditLogMiddleware,
  logActivity,
  sanitizeDetails,
  getActor,
};

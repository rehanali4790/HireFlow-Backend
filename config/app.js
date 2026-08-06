const { isProduction } = require('./database');

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getAppUrl() {
  const configured = normalizeUrl(process.env.APP_URL || process.env.FRONTEND_URL);

  if (!configured && isProduction()) {
    console.warn('⚠️ APP_URL is not set. Interview/test links in emails may be broken.');
  }

  return configured || 'http://localhost:5173';
}

function getCorsOrigins() {
  const raw = process.env.CORS_ORIGIN || process.env.APP_URL || process.env.FRONTEND_URL || '';
  const origins = raw
    .split(',')
    .map((origin) => normalizeUrl(origin))
    .filter(Boolean);

  if (origins.length === 0 && isProduction()) {
    console.warn('⚠️ CORS_ORIGIN is not set. Browser requests from your frontend may be blocked.');
  }

  return origins;
}

module.exports = {
  getAppUrl,
  getCorsOrigins,
  normalizeUrl,
};

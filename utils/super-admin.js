/**
 * Super admin credentials live ONLY in environment variables — never in the database.
 */

function getSuperAdminCredentials() {
  const email = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SUPER_ADMIN_PASSWORD || '');
  if (!email || !password) return null;
  return { email, password };
}

function isSuperAdminRequest(req) {
  return req?.userType === 'super_admin' || req?.isSuperAdmin === true;
}

function matchesSuperAdminLogin(email, password) {
  const creds = getSuperAdminCredentials();
  if (!creds) return false;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return normalizedEmail === creds.email && String(password || '') === creds.password;
}

module.exports = {
  getSuperAdminCredentials,
  isSuperAdminRequest,
  matchesSuperAdminLogin,
};

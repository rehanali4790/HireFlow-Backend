const crypto = require('crypto');

const TOKEN_TTL_SECONDS = 6 * 60 * 60;
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || 'hireflow-dev-token-secret';

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(value) {
  return crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(value)
    .digest('base64url');
}

function createAuthToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = {
    ...payload,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const encodedHeader = base64UrlEncode(header);
  const encodedBody = base64UrlEncode(body);
  const signature = sign(`${encodedHeader}.${encodedBody}`);

  return {
    token: `${encodedHeader}.${encodedBody}.${signature}`,
    expiresAt: new Date(body.exp * 1000).toISOString(),
  };
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing token');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token');
  }

  const [encodedHeader, encodedBody, signature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedBody}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8'));
  if (!payload.exp || Math.floor(Date.now() / 1000) >= payload.exp) {
    throw new Error('Token expired');
  }

  return payload;
}

module.exports = {
  TOKEN_TTL_SECONDS,
  createAuthToken,
  verifyAuthToken,
};

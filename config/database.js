const { Pool, Client } = require('pg');

function isProduction() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    null
  );
}

function shouldUseSsl(connectionString = getConnectionString()) {
  if (process.env.DB_SSL === 'false') return false;
  if (process.env.DB_SSL === 'true') return true;

  if (!connectionString) {
    return isProduction();
  }

  // Railway private network and local Postgres do not use SSL.
  if (
    connectionString.includes('railway.internal') ||
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1')
  ) {
    return false;
  }

  // Public/proxied Railway URLs require SSL.
  if (
    connectionString.includes('proxy.rlwy.net') ||
    connectionString.includes('railway.app') ||
    connectionString.includes('sslmode=require') ||
    connectionString.includes('sslmode=verify-full')
  ) {
    return true;
  }

  return isProduction();
}

function getPoolConfig() {
  const connectionString = getConnectionString();
  const ssl = shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false;

  if (connectionString) {
    return {
      connectionString,
      ssl,
      connectionTimeoutMillis: 10000,
    };
  }

  const host = process.env.DB_HOST || process.env.PGHOST;
  const database = process.env.DB_NAME || process.env.PGDATABASE;
  const user = process.env.DB_USER || process.env.PGUSER;
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD;

  if (isProduction() && !host) {
    throw new Error(
      'No database configured. Link PostgreSQL to this service in Railway or set DATABASE_URL.'
    );
  }

  return {
    host: host || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
    database: database || 'hireflow_db',
    user: user || 'postgres',
    password,
    ssl,
    connectionTimeoutMillis: 10000,
  };
}

function createPool() {
  return new Pool(getPoolConfig());
}

function createClient(overrides = {}) {
  return new Client({
    ...getPoolConfig(),
    ...overrides,
  });
}

function getDatabaseTarget() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    const host = process.env.DB_HOST || process.env.PGHOST || 'localhost';
    const database = process.env.DB_NAME || process.env.PGDATABASE || 'hireflow_db';
    return `${host}/${database}`;
  }

  try {
    const url = new URL(connectionString);
    return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  } catch {
    return 'configured via DATABASE_URL';
  }
}

module.exports = {
  createPool,
  createClient,
  getPoolConfig,
  getConnectionString,
  getDatabaseTarget,
  isProduction,
};

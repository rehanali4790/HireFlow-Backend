const { Pool, Client } = require('pg');

function isProduction() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

function shouldUseSsl() {
  if (process.env.DB_SSL === 'false') return false;
  if (process.env.DB_SSL === 'true') return true;
  return Boolean(process.env.DATABASE_URL) || isProduction();
}

function getPoolConfig() {
  const ssl = shouldUseSsl() ? { rejectUnauthorized: false } : false;

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl,
    };
  }

  return {
    host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
    database: process.env.DB_NAME || process.env.PGDATABASE || 'hireflow_db',
    user: process.env.DB_USER || process.env.PGUSER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
    ssl,
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

module.exports = {
  createPool,
  createClient,
  getPoolConfig,
  isProduction,
};

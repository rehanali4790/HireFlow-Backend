const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const PLATFORM_EMAIL = 'platform-templates@hireflow.internal';
const PLATFORM_COMPANY_NAME = '__HireFlow Platform Templates__';

async function ensurePlatformEmployer(db) {
  const existing = await db.query(
    `SELECT id FROM employers WHERE contact_email = $1 LIMIT 1`,
    [PLATFORM_EMAIL]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const lockedHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const insert = await db.query(
    `INSERT INTO employers (contact_email, password_hash, company_name, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING id`,
    [PLATFORM_EMAIL, lockedHash, PLATFORM_COMPANY_NAME]
  );

  return insert.rows[0].id;
}

async function resolveRolesEmployerId(req, db) {
  if (req.isSuperAdmin && !req.employerId) {
    return ensurePlatformEmployer(db);
  }
  if (!req.employerId) {
    return null;
  }
  return req.employerId;
}

async function copyRolePermissions(db, fromRoleId, toRoleId) {
  const perms = await db.query(
    `SELECT resource, can_read, can_write, can_edit, can_delete
     FROM permissions WHERE role_id = $1`,
    [fromRoleId]
  );

  for (const perm of perms.rows) {
    await db.query(
      `INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (role_id, resource) DO UPDATE SET
         can_read = EXCLUDED.can_read,
         can_write = EXCLUDED.can_write,
         can_edit = EXCLUDED.can_edit,
         can_delete = EXCLUDED.can_delete`,
      [
        toRoleId,
        perm.resource,
        perm.can_read,
        perm.can_write,
        perm.can_edit,
        perm.can_delete,
      ]
    );
  }
}

async function cloneSingleTemplateRole(db, template, companyEmployerId) {
  const newRole = await db.query(
    `INSERT INTO roles (employer_id, name, description, is_system_role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id`,
    [companyEmployerId, template.name, template.description, template.is_system_role]
  );

  await copyRolePermissions(db, template.id, newRole.rows[0].id);
  return newRole.rows[0].id;
}

/** Fresh company: replace auto-seeded defaults with platform templates */
async function clonePlatformRolesToEmployer(db, employerId) {
  const platformEmployerId = await ensurePlatformEmployer(db);

  const templateRoles = await db.query(
    `SELECT id, name, description, is_system_role
     FROM roles
     WHERE employer_id = $1
     ORDER BY created_at ASC`,
    [platformEmployerId]
  );

  if (templateRoles.rows.length === 0) {
    return;
  }

  await db.query(`DELETE FROM roles WHERE employer_id = $1`, [employerId]);

  for (const template of templateRoles.rows) {
    await cloneSingleTemplateRole(db, template, employerId);
  }
}

/**
 * Resolve a role id for a company.
 * Accepts either a company role id OR a platform-template role id.
 * If platform role is missing on company, clones it (by name) then returns company role id.
 */
async function mapPlatformRoleToCompanyRole(db, roleId, companyEmployerId) {
  if (!roleId) return null;

  const platformEmployerId = await ensurePlatformEmployer(db);

  // Already a company-scoped role?
  const direct = await db.query(
    `SELECT id FROM roles WHERE id = $1 AND employer_id = $2`,
    [roleId, companyEmployerId]
  );
  if (direct.rows.length > 0) {
    return direct.rows[0].id;
  }

  // Platform template?
  const template = await db.query(
    `SELECT id, name, description, is_system_role
     FROM roles WHERE id = $1 AND employer_id = $2`,
    [roleId, platformEmployerId]
  );

  if (template.rows.length === 0) {
    return null;
  }

  const existingByName = await db.query(
    `SELECT id FROM roles
     WHERE employer_id = $1 AND lower(name) = lower($2)
     ORDER BY created_at ASC
     LIMIT 1`,
    [companyEmployerId, template.rows[0].name]
  );

  if (existingByName.rows.length > 0) {
    // Keep company role in sync with latest template permissions
    await copyRolePermissions(db, template.rows[0].id, existingByName.rows[0].id);
    return existingByName.rows[0].id;
  }

  return cloneSingleTemplateRole(db, template.rows[0], companyEmployerId);
}

module.exports = {
  PLATFORM_EMAIL,
  PLATFORM_COMPANY_NAME,
  ensurePlatformEmployer,
  resolveRolesEmployerId,
  clonePlatformRolesToEmployer,
  mapPlatformRoleToCompanyRole,
};

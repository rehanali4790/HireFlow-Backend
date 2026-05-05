const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('🔄 Running users and permissions migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'database', 'add-users-permissions.sql'),
      'utf8'
    );

    await pool.query(migrationSQL);
    
    console.log('✅ Users and permissions migration completed successfully!');
    console.log('');
    console.log('📊 Database changes:');
    console.log('   ✓ Created roles table');
    console.log('   ✓ Created permissions table');
    console.log('   ✓ Created users table');
    console.log('   ✓ Created user_activity_log table');
    console.log('   ✓ Created indexes for performance');
    console.log('   ✓ Created trigger for default roles');
    console.log('');
    
    // Create default roles for existing employers
    console.log('🔄 Creating default roles for existing employers...');
    const employers = await pool.query('SELECT id FROM employers');
    
    for (const employer of employers.rows) {
      // Check if roles already exist
      const existingRoles = await pool.query(
        'SELECT COUNT(*) as count FROM roles WHERE employer_id = $1',
        [employer.id]
      );
      
      if (parseInt(existingRoles.rows[0].count) === 0) {
        console.log(`   Creating roles for employer ${employer.id}...`);
        
        // Create Admin role
        const adminRole = await pool.query(
          `INSERT INTO roles (employer_id, name, description, is_system_role)
           VALUES ($1, 'Admin', 'Full access to all features', true)
           RETURNING id`,
          [employer.id]
        );
        
        // Admin permissions
        await pool.query(
          `INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
           VALUES 
             ($1, 'jobs', true, true, true, true),
             ($1, 'applications', true, true, true, true),
             ($1, 'candidates', true, true, true, true),
             ($1, 'tests', true, true, true, true),
             ($1, 'interviews', true, true, true, true),
             ($1, 'analytics', true, true, true, true),
             ($1, 'settings', true, true, true, true),
             ($1, 'users', true, true, true, true)`,
          [adminRole.rows[0].id]
        );
        
        // Create Manager role
        const managerRole = await pool.query(
          `INSERT INTO roles (employer_id, name, description, is_system_role)
           VALUES ($1, 'Manager', 'Manage jobs, applications, and team members', true)
           RETURNING id`,
          [employer.id]
        );
        
        await pool.query(
          `INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
           VALUES 
             ($1, 'jobs', true, true, true, true),
             ($1, 'applications', true, true, true, false),
             ($1, 'candidates', true, true, true, false),
             ($1, 'tests', true, true, true, true),
             ($1, 'interviews', true, true, true, false),
             ($1, 'analytics', true, false, false, false),
             ($1, 'settings', true, false, false, false),
             ($1, 'users', true, true, false, false)`,
          [managerRole.rows[0].id]
        );
        
        // Create Recruiter role
        const recruiterRole = await pool.query(
          `INSERT INTO roles (employer_id, name, description, is_system_role)
           VALUES ($1, 'Recruiter', 'Review applications and conduct interviews', true)
           RETURNING id`,
          [employer.id]
        );
        
        await pool.query(
          `INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
           VALUES 
             ($1, 'jobs', true, false, false, false),
             ($1, 'applications', true, false, true, false),
             ($1, 'candidates', true, false, true, false),
             ($1, 'tests', true, false, false, false),
             ($1, 'interviews', true, true, true, false),
             ($1, 'analytics', true, false, false, false),
             ($1, 'settings', false, false, false, false),
             ($1, 'users', false, false, false, false)`,
          [recruiterRole.rows[0].id]
        );
        
        // Create Viewer role
        const viewerRole = await pool.query(
          `INSERT INTO roles (employer_id, name, description, is_system_role)
           VALUES ($1, 'Viewer', 'Read-only access to jobs and applications', true)
           RETURNING id`,
          [employer.id]
        );
        
        await pool.query(
          `INSERT INTO permissions (role_id, resource, can_read, can_write, can_edit, can_delete)
           VALUES 
             ($1, 'jobs', true, false, false, false),
             ($1, 'applications', true, false, false, false),
             ($1, 'candidates', true, false, false, false),
             ($1, 'tests', true, false, false, false),
             ($1, 'interviews', true, false, false, false),
             ($1, 'analytics', true, false, false, false),
             ($1, 'settings', false, false, false, false),
             ($1, 'users', false, false, false, false)`,
          [viewerRole.rows[0].id]
        );
        
        console.log(`   ✓ Created 4 default roles for employer ${employer.id}`);
      }
    }
    
    console.log('');
    console.log('✨ Migration complete!');
    console.log('');
    console.log('📝 Default Roles Created:');
    console.log('   1. Admin - Full access to all features');
    console.log('   2. Manager - Manage jobs, applications, and team');
    console.log('   3. Recruiter - Review applications and conduct interviews');
    console.log('   4. Viewer - Read-only access');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Navigate to Settings > Users to create team members');
    console.log('   3. Navigate to Settings > Permissions to manage roles');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to run migration:', error);
    process.exit(1);
  });

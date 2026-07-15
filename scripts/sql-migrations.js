const fs = require('fs');
const path = require('path');

const SQL_MIGRATIONS = [
  { file: 'add-users-permissions.sql', label: 'Users and permissions' },
  { file: 'add-user-profile-columns.sql', label: 'User profile columns' },
  { file: 'add-certifications-column.sql', label: 'Certifications column' },
  { file: 'add-picture-column.sql', label: 'Picture URL column' },
  { file: 'add-test-columns.sql', label: 'Test metadata columns' },
  { file: 'add-test-expiration.sql', label: 'Test link expiration columns' },
  { file: 'add-question-count-column.sql', label: 'AI interview question count' },
  { file: 'add-ai-interview-columns.sql', label: 'AI interview response columns' },
  { file: 'add-ai-interview-validity.sql', label: 'AI interview validity dates' },
  { file: 'add-video-url-column.sql', label: 'AI interview video URL' },
  { file: 'add-pipeline-stages.sql', label: 'Pipeline stage columns' },
  { file: 'add-final-interview-scheduled.sql', label: 'Final interview scheduled column' },
  { file: 'add-email-template-industry.sql', label: 'Email template industry columns' },
  { file: 'add-final-scoring-table.sql', label: 'Final scoring table' },
  { file: 'add-prescreening-questions.sql', label: 'Prescreening questions' },
  { file: 'add-interview-datetime.sql', label: 'Interview date/time columns' },
  { file: 'add-pipeline-events.sql', label: 'Pipeline events history' },
  { file: 'add-candidate-blacklist.sql', label: 'Candidate blacklist tables' },
  { file: 'add-referred-by.sql', label: 'Application referred_by column' },
  { file: 'add-requisitions.sql', label: 'Job requisitions tables' },
];

async function runSqlMigrations(pool, options = {}) {
  const log = options.log || console.log;
  const warn = options.warn || console.warn;
  const databaseDir = path.join(__dirname, '../database');
  const results = { applied: [], failed: [] };

  for (const migration of SQL_MIGRATIONS) {
    const sqlPath = path.join(databaseDir, migration.file);

    if (!fs.existsSync(sqlPath)) {
      warn(`⚠️ Migration file missing: ${migration.file}`);
      results.failed.push({ file: migration.file, error: 'file not found' });
      continue;
    }

    try {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await pool.query(sql);
      log(`✅ ${migration.label}`);
      results.applied.push(migration.file);
    } catch (error) {
      warn(`⚠️ Migration failed (${migration.file}): ${error.message}`);
      results.failed.push({ file: migration.file, error: error.message });
    }
  }

  return results;
}

module.exports = {
  SQL_MIGRATIONS,
  runSqlMigrations,
};

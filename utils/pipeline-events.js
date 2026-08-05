/** Shared pipeline stage definitions + event logging */

const PIPELINE_STAGES = [
  { id: 'new', label: 'New / Applied', statuses: ['new', 'applied', 'screening'] },
  { id: 'reviewing', label: 'Reviewing', statuses: ['reviewing'] },
  { id: 'call', label: 'Call Screening', statuses: ['screening_pending', 'not_attempted_call'] },
  { id: 'shortlisted', label: 'Shortlisted', statuses: ['shortlisted'] },
  { id: 'test', label: 'Test', statuses: ['testing', 'test_completed'] },
  { id: 'ai_interview', label: 'AI Interview', statuses: ['ai_interview', 'ai_interview_completed'] },
  { id: 'hod_interview', label: 'HOD Interview', statuses: ['hod_interview'] },
  { id: 'hr_interview', label: 'HR / Final Interview', statuses: ['interviewing', 'final_interview', 'not_attended'] },
  { id: 'hired', label: 'Hired', statuses: ['hired'] },
  { id: 'on_hold', label: 'On Hold', statuses: ['undecided', 'on_hold'] },
  { id: 'rejected', label: 'Rejected', statuses: ['rejected', 'rejected_screening', 'rejected_test', 'rejected_ai_interview', 'rejected_final', 'test_cancelled', 'ai_interview_cancelled'] },
  { id: 'blacklisted', label: 'Blacklisted', statuses: ['blacklisted'] },
];

const MOVE_TARGETS = [
  { status: 'new', label: 'New', stage: 'new' },
  { status: 'reviewing', label: 'Reviewing', stage: 'reviewing' },
  { status: 'screening_pending', label: 'Call Screening', stage: 'call' },
  { status: 'not_attempted_call', label: 'Not Attempted Call', stage: 'call' },
  { status: 'shortlisted', label: 'Shortlisted', stage: 'shortlisted' },
  { status: 'testing', label: 'Test', stage: 'test' },
  { status: 'test_completed', label: 'Test Completed', stage: 'test' },
  { status: 'ai_interview', label: 'AI Interview', stage: 'ai_interview' },
  { status: 'ai_interview_completed', label: 'AI Interview Done', stage: 'ai_interview' },
  { status: 'hod_interview', label: 'HOD Interview', stage: 'hod_interview' },
  { status: 'interviewing', label: 'HR / Final Interview', stage: 'hr_interview' },
  { status: 'hired', label: 'Hired', stage: 'hired' },
  { status: 'undecided', label: 'On Hold', stage: 'on_hold' },
  { status: 'rejected', label: 'Rejected', stage: 'rejected' },
];

function statusToStage(status) {
  const s = (status || '').toLowerCase();
  for (const stage of PIPELINE_STAGES) {
    if (stage.statuses.includes(s)) return stage.id;
  }
  return 'new';
}

async function ensurePipelineEventsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS application_pipeline_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      stage VARCHAR(50) NOT NULL,
      action VARCHAR(50) NOT NULL,
      from_status VARCHAR(50),
      to_status VARCHAR(50),
      outcome VARCHAR(50),
      notes TEXT,
      actor_name TEXT,
      actor_email TEXT,
      actor_role TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function logPipelineEvent(db, {
  applicationId,
  stage,
  action,
  fromStatus = null,
  toStatus = null,
  outcome = null,
  notes = null,
  actorName = null,
  actorEmail = null,
  actorRole = null,
  metadata = {},
}) {
  try {
    await ensurePipelineEventsTable(db);
    await db.query(
      `INSERT INTO application_pipeline_events (
         application_id, stage, action, from_status, to_status, outcome,
         notes, actor_name, actor_email, actor_role, metadata, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb, NOW())`,
      [
        applicationId,
        stage || statusToStage(toStatus || fromStatus),
        action,
        fromStatus,
        toStatus,
        outcome,
        notes,
        actorName,
        actorEmail,
        actorRole,
        JSON.stringify(metadata || {}),
      ]
    );
  } catch (error) {
    console.error('Failed to log pipeline event:', error.message);
  }
}

module.exports = {
  PIPELINE_STAGES,
  MOVE_TARGETS,
  statusToStage,
  ensurePipelineEventsTable,
  logPipelineEvent,
};

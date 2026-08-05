const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getActor } = require('../middleware/audit-log');
const { isPlatformWide, resolveEmployerIdForApplication } = require('../utils/platform-scope');

const router = express.Router();

async function getThreadAccess(db, threadId, req) {
  const result = await db.query(
    `SELECT *
     FROM candidate_chat_threads
     WHERE id = $1
       AND employer_id = $2
       AND ($3 = $2 OR assigned_user_id = $3 OR created_by_user_id = $3)`,
    [threadId, req.employerId, req.userId]
  );
  return result.rows[0] || null;
}

function emitThread(io, threadId, event, payload) {
  if (!io || !threadId) return;
  io.to(`thread:${threadId}`).emit(event, payload);
}

function orderedParticipants(userId, otherUserId) {
  return [userId, otherUserId].sort();
}

/** Super-admin is not a UUID user — act as the company owner in chat threads. */
function resolveChatActorId(req, employerId) {
  if (req.isSuperAdmin || req.userId === 'super-admin') {
    return employerId;
  }
  return req.userId;
}

/**
 * Resolve company for chat actions when SA has no X-Tenant-Id.
 * Prefers recipient user's company, then thread, then application.
 */
async function resolveChatContext(db, req, { recipientUserId, threadId, applicationId, applicationIds } = {}) {
  let employerId = req.employerId || null;

  if (!employerId && req.isSuperAdmin) {
    if (recipientUserId) {
      const byUser = await db.query(
        `SELECT employer_id FROM users WHERE id = $1 AND is_active = true LIMIT 1`,
        [recipientUserId]
      );
      employerId = byUser.rows[0]?.employer_id || null;
      if (!employerId) {
        const byOwner = await db.query(`SELECT id FROM employers WHERE id = $1 LIMIT 1`, [recipientUserId]);
        employerId = byOwner.rows[0]?.id || null;
      }
    }

    if (!employerId && threadId) {
      const byThread = await db.query(
        `SELECT employer_id FROM user_chat_threads WHERE id = $1 LIMIT 1`,
        [threadId]
      );
      employerId = byThread.rows[0]?.employer_id || null;
      if (!employerId) {
        const byCandThread = await db.query(
          `SELECT employer_id FROM candidate_chat_threads WHERE id = $1 LIMIT 1`,
          [threadId]
        );
        employerId = byCandThread.rows[0]?.employer_id || null;
      }
    }

    if (!employerId && applicationId) {
      employerId = await resolveEmployerIdForApplication(db, req, applicationId);
    }

    if (!employerId && Array.isArray(applicationIds) && applicationIds[0]) {
      employerId = await resolveEmployerIdForApplication(db, req, applicationIds[0]);
    }
  }

  if (!employerId) {
    return { ok: false, status: 400, error: 'Company context required' };
  }

  return {
    ok: true,
    employerId,
    actorId: resolveChatActorId(req, employerId),
  };
}

async function getUserChatThreadAccess(db, threadId, req, employerIdOverride = null) {
  const employerId = employerIdOverride || req.employerId;
  const actorId = resolveChatActorId(req, employerId);

  if (!employerId) {
    // Platform-wide SA fallback: load thread directly if they act as that company owner
    if (req.isSuperAdmin || req.userId === 'super-admin') {
      const result = await db.query(`SELECT * FROM user_chat_threads WHERE id = $1`, [threadId]);
      const thread = result.rows[0];
      if (!thread) return null;
      if (
        thread.participant_one_id === thread.employer_id ||
        thread.participant_two_id === thread.employer_id
      ) {
        return thread;
      }
      return thread;
    }
    return null;
  }

  const result = await db.query(
    `SELECT *
     FROM user_chat_threads
     WHERE id = $1
       AND employer_id = $2
       AND ($3 = participant_one_id OR $3 = participant_two_id OR $3 = $2)`,
    [threadId, employerId, actorId]
  );
  return result.rows[0] || null;
}

async function getChatUser(db, userId, employerId) {
  if (userId === employerId) {
    const owner = await db.query(
      `SELECT id, company_name, contact_email
       FROM employers
       WHERE id = $1`,
      [employerId]
    );
    if (!owner.rows[0]) return null;
    return {
      id: owner.rows[0].id,
      first_name: owner.rows[0].company_name || 'Owner',
      last_name: '',
      email: owner.rows[0].contact_email,
      department: 'Management',
      designation: 'Owner',
      is_owner: true,
      is_active: true,
    };
  }

  const user = await db.query(
    `SELECT id, first_name, last_name, email, department, designation, is_active
     FROM users
     WHERE id = $1 AND employer_id = $2 AND is_active = true`,
    [userId, employerId]
  );
  return user.rows[0] || null;
}

router.get('/', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const platformWide = isPlatformWide(req);
    if (!platformWide && !req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const result = platformWide
      ? await db.query(
          `SELECT t.*,
                  c.first_name, c.last_name, c.email as candidate_email, c.phone, c.resume_url,
                  j.title as job_title,
                  u.first_name as assigned_first_name, u.last_name as assigned_last_name, u.email as assigned_email,
                  m.message as last_message
           FROM candidate_chat_threads t
           LEFT JOIN applications a ON t.application_id = a.id
           LEFT JOIN candidates c ON a.candidate_id = c.id
           LEFT JOIN jobs j ON a.job_id = j.id
           LEFT JOIN users u ON t.assigned_user_id = u.id
           LEFT JOIN LATERAL (
             SELECT message FROM candidate_chat_messages
             WHERE thread_id = t.id
             ORDER BY created_at DESC
             LIMIT 1
           ) m ON true
           ORDER BY t.last_message_at DESC`
        )
      : await db.query(
          `SELECT t.*,
                  c.first_name, c.last_name, c.email as candidate_email, c.phone, c.resume_url,
                  j.title as job_title,
                  u.first_name as assigned_first_name, u.last_name as assigned_last_name, u.email as assigned_email,
                  m.message as last_message
           FROM candidate_chat_threads t
           LEFT JOIN applications a ON t.application_id = a.id
           LEFT JOIN candidates c ON a.candidate_id = c.id
           LEFT JOIN jobs j ON a.job_id = j.id
           LEFT JOIN users u ON t.assigned_user_id = u.id
           LEFT JOIN LATERAL (
             SELECT message FROM candidate_chat_messages
             WHERE thread_id = t.id
             ORDER BY created_at DESC
             LIMIT 1
           ) m ON true
           WHERE t.employer_id = $1
             AND ($2 = $1 OR t.assigned_user_id = $2 OR t.created_by_user_id = $2)
           ORDER BY t.last_message_at DESC`,
          [req.employerId, req.userId]
        );

    res.json(result.rows);
  } catch (error) {
    console.error('Get chat threads error:', error);
    res.status(500).json({ error: 'Failed to fetch chat threads' });
  }
});

router.get('/users', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const onlineUsers = req.app.locals.onlineUsers || new Map();

  try {
    const platformWide = isPlatformWide(req);
    if (!platformWide && !req.employerId) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const usersResult = platformWide
      ? await db.query(
          `SELECT u.id, u.first_name, u.last_name, u.email, u.department, u.designation,
                  u.is_active, u.last_login, e.company_name,
                  NULL::uuid as thread_id, NULL::timestamptz as last_message_at,
                  NULL::text as last_message,
                  0::int as unread_count
           FROM users u
           JOIN employers e ON e.id = u.employer_id
           WHERE u.is_active = true
           ORDER BY u.created_at DESC`
        )
      : await db.query(
          `SELECT u.id, u.first_name, u.last_name, u.email, u.department, u.designation,
                  u.is_active, u.last_login,
                  t.id as thread_id, t.last_message_at,
                  m.message as last_message,
                  COALESCE(unread.unread_count, 0)::int as unread_count
           FROM users u
           LEFT JOIN user_chat_threads t
             ON t.employer_id = u.employer_id
            AND (u.id = t.participant_one_id OR u.id = t.participant_two_id)
            AND ($2 = t.participant_one_id OR $2 = t.participant_two_id OR $2 = $1)
           LEFT JOIN LATERAL (
             SELECT message FROM user_chat_messages
             WHERE thread_id = t.id
             ORDER BY created_at DESC
             LIMIT 1
           ) m ON true
           LEFT JOIN LATERAL (
             SELECT COUNT(*) as unread_count
             FROM user_chat_messages um
             WHERE um.thread_id = t.id
               AND um.employer_id = $1
               AND um.sender_id != $2
               AND um.created_at > COALESCE(
                 CASE
                   WHEN t.participant_one_id = $2 THEN t.participant_one_last_read_at
                   WHEN t.participant_two_id = $2 THEN t.participant_two_last_read_at
                   ELSE NULL
                 END,
                 TIMESTAMP '1970-01-01'
               )
           ) unread ON true
           WHERE u.employer_id = $1 AND u.is_active = true AND u.id != $2
           ORDER BY COALESCE(t.last_message_at, u.created_at) DESC`,
          [req.employerId, req.userId]
        );

    const rows = usersResult.rows.map((user) => ({
      ...user,
      online: onlineUsers.has(user.id),
    }));

    if (!platformWide && req.userId !== req.employerId) {
      const owner = await getChatUser(db, req.employerId, req.employerId);
      if (owner) {
        const pair = orderedParticipants(req.userId, req.employerId);
        const ownerThread = await db.query(
          `SELECT t.id as thread_id, t.last_message_at, m.message as last_message,
                  COALESCE(unread.unread_count, 0)::int as unread_count
           FROM user_chat_threads t
           LEFT JOIN LATERAL (
             SELECT message FROM user_chat_messages
             WHERE thread_id = t.id
             ORDER BY created_at DESC
             LIMIT 1
           ) m ON true
           LEFT JOIN LATERAL (
             SELECT COUNT(*) as unread_count
             FROM user_chat_messages um
             WHERE um.thread_id = t.id
               AND um.employer_id = $1
               AND um.sender_id != $4
               AND um.created_at > COALESCE(
                 CASE
                   WHEN t.participant_one_id = $4 THEN t.participant_one_last_read_at
                   WHEN t.participant_two_id = $4 THEN t.participant_two_last_read_at
                   ELSE NULL
                 END,
                 TIMESTAMP '1970-01-01'
               )
           ) unread ON true
           WHERE t.employer_id = $1 AND t.participant_one_id = $2 AND t.participant_two_id = $3`,
          [req.employerId, pair[0], pair[1], req.userId]
        );
        rows.unshift({
          ...owner,
          thread_id: ownerThread.rows[0]?.thread_id || null,
          last_message_at: ownerThread.rows[0]?.last_message_at || null,
          last_message: ownerThread.rows[0]?.last_message || null,
          unread_count: ownerThread.rows[0]?.unread_count || 0,
          online: onlineUsers.has(req.employerId),
        });
      }
    }

    res.json(rows);
  } catch (error) {
    console.error('Get chat users error:', error);
    res.status(500).json({ error: 'Failed to fetch chat users' });
  }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    // Super-admin uses a synthetic userId ("super-admin") that is not a UUID.
    // When a tenant is selected, treat them as the company owner for unread counts.
    const actorId =
      req.isSuperAdmin || req.userId === 'super-admin'
        ? req.employerId
        : req.userId;

    if (!req.employerId || !actorId) {
      return res.json({ unread_count: 0 });
    }

    const result = await db.query(
      `SELECT COALESCE(SUM(thread_counts.unread_count), 0)::int as unread_count
       FROM (
         SELECT COUNT(m.id) as unread_count
         FROM user_chat_threads t
         LEFT JOIN user_chat_messages m
           ON m.thread_id = t.id
          AND m.employer_id = t.employer_id
          AND m.sender_id != $2
          AND m.created_at > COALESCE(
            CASE
              WHEN t.participant_one_id = $2 THEN t.participant_one_last_read_at
              WHEN t.participant_two_id = $2 THEN t.participant_two_last_read_at
              ELSE NULL
            END,
            TIMESTAMP '1970-01-01'
          )
         WHERE t.employer_id = $1
           AND ($2 = t.participant_one_id OR $2 = t.participant_two_id OR $2 = $1)
         GROUP BY t.id
       ) thread_counts`,
      [req.employerId, actorId]
    );

    res.json({ unread_count: result.rows[0]?.unread_count || 0 });
  } catch (error) {
    console.error('Get unread chat count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread chat count' });
  }
});

router.post('/user-threads', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const io = req.app.locals.io;
  const { recipientUserId } = req.body;

  try {
    if (!recipientUserId) {
      return res.status(400).json({ error: 'recipientUserId is required' });
    }

    const ctx = await resolveChatContext(db, req, { recipientUserId });
    if (!ctx.ok) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    if (recipientUserId === ctx.actorId || recipientUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot chat with yourself' });
    }

    const recipient = await getChatUser(db, recipientUserId, ctx.employerId);
    if (!recipient) {
      return res.status(404).json({ error: 'User not found' });
    }

    // SA uses company owner UUID as participant (req.userId is "super-admin", not a UUID)
    const pair = orderedParticipants(ctx.actorId, recipientUserId);
    const result = await db.query(
      `INSERT INTO user_chat_threads (
         employer_id, participant_one_id, participant_two_id, last_message_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, NOW(), NOW(), NOW())
       ON CONFLICT (employer_id, participant_one_id, participant_two_id)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [ctx.employerId, pair[0], pair[1]]
    );

    const payload = { thread: result.rows[0], recipient };
    io?.to(`user:${recipientUserId}`).emit('user-thread:created', payload);
    io?.to(`user:${ctx.actorId}`).emit('user-thread:created', payload);
    res.status(201).json(payload);
  } catch (error) {
    console.error('Create user chat thread error:', error);
    res.status(500).json({ error: 'Failed to create user chat' });
  }
});

router.get('/user-threads/:threadId/messages', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const ctx = await resolveChatContext(db, req, { threadId: req.params.threadId });
    if (!ctx.ok) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    const thread = await getUserChatThreadAccess(db, req.params.threadId, req, ctx.employerId);
    if (!thread) {
      return res.status(404).json({ error: 'Chat thread not found' });
    }

    const result = await db.query(
      `SELECT *
       FROM user_chat_messages
       WHERE thread_id = $1 AND employer_id = $2
       ORDER BY created_at ASC`,
      [req.params.threadId, ctx.employerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get user chat messages error:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

router.post('/user-threads/:threadId/read', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const ctx = await resolveChatContext(db, req, { threadId: req.params.threadId });
    if (!ctx.ok) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    const thread = await getUserChatThreadAccess(db, req.params.threadId, req, ctx.employerId);
    if (!thread) {
      return res.status(404).json({ error: 'Chat thread not found' });
    }

    const readColumn = thread.participant_one_id === ctx.actorId
      ? 'participant_one_last_read_at'
      : thread.participant_two_id === ctx.actorId
        ? 'participant_two_last_read_at'
        : null;

    if (readColumn) {
      await db.query(
        `UPDATE user_chat_threads SET ${readColumn} = NOW(), updated_at = NOW() WHERE id = $1 AND employer_id = $2`,
        [req.params.threadId, ctx.employerId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark chat read error:', error);
    res.status(500).json({ error: 'Failed to mark chat as read' });
  }
});

router.post('/user-threads/:threadId/messages', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const io = req.app.locals.io;
  const { message, metadata } = req.body;

  try {
    const cleanMessage = typeof message === 'string' ? message.trim() : '';
    const isAudioMessage = metadata?.event_type === 'audio_message' && metadata?.audio_data && metadata?.audio_mime_type;

    if (!cleanMessage && !isAudioMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ctx = await resolveChatContext(db, req, { threadId: req.params.threadId });
    if (!ctx.ok) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    const thread = await getUserChatThreadAccess(db, req.params.threadId, req, ctx.employerId);
    if (!thread) {
      return res.status(404).json({ error: 'Chat thread not found' });
    }

    const actor = await getActor(db, req.userId, ctx.employerId);
    const result = await db.query(
      `INSERT INTO user_chat_messages (
         thread_id, employer_id, sender_id, sender_name, sender_email, message, metadata, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        req.params.threadId,
        ctx.employerId,
        ctx.actorId,
        actor.actorName,
        actor.actorEmail,
        cleanMessage || 'Voice message',
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    await db.query(
      `UPDATE user_chat_threads SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [req.params.threadId]
    );

    const row = result.rows[0];
    emitThread(io, req.params.threadId, 'user-message:new', row);
    io?.to(`user:${thread.participant_one_id}`).emit('user-thread:updated', { threadId: req.params.threadId, message: row });
    io?.to(`user:${thread.participant_two_id}`).emit('user-thread:updated', { threadId: req.params.threadId, message: row });
    res.status(201).json(row);
  } catch (error) {
    console.error('Send user chat message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/approved-candidates', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const result = await db.query(
      `SELECT a.id as application_id, a.status, a.application_date,
              c.id as candidate_id, c.first_name, c.last_name, c.email, c.phone, c.resume_url,
              j.id as job_id, j.title as job_title
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE j.employer_id = $1
         AND (
           a.status IN ('shortlisted', 'test_completed', 'ai_interview', 'final_interview', 'hired', 'offered')
           OR a.shortlist_approved_at IS NOT NULL
           OR a.test_approved_at IS NOT NULL
           OR a.ai_interview_approved_at IS NOT NULL
         )
       ORDER BY j.title ASC, c.first_name ASC, c.last_name ASC`,
      [req.employerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get approved candidates error:', error);
    res.status(500).json({ error: 'Failed to fetch approved candidates' });
  }
});

router.post('/user-threads/:threadId/candidates', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const io = req.app.locals.io;
  const { applicationIds } = req.body;

  try {
    const ids = Array.isArray(applicationIds) ? applicationIds.filter(Boolean) : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Select at least one candidate' });
    }

    const ctx = await resolveChatContext(db, req, {
      threadId: req.params.threadId,
      applicationIds: ids,
    });
    if (!ctx.ok) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    const thread = await getUserChatThreadAccess(db, req.params.threadId, req, ctx.employerId);
    if (!thread) {
      return res.status(404).json({ error: 'Chat thread not found' });
    }

    const candidates = await db.query(
      `SELECT a.id as application_id, a.status,
              c.first_name, c.last_name, c.email, c.phone, c.resume_url,
              j.title as job_title
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = ANY($1::uuid[]) AND j.employer_id = $2`,
      [ids, ctx.employerId]
    );

    if (candidates.rows.length === 0) {
      return res.status(404).json({ error: 'No candidates found' });
    }

    const actor = await getActor(db, req.userId, ctx.employerId);
    const candidateNames = candidates.rows.map((candidate) => `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || candidate.email).join(', ');
    const result = await db.query(
      `INSERT INTO user_chat_messages (
         thread_id, employer_id, sender_id, sender_name, sender_email, message, metadata, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        req.params.threadId,
        ctx.employerId,
        ctx.actorId,
        actor.actorName,
        actor.actorEmail,
        `Shared candidate${candidates.rows.length > 1 ? 's' : ''}: ${candidateNames}`,
        JSON.stringify({ event_type: 'candidates_shared', candidates: candidates.rows }),
      ]
    );

    await db.query(
      `UPDATE user_chat_threads SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [req.params.threadId]
    );

    const row = result.rows[0];
    emitThread(io, req.params.threadId, 'user-message:new', row);
    io?.to(`user:${thread.participant_one_id}`).emit('user-thread:updated', { threadId: req.params.threadId, message: row });
    io?.to(`user:${thread.participant_two_id}`).emit('user-thread:updated', { threadId: req.params.threadId, message: row });
    res.status(201).json(row);
  } catch (error) {
    console.error('Share candidates error:', error);
    res.status(500).json({ error: 'Failed to share candidates' });
  }
});

router.post('/tag', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const io = req.app.locals.io;
  const { applicationId, assignedUserId, message } = req.body;

  try {
    if (!applicationId || !assignedUserId) {
      return res.status(400).json({ error: 'applicationId and assignedUserId are required' });
    }

    const ctx = await resolveChatContext(db, req, {
      recipientUserId: assignedUserId,
      applicationId,
    });
    if (!ctx.ok) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    const appResult = await db.query(
      `SELECT a.id, a.candidate_id, c.first_name, c.last_name, c.email,
              c.resume_url, c.skills, c.experience_years, j.title as job_title
       FROM applications a
       LEFT JOIN candidates c ON a.candidate_id = c.id
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1 AND j.employer_id = $2`,
      [applicationId, ctx.employerId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const userResult = await db.query(
      `SELECT id, first_name, last_name, email
       FROM users
       WHERE id = $1 AND employer_id = $2 AND is_active = true`,
      [assignedUserId, ctx.employerId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tagged user not found' });
    }

    const application = appResult.rows[0];
    const actor = await getActor(db, req.userId, ctx.employerId);
    const title = `${application.first_name || ''} ${application.last_name || ''}`.trim() || application.email || 'Candidate';

    const threadResult = await db.query(
      `INSERT INTO candidate_chat_threads (
         employer_id, application_id, candidate_id, assigned_user_id,
         created_by_user_id, title, last_message_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
       ON CONFLICT (employer_id, application_id, assigned_user_id)
       DO UPDATE SET updated_at = NOW(), last_message_at = NOW()
       RETURNING *`,
      [ctx.employerId, applicationId, application.candidate_id, assignedUserId, ctx.actorId, title]
    );

    const thread = threadResult.rows[0];
    const defaultMessage = `Tagged for review: ${title} (${application.job_title || 'No position'})`;
    const messageResult = await db.query(
      `INSERT INTO candidate_chat_messages (
         thread_id, employer_id, sender_id, sender_name, sender_email, message, metadata, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        thread.id,
        ctx.employerId,
        ctx.actorId,
        actor.actorName,
        actor.actorEmail,
        message || defaultMessage,
        JSON.stringify({ event_type: 'candidate_tagged', application }),
      ]
    );

    await db.query('UPDATE candidate_chat_threads SET last_message_at = NOW() WHERE id = $1', [thread.id]);

    const payload = { thread, message: messageResult.rows[0], application };
    io?.to(`user:${assignedUserId}`).emit('thread:created', payload);
    io?.to(`user:${ctx.actorId}`).emit('thread:created', payload);
    emitThread(io, thread.id, 'message:new', messageResult.rows[0]);

    res.status(201).json(payload);
  } catch (error) {
    console.error('Create chat thread error:', error);
    res.status(500).json({ error: 'Failed to create chat thread' });
  }
});

router.get('/:threadId/messages', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const thread = await getThreadAccess(db, req.params.threadId, req);
    if (!thread) {
      return res.status(404).json({ error: 'Chat thread not found' });
    }

    const result = await db.query(
      `SELECT *
       FROM candidate_chat_messages
       WHERE thread_id = $1 AND employer_id = $2
       ORDER BY created_at ASC`,
      [req.params.threadId, req.employerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

router.post('/:threadId/messages', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const io = req.app.locals.io;
  const { message } = req.body;

  try {
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const thread = await getThreadAccess(db, req.params.threadId, req);
    if (!thread) {
      return res.status(404).json({ error: 'Chat thread not found' });
    }

    const actor = await getActor(db, req.userId, req.employerId);
    const result = await db.query(
      `INSERT INTO candidate_chat_messages (
         thread_id, employer_id, sender_id, sender_name, sender_email, message, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [req.params.threadId, req.employerId, req.userId, actor.actorName, actor.actorEmail, message.trim()]
    );

    await db.query(
      `UPDATE candidate_chat_threads
       SET last_message_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [req.params.threadId]
    );

    const row = result.rows[0];
    emitThread(io, req.params.threadId, 'message:new', row);
    io?.to(`user:${thread.assigned_user_id}`).emit('thread:updated', { threadId: req.params.threadId, message: row });
    io?.to(`user:${thread.created_by_user_id}`).emit('thread:updated', { threadId: req.params.threadId, message: row });

    res.status(201).json(row);
  } catch (error) {
    console.error('Send chat message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/presence/online', authMiddleware, (req, res) => {
  const onlineUsers = req.app.locals.onlineUsers || new Map();
  res.json(Array.from(onlineUsers.values()).filter((user) => user.employerId === req.employerId));
});

module.exports = router;

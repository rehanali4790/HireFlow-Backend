require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const http = require('http');
const { Server } = require('socket.io');
const { getPermissionResources } = require('./config/permission-catalog');
const { auditLogMiddleware } = require('./middleware/audit-log');
const { verifyAuthToken } = require('./utils/auth-token');

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});
const onlineUsers = new Map();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// Lightweight compatibility migration for per-candidate pipeline skips
pool.query(`
  ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS skip_test BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_ai_interview BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_final_interview BOOLEAN DEFAULT false
`).then(() => {
  console.log('✅ Application pipeline skip columns ready');
}).catch((err) => {
  console.error('⚠️ Failed to ensure pipeline skip columns:', err.message);
});

async function ensurePermissionCatalog() {
  const resources = getPermissionResources();

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS permission_resources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'task',
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    for (const resource of resources) {
      await pool.query(
        `INSERT INTO permission_resources (id, name, description, category, sort_order, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           category = EXCLUDED.category,
           sort_order = EXCLUDED.sort_order,
           is_active = true,
           updated_at = NOW()`,
        [resource.id, resource.name, resource.description, resource.category, resource.sort_order]
      );
    }

    console.log('✅ Permission catalog ready');
  } catch (err) {
    console.error('⚠️ Failed to ensure permission catalog:', err.message);
  }
}

ensurePermissionCatalog();

async function ensureActivityLog() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        employer_id UUID NOT NULL,
        actor_name TEXT,
        actor_email TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        details JSONB,
        request_method TEXT,
        request_path TEXT,
        status_code INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      ALTER TABLE user_activity_log
      ADD COLUMN IF NOT EXISTS actor_name TEXT,
      ADD COLUMN IF NOT EXISTS actor_email TEXT,
      ADD COLUMN IF NOT EXISTS request_method TEXT,
      ADD COLUMN IF NOT EXISTS request_path TEXT,
      ADD COLUMN IF NOT EXISTS status_code INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_activity_log_employer_created
      ON user_activity_log (employer_id, created_at DESC)
    `);

    console.log('✅ Activity log table ready');
  } catch (err) {
    console.error('⚠️ Failed to ensure activity log table:', err.message);
  }
}

ensureActivityLog();

async function ensureFinalScoringMetadata() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS final_scoring (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID UNIQUE NOT NULL,
        parameters JSONB NOT NULL,
        final_score NUMERIC,
        ai_decision TEXT,
        recommendation TEXT,
        updated_by_name TEXT,
        updated_by_email TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      ALTER TABLE final_scoring
      ADD COLUMN IF NOT EXISTS updated_by_name TEXT,
      ADD COLUMN IF NOT EXISTS updated_by_email TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `);

    console.log('✅ Final scoring metadata ready');
  } catch (err) {
    console.error('⚠️ Failed to ensure final scoring metadata:', err.message);
  }
}

ensureFinalScoringMetadata();

async function ensureTenantUpdateMetadata() {
  try {
    for (const table of ['jobs', 'tests', 'applications', 'candidates']) {
      await pool.query(`
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS updated_by_name TEXT,
        ADD COLUMN IF NOT EXISTS updated_by_email TEXT
      `);
    }

    console.log('✅ Tenant update metadata columns ready');
  } catch (err) {
    console.error('⚠️ Failed to ensure tenant update metadata columns:', err.message);
  }
}

ensureTenantUpdateMetadata();

async function ensureCandidateChatTables() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS department TEXT,
      ADD COLUMN IF NOT EXISTS designation TEXT
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS candidate_chat_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employer_id UUID NOT NULL,
        application_id UUID NOT NULL,
        candidate_id UUID,
        assigned_user_id UUID,
        created_by_user_id UUID,
        title TEXT,
        status TEXT DEFAULT 'open',
        last_message_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (employer_id, application_id, assigned_user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS candidate_chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES candidate_chat_threads(id) ON DELETE CASCADE,
        employer_id UUID NOT NULL,
        sender_id UUID,
        sender_name TEXT,
        sender_email TEXT,
        message TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_candidate_chat_threads_employer
      ON candidate_chat_threads (employer_id, last_message_at DESC)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_candidate_chat_messages_thread
      ON candidate_chat_messages (thread_id, created_at ASC)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_chat_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employer_id UUID NOT NULL,
        participant_one_id UUID NOT NULL,
        participant_two_id UUID NOT NULL,
        participant_one_last_read_at TIMESTAMP,
        participant_two_last_read_at TIMESTAMP,
        last_message_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (employer_id, participant_one_id, participant_two_id)
      )
    `);

    await pool.query(`
      ALTER TABLE user_chat_threads
      ADD COLUMN IF NOT EXISTS participant_one_last_read_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS participant_two_last_read_at TIMESTAMP
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES user_chat_threads(id) ON DELETE CASCADE,
        employer_id UUID NOT NULL,
        sender_id UUID,
        sender_name TEXT,
        sender_email TEXT,
        message TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_chat_threads_employer
      ON user_chat_threads (employer_id, last_message_at DESC)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_chat_messages_thread
      ON user_chat_messages (thread_id, created_at ASC)
    `);

    console.log('✅ Candidate chat tables ready');
  } catch (err) {
    console.error('⚠️ Failed to ensure candidate chat tables:', err.message);
  }
}

ensureCandidateChatTables();

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-employer-id', 'x-user-id'],
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Make pool available to routes
app.locals.db = pool;
app.locals.io = io;
app.locals.onlineUsers = onlineUsers;

// Audit successful tenant mutations after routes finish.
app.use(auditLogMiddleware);

// Serve static files for uploads
app.use('/uploads', express.static('uploads'));

// Routes
const authMiddleware = require('./middleware/auth');
const { getUserPermissions } = require('./middleware/permissions');

app.use('/api/auth', require('./routes/auth'));
app.use('/api/employers', require('./routes/employers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/interviews', require('./routes/interviews'));
app.use('/api/ai-interviews', require('./routes/ai-interviews'));
app.use('/api/ai-speech', require('./routes/ai-speech'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/email-templates', require('./routes/email-templates'));
app.use('/api/bulk-upload', require('./routes/bulk-upload'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/chats', require('./routes/chats'));

// Permissions endpoint
app.get('/api/permissions/me', authMiddleware, getUserPermissions);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'HireFlow API is running',
    timestamp: new Date().toISOString(),
  });
});

io.use((socket, next) => {
  try {
    const { token, name, email } = socket.handshake.auth || {};
    const payload = verifyAuthToken(token);

    socket.data.employerId = payload.employerId;
    socket.data.userId = payload.userId;
    socket.data.name = name || 'User';
    socket.data.email = email || '';
    return next();
  } catch (error) {
    return next(new Error('Invalid socket auth'));
  }
});

io.on('connection', (socket) => {
  const { employerId, userId, name, email } = socket.data;
  onlineUsers.set(userId, { userId, name, email, socketId: socket.id, employerId, online: true });
  socket.join(`employer:${employerId}`);
  socket.join(`user:${userId}`);
  io.to(`employer:${employerId}`).emit('presence:update', Array.from(onlineUsers.values()).filter((user) => user.employerId === employerId));

  socket.on('thread:join', (threadId) => {
    if (threadId) socket.join(`thread:${threadId}`);
  });

  socket.on('thread:leave', (threadId) => {
    if (threadId) socket.leave(`thread:${threadId}`);
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    io.to(`employer:${employerId}`).emit('presence:update', Array.from(onlineUsers.values()).filter((user) => user.employerId === employerId));
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message,
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

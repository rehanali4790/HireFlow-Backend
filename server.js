require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-employer-id', 'x-user-id'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make pool available to routes
app.locals.db = pool;

// Serve static files for uploads
app.use('/uploads', express.static('uploads'));

// Routes
const authMiddleware = require('./middleware/auth');
const { getUserPermissions } = require('./middleware/permissions');

app.use('/api/auth', require('./routes/auth'));
app.use('/api/employers', require('./routes/employers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
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

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

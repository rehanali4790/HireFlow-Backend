# HireFlow Backend

Simple Node.js + Express + PostgreSQL backend for HireFlow ATS.

## Features

- ✅ JWT Authentication
- ✅ Job Management (CRUD)
- ✅ Application Management
- ✅ Candidate Management
- ✅ AI Resume Scoring (OpenAI)
- ✅ AI Interview System (OpenAI)
- ✅ Test Management
- ✅ Email Service (SMTP)
- ✅ Analytics Dashboard
- ✅ Bulk Upload
- ✅ Email Templates
- ✅ Approval Gates

## Tech Stack

- Node.js + Express
- PostgreSQL (via pg library)
- JWT for authentication
- OpenAI API for AI features
- Nodemailer for emails
- Multer for file uploads

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hireflow_db
DB_USER=postgres
DB_PASSWORD=your_password

# Server
PORT=3001
APP_URL=http://localhost:5173

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Email (SMTP)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password
```

### 3. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hireflow_db;

# Exit
\q
```

### 4. Run Database Schema

```bash
npm run db:setup
```

### 5. Seed Demo Data (Optional)

```bash
npm run db:seed
```

### 6. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will run on `http://localhost:3001`

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create employer account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (authenticated)
- `POST /api/auth/logout` - Logout (authenticated)

### Jobs

- `GET /api/jobs` - List jobs (public: active only, authenticated: all own jobs)
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs` - Create job (authenticated)
- `PUT /api/jobs/:id` - Update job (authenticated)
- `DELETE /api/jobs/:id` - Delete job (authenticated)
- `GET /api/jobs/:id/applications` - Get job applications (authenticated)

### Applications

- `GET /api/applications` - List applications (authenticated)
- `GET /api/applications/:id` - Get application details (authenticated)
- `POST /api/applications` - Submit application (public)
- `PATCH /api/applications/:id/status` - Update status (authenticated)
- `POST /api/applications/:id/approve` - Approve/reject at gate (authenticated)

### Candidates

- `GET /api/candidates` - List candidates (authenticated)
- `GET /api/candidates/:id` - Get candidate details (authenticated)

### Tests

- `GET /api/tests` - List tests (authenticated)
- `GET /api/tests/:id` - Get test details
- `POST /api/tests` - Create test (authenticated)
- `POST /api/tests/:id/submit` - Submit test (public)
- `GET /api/tests/:id/attempts` - Get test attempts (authenticated)

### Interviews

- `GET /api/interviews` - List interviews (authenticated)
- `GET /api/interviews/token/:token` - Get interview by token (public)
- `POST /api/interviews` - Create AI interview (authenticated)
- `POST /api/interviews/token/:token/start` - Start interview (public)
- `POST /api/interviews/token/:token/generate-question` - Generate AI question (public)
- `POST /api/interviews/token/:token/response` - Submit response (public)
- `POST /api/interviews/token/:token/evaluate` - Evaluate interview (public)
- `POST /api/interviews/token/:token/complete` - Complete interview (public)
- `POST /api/interviews/:applicationId/final` - Schedule final interview (authenticated)

### Analytics

- `GET /api/analytics/dashboard` - Dashboard stats (authenticated)
- `GET /api/analytics/jobs/:jobId` - Job-specific analytics (authenticated)

### Email Templates

- `GET /api/email-templates` - List templates (authenticated)
- `GET /api/email-templates/:id` - Get template (authenticated)
- `POST /api/email-templates` - Create template (authenticated)
- `PUT /api/email-templates/:id` - Update template (authenticated)
- `DELETE /api/email-templates/:id` - Delete template (authenticated)

### Bulk Upload

- `POST /api/bulk-upload/session` - Create upload session (authenticated)
- `POST /api/bulk-upload/candidates` - Upload candidates (authenticated)
- `GET /api/bulk-upload/session/:id` - Get session status (authenticated)
- `GET /api/bulk-upload/sessions` - List sessions (authenticated)

## AI Features

### Resume Scoring

When a candidate applies, the system automatically:
1. Analyzes resume against job requirements
2. Scores on skills match, experience, education
3. Provides recommendation (strong_yes, yes, maybe, no, strong_no)
4. Saves score to database
5. Updates application status to "screening"

### AI Interview

The AI interview system:
1. Generates contextual questions based on job requirements
2. Adapts questions based on candidate responses
3. Decides when to end interview (4-10 questions)
4. Evaluates technical, problem-solving, and communication skills
5. Provides detailed feedback and recommendation

## Email Service

Automated emails are sent for:
- Application confirmation
- Test invitation
- AI interview invitation
- Rejection notification

Configure SMTP settings in `.env` to enable email sending.

## Project Structure

```
HireFlow-Backend/
├── server.js              # Main server file
├── package.json           # Dependencies
├── .env                   # Environment variables
├── database/
│   └── schema.sql         # Database schema
├── middleware/
│   └── auth.js            # JWT authentication
├── routes/
│   ├── auth.js            # Authentication routes
│   ├── jobs.js            # Job routes
│   ├── applications.js    # Application routes
│   ├── candidates.js      # Candidate routes
│   ├── tests.js           # Test routes
│   ├── interviews.js      # Interview routes
│   ├── analytics.js       # Analytics routes
│   ├── email-templates.js # Email template routes
│   └── bulk-upload.js     # Bulk upload routes
├── services/
│   ├── ai-service.js      # OpenAI integration
│   └── email-service.js   # Email sending
├── scripts/
│   ├── setup-database.js  # Database setup script
│   └── seed-data.js       # Demo data seeding
└── utils/
    └── db.js              # Database utilities
```

## Testing

### Test Authentication

```bash
# Signup
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","companyName":"Test Company"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## License

MIT

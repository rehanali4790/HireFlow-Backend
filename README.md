# HireFlow Backend

Backend API for HireFlow - AI-Powered Hiring Platform built with NestJS and TypeScript.

## Tech Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Email**: Nodemailer
- **AI**: OpenAI API

## Project Structure

```
src/
├── database/           # Database connection and service
├── modules/
│   ├── auth/          # Authentication (login, signup, sessions)
│   ├── jobs/          # Job postings management
│   ├── applications/  # Application processing
│   ├── candidates/    # Candidate management
│   ├── tests/         # Technical tests
│   ├── interviews/    # AI & final interviews
│   ├── approvals/     # Approval workflows
│   ├── analytics/     # Dashboard analytics
│   └── email/         # Email notifications
├── app.module.ts      # Root module
└── main.ts            # Application entry point
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- OpenAI API key (for AI features)
- SMTP credentials (for email)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run database migrations:
```bash
# Use the migration scripts from the original project
# Located in ../migrations/
```

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hireflow_db
DB_USER=postgres
DB_PASSWORD=your_password

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_NAME=HireFlow
SMTP_FROM_EMAIL=your_email@gmail.com

# OpenAI
OPENAI_API_KEY=sk-...

# Application
APP_URL=http://localhost:3000
TOKEN_SECRET=your-secret-key
PORT=3001
NODE_ENV=development
```

## Running the Application

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### Testing
```bash
npm run test
npm run test:watch
npm run test:cov
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new employer account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session

### Jobs
- `GET /api/jobs` - List jobs (public: active only, authenticated: all)
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs` - Create job (auth required)
- `PUT /api/jobs/:id` - Update job (auth required)
- `DELETE /api/jobs/:id` - Delete job (auth required)

### Applications
- `POST /api/applications` - Submit application
- `GET /api/jobs/:jobId/applications` - Get applications for job
- `GET /api/applications/:id` - Get application details
- `PATCH /api/applications/:id/status` - Update application status

### Candidates
- `GET /api/candidates` - List candidates (auth required)
- `GET /api/candidates/:id` - Get candidate details

### Tests
- `GET /api/tests` - List tests
- `POST /api/tests` - Create test
- `PUT /api/tests/:id` - Update test
- `DELETE /api/tests/:id` - Delete test

### Interviews
- `GET /api/interviews` - List interviews
- `POST /api/interviews` - Create interview
- `PUT /api/interviews/:id` - Update interview

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard statistics

### Approvals
- `GET /api/approvals` - List pending approvals
- `POST /api/approvals/:applicationId` - Process approval

## Migration from Express

This backend is a NestJS refactor of the original Express server. Key improvements:

1. **Modular Architecture**: Code organized into feature modules
2. **Dependency Injection**: Better testability and maintainability
3. **Type Safety**: Full TypeScript support with decorators
4. **Built-in Validation**: Request validation with class-validator
5. **Scalability**: Better structure for growing applications

## TODO

The following features need to be migrated from the original Express server:

- [ ] Complete all controller endpoints
- [ ] Implement email service methods
- [ ] Add AI resume parsing
- [ ] Add AI test generation
- [ ] Add AI interview functionality
- [ ] Implement bulk upload
- [ ] Add file storage integration
- [ ] Add comprehensive error handling
- [ ] Add request validation DTOs
- [ ] Add API documentation (Swagger)
- [ ] Add unit and e2e tests

## Development Notes

- All database queries use the centralized `DatabaseService`
- Authentication uses token-based auth with `AuthGuard`
- Email templates are stored in the database
- AI features require OpenAI API key

## License

MIT

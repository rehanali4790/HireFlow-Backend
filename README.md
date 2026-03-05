# HireFlow Backend

Clean, production-ready NestJS backend with TypeORM for the HireFlow hiring platform.

## 🚀 Tech Stack

- **Framework**: NestJS 10
- **ORM**: TypeORM 0.3
- **Database**: PostgreSQL
- **Language**: TypeScript
- **Email**: Nodemailer
- **AI**: OpenAI API
- **Architecture**: Event-driven with modular design

## 📁 Project Structure

```
src/
├── database/
│   ├── database.module.ts      # Database configuration
│   ├── database.service.ts     # Raw query service (legacy)
│   └── ormconfig.ts            # TypeORM configuration
├── modules/
│   ├── auth/
│   │   ├── entities/
│   │   │   └── employer.entity.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.guard.ts
│   │   └── auth.module.ts
│   ├── jobs/
│   │   ├── entities/
│   │   │   └── job.entity.ts
│   │   ├── jobs.controller.ts
│   │   ├── jobs.service.ts
│   │   └── jobs.module.ts
│   ├── applications/
│   │   ├── entities/
│   │   │   └── application.entity.ts
│   │   └── ...
│   ├── candidates/
│   │   ├── entities/
│   │   │   └── candidate.entity.ts
│   │   └── ...
│   ├── tests/
│   ├── interviews/
│   ├── email/
│   ├── analytics/
│   └── approvals/
├── app.module.ts
└── main.ts
```

## 🔧 Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration
```

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hireflow_db
DB_USER=postgres
DB_PASSWORD=your_password

# Database Sync (IMPORTANT!)
# Set to true ONLY in development to auto-sync schema
# NEVER use true in production!
DB_SYNC=false

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
TOKEN_SECRET=your-secret-key-change-this
PORT=3001
NODE_ENV=development
```

## 🗄️ Database Setup

### Option 1: Auto-Sync (Development Only)

Set `DB_SYNC=true` in your `.env` file. TypeORM will automatically create/update tables based on your entities.

```bash
# Start the server - tables will be created automatically
npm run start:dev
```

⚠️ **WARNING**: Never use `DB_SYNC=true` in production! It can cause data loss.

### Option 2: Manual Migrations (Recommended for Production)

```bash
# Run existing migrations
npm run migrate

# Or use the migration scripts
node scripts/run-migrations.js
```

## 🏃 Running the Application

### Development Mode

```bash
npm run start:dev
```

Server runs on: http://localhost:3001

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

## 📚 API Endpoints

### Authentication

- `POST /api/auth/signup` - Create employer account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session

### Jobs

- `GET /api/jobs` - List jobs
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs` - Create job (auth required)
- `PUT /api/jobs/:id` - Update job (auth required)
- `DELETE /api/jobs/:id` - Delete job (auth required)

### Applications

- `POST /api/applications` - Submit application
- `GET /api/jobs/:jobId/applications` - Get applications
- `GET /api/applications/:id` - Get application details
- `PATCH /api/applications/:id/status` - Update status

### Health Check

- `GET /api/health` - Server health status

## 🎯 Key Features

### TypeORM Integration

All database operations use TypeORM entities and repositories:

```typescript
// Example: Creating a job
const job = this.jobRepository.create({
  title: 'Software Engineer',
  employerId: employer.id,
  // ...
});
await this.jobRepository.save(job);
```

### Entity Relationships

Entities are properly related:

- `Employer` → `Job` (One-to-Many)
- `Job` → `Application` (One-to-Many)
- `Candidate` → `Application` (One-to-Many)

### Event-Driven Architecture

Uses NestJS EventEmitter for cross-module communication:

```typescript
@OnEvent('application.created')
handleApplicationCreated(payload: ApplicationCreatedEvent) {
  // Send email, update analytics, etc.
}
```

### Validation

Automatic request validation using class-validator:

```typescript
export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEmail()
  contactEmail: string;
}
```

## 🔒 Security

- Password hashing with SHA-256
- Token-based authentication
- Auth guards for protected routes
- Input validation on all endpoints
- SQL injection protection (TypeORM)

## 📊 Database Schema

### Main Tables

- `employers` - Company accounts
- `jobs` - Job postings
- `candidates` - Candidate profiles
- `applications` - Job applications
- `tests` - Technical assessments
- `ai_interviews` - AI interview records
- `final_interviews` - Human interview scheduling
- `email_logs` - Email tracking
- `approval_gates` - Workflow approvals

## 🚀 Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Set `DB_SYNC=false` (CRITICAL!)
3. Use strong `TOKEN_SECRET`
4. Configure production database
5. Set up SSL for database connection

### Recommended Platforms

- **Railway**: Easy PostgreSQL + Node.js deployment
- **Heroku**: PostgreSQL addon available
- **AWS/DigitalOcean**: Full control
- **Render**: Free tier available

### Deployment Steps

```bash
# Build
npm run build

# Start production server
npm run start:prod
```

## 🔄 Migration from Old Code

The backend has been refactored from raw SQL queries to TypeORM:

**Before (Raw SQL)**:
```typescript
const result = await this.db.query(
  'SELECT * FROM jobs WHERE id = $1',
  [id]
);
```

**After (TypeORM)**:
```typescript
const job = await this.jobRepository.findOne({
  where: { id },
  relations: ['employer'],
});
```

### Benefits

- Type-safe database operations
- Automatic query building
- Easy relationship management
- Migration support
- Better testability

## 📝 Development Notes

### Adding New Entities

1. Create entity file in `modules/[module]/entities/`
2. Add entity to module's `TypeOrmModule.forFeature([])`
3. Inject repository in service
4. Use repository methods for CRUD operations

### Database Sync Toggle

The `DB_SYNC` environment variable controls schema synchronization:

- `DB_SYNC=true`: Auto-sync schema (development only)
- `DB_SYNC=false`: Manual migrations (production)

This allows easy development while maintaining production safety.

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
psql -U postgres -l

# Test connection
psql -U postgres -d hireflow_db
```

### TypeORM Sync Issues

If tables aren't created:
1. Check `DB_SYNC=true` in `.env`
2. Verify database credentials
3. Check entity decorators are correct
4. Look for TypeORM logs in console

### Port Already in Use

```bash
# Change port in .env
PORT=3002
```

## 📖 Documentation

Comprehensive documentation is available in the `docs/` folder:

- **[Setup Guide](./SETUP.md)** - Quick start guide
- **[Architecture](./docs/ARCHITECTURE.md)** - System design and patterns
- **[Database Schema](./docs/DATABASE_SCHEMA.md)** - Complete database structure
- **[API Documentation](./docs/API_DOCUMENTATION.md)** - All API endpoints
- **[Development Guide](./docs/DEVELOPMENT_GUIDE.md)** - How to develop features
- **[Code Standards](./docs/CODE_STANDARDS.md)** - Coding conventions
- **[Testing Guide](./docs/TESTING_GUIDE.md)** - How to write tests
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

### External Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

## 📄 License

MIT

---

**Built with ❤️ using NestJS and TypeORM**

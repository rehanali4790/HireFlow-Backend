# HireFlow Backend Architecture

## Overview

HireFlow backend is built with NestJS and follows a clean, modular architecture inspired by enterprise-grade applications.

## Tech Stack

- **Framework**: NestJS 10
- **Language**: TypeScript
- **ORM**: TypeORM 0.3
- **Database**: PostgreSQL
- **Email**: Nodemailer
- **AI**: OpenAI API
- **Validation**: class-validator
- **Events**: @nestjs/event-emitter

## Architecture Pattern

### Layered Architecture

```
┌─────────────────────────────────────┐
│         Controllers                 │  ← HTTP Layer (Routes)
├─────────────────────────────────────┤
│          Services                   │  ← Business Logic
├─────────────────────────────────────┤
│        Repositories                 │  ← Data Access (TypeORM)
├─────────────────────────────────────┤
│          Entities                   │  ← Data Models
├─────────────────────────────────────┤
│         PostgreSQL                  │  ← Database
└─────────────────────────────────────┘
```

### Module Structure

```
src/
├── database/                    # Database configuration
│   ├── database.module.ts
│   ├── database.service.ts      # Legacy raw query service
│   └── ormconfig.ts             # TypeORM config
│
├── modules/                     # Feature modules
│   ├── auth/                    # Authentication
│   │   ├── entities/
│   │   │   └── employer.entity.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.guard.ts
│   │   ├── auth.module.ts
│   │   └── current-employer.decorator.ts
│   │
│   ├── jobs/                    # Job management
│   │   ├── entities/
│   │   │   └── job.entity.ts
│   │   ├── jobs.controller.ts
│   │   ├── jobs.service.ts
│   │   └── jobs.module.ts
│   │
│   ├── applications/            # Application processing
│   ├── candidates/              # Candidate management
│   ├── tests/                   # Technical tests
│   ├── interviews/              # AI & final interviews
│   ├── email/                   # Email service
│   ├── analytics/               # Dashboard analytics
│   └── approvals/               # Approval workflows
│
├── app.module.ts                # Root module
└── main.ts                      # Application entry
```

## Design Patterns

### 1. Repository Pattern

All data access goes through TypeORM repositories:

```typescript
@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private jobRepository: Repository<Job>,
  ) {}

  async findAll() {
    return await this.jobRepository.find();
  }
}
```

### 2. Dependency Injection

NestJS handles all dependency injection:

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Job])],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
```

### 3. Event-Driven Architecture

Cross-module communication via events:

```typescript
// Emit event
this.eventEmitter.emit('application.created', { applicationId });

// Listen to event
@OnEvent('application.created')
handleApplicationCreated(payload) {
  // Send email, update analytics, etc.
}
```

### 4. Guard Pattern

Authentication via guards:

```typescript
@UseGuards(AuthGuard)
@Get('protected')
async protectedRoute(@CurrentEmployer() employer) {
  // Only authenticated users reach here
}
```

## Data Flow

### Request Flow

```
1. HTTP Request
   ↓
2. Controller (validates, routes)
   ↓
3. Guard (authentication check)
   ↓
4. Service (business logic)
   ↓
5. Repository (data access)
   ↓
6. Database (PostgreSQL)
   ↓
7. Response back up the chain
```

### Example: Create Job

```typescript
// 1. Controller receives request
@Post()
async createJob(@Body() data, @CurrentEmployer() employer) {
  return await this.jobsService.createJob(employer.id, data);
}

// 2. Service handles business logic
async createJob(employerId: string, data: Partial<Job>) {
  const job = this.jobRepository.create({ ...data, employerId });
  const saved = await this.jobRepository.save(job);
  
  // 3. Emit event for other modules
  this.eventEmitter.emit('job.created', { jobId: saved.id });
  
  return saved;
}

// 4. Other modules react to event
@OnEvent('job.created')
async handleJobCreated({ jobId }) {
  // Update analytics, send notifications, etc.
}
```

## Database Strategy

### Auto-Sync vs Migrations

**Development** (`DB_SYNC=true`):
- TypeORM automatically creates/updates tables
- Fast iteration
- No migration files needed

**Production** (`DB_SYNC=false`):
- Manual migrations required
- Safe, controlled schema changes
- No automatic modifications

### Entity Relationships

```typescript
// One-to-Many: Employer → Jobs
@Entity('employers')
export class Employer {
  @OneToMany(() => Job, (job) => job.employer)
  jobs: Job[];
}

@Entity('jobs')
export class Job {
  @ManyToOne(() => Employer, (employer) => employer.jobs)
  employer: Employer;
}
```

## Security

### Authentication Flow

```
1. User logs in with email/password
2. Server hashes password and verifies
3. Server generates random token
4. Token stored in database
5. Token returned to client
6. Client sends token in Authorization header
7. AuthGuard validates token on each request
```

### Password Hashing

```typescript
// SHA-256 with secret salt
const hash = crypto
  .createHash('sha256')
  .update(password + TOKEN_SECRET)
  .digest('hex');
```

## Error Handling

### Global Exception Filter

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Log error
    // Format response
    // Return appropriate status code
  }
}
```

## Performance Considerations

### Database Connection Pooling

```typescript
extra: {
  max: 20,                      // Max connections
  idleTimeoutMillis: 30000,     // Close idle connections
  connectionTimeoutMillis: 2000 // Connection timeout
}
```

### Query Optimization

- Use `select` to limit fields
- Use `relations` to eager load
- Use indexes on frequently queried fields
- Avoid N+1 queries with proper joins

## Scalability

### Horizontal Scaling

- Stateless design (no session storage)
- Database connection pooling
- Event-driven for async processing
- Can run multiple instances behind load balancer

### Vertical Scaling

- Efficient TypeORM queries
- Connection pooling
- Async/await for non-blocking I/O

## Future Enhancements

### Planned Improvements

1. **Caching Layer**: Redis for frequently accessed data
2. **Queue System**: Bull for background jobs
3. **Microservices**: Split into smaller services if needed
4. **GraphQL**: Alternative to REST API
5. **WebSockets**: Real-time updates
6. **Rate Limiting**: Prevent abuse
7. **API Versioning**: Support multiple API versions

## Best Practices

### Module Design

- One feature per module
- Clear boundaries
- Minimal coupling
- Export only what's needed

### Service Design

- Single responsibility
- Inject dependencies
- Return DTOs, not entities
- Handle errors gracefully

### Controller Design

- Thin controllers
- Validation via DTOs
- Use guards for auth
- Return consistent responses

---

**Reference**: This architecture is inspired by [Blocks-Backend](https://github.com/itxsamad1/Blocks-Backend)

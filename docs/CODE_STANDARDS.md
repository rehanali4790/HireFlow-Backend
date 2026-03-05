# Code Standards

Coding conventions and best practices for HireFlow backend.

## TypeScript Standards

### Type Safety

```typescript
// ✅ Good - Explicit types
function calculateScore(score: number): number {
  return score * 100;
}

// ❌ Bad - Implicit any
function calculateScore(score) {
  return score * 100;
}
```

### Interfaces vs Types

```typescript
// Use interfaces for object shapes
interface User {
  id: string;
  name: string;
}

// Use types for unions, intersections
type Status = 'active' | 'inactive' | 'pending';
type UserWithStatus = User & { status: Status };
```

### Avoid Any

```typescript
// ❌ Bad
function process(data: any) {
  return data.value;
}

// ✅ Good
interface Data {
  value: string;
}

function process(data: Data) {
  return data.value;
}
```

## NestJS Patterns

### Dependency Injection

```typescript
// ✅ Good - Constructor injection
@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private jobRepository: Repository<Job>,
    private emailService: EmailService,
  ) {}
}

// ❌ Bad - Direct instantiation
@Injectable()
export class JobsService {
  private emailService = new EmailService();
}
```

### Service Layer

```typescript
// ✅ Good - Business logic in service
@Injectable()
export class JobsService {
  async createJob(employerId: string, data: CreateJobDto): Promise<Job> {
    // Validation
    if (!data.title) {
      throw new BadRequestException('Title is required');
    }

    // Business logic
    const job = this.jobRepository.create({
      ...data,
      employerId,
      status: 'draft',
    });

    // Save
    const saved = await this.jobRepository.save(job);

    // Events
    this.eventEmitter.emit('job.created', { jobId: saved.id });

    return saved;
  }
}

// ❌ Bad - Business logic in controller
@Controller('jobs')
export class JobsController {
  @Post()
  async create(@Body() data: CreateJobDto) {
    if (!data.title) {
      throw new BadRequestException('Title is required');
    }
    const job = this.jobRepository.create(data);
    return await this.jobRepository.save(job);
  }
}
```

### Controller Layer

```typescript
// ✅ Good - Thin controller
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(
    @Body() data: CreateJobDto,
    @CurrentEmployer() employer: Employer,
  ): Promise<Job> {
    return await this.jobsService.createJob(employer.id, data);
  }
}
```

## Entity Design

### Column Definitions

```typescript
@Entity('jobs')
export class Job {
  // ✅ Good - Explicit column options
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  salaryMin: number;

  @Column({ type: 'simple-array', default: [] })
  skillsRequired: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Relationships

```typescript
// ✅ Good - Bidirectional with cascade
@Entity('employers')
export class Employer {
  @OneToMany(() => Job, (job) => job.employer, { cascade: true })
  jobs: Job[];
}

@Entity('jobs')
export class Job {
  @ManyToOne(() => Employer, (employer) => employer.jobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employerId' })
  employer: Employer;

  @Column()
  employerId: string;
}
```

## Error Handling

### Use NestJS Exceptions

```typescript
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

// ✅ Good
async findOne(id: string): Promise<Job> {
  const job = await this.jobRepository.findOne({ where: { id } });
  if (!job) {
    throw new NotFoundException(`Job with ID ${id} not found`);
  }
  return job;
}

// ❌ Bad
async findOne(id: string): Promise<Job> {
  const job = await this.jobRepository.findOne({ where: { id } });
  if (!job) {
    throw new Error('Not found');
  }
  return job;
}
```

### Custom Error Messages

```typescript
// ✅ Good - Descriptive messages
throw new BadRequestException('Email is already registered');
throw new UnauthorizedException('Invalid credentials');
throw new ForbiddenException('You do not have permission to access this resource');

// ❌ Bad - Generic messages
throw new BadRequestException('Error');
throw new UnauthorizedException('Unauthorized');
```

## Validation

### Use DTOs

```typescript
import { IsString, IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateEmployerDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsOptional()
  companyDescription?: string;
}
```

### Validation Pipes

```typescript
// Enable globally in main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

## Async/Await

### Always Use Async/Await

```typescript
// ✅ Good
async createJob(data: CreateJobDto): Promise<Job> {
  const job = this.jobRepository.create(data);
  return await this.jobRepository.save(job);
}

// ❌ Bad - Promises
createJob(data: CreateJobDto): Promise<Job> {
  return this.jobRepository.create(data).then(job => {
    return this.jobRepository.save(job);
  });
}
```

### Error Handling

```typescript
// ✅ Good
async createJob(data: CreateJobDto): Promise<Job> {
  try {
    const job = this.jobRepository.create(data);
    return await this.jobRepository.save(job);
  } catch (error) {
    throw new BadRequestException('Failed to create job');
  }
}
```

## Database Queries

### Use Query Builder for Complex Queries

```typescript
// ✅ Good
async findActiveJobs(location: string): Promise<Job[]> {
  return await this.jobRepository
    .createQueryBuilder('job')
    .leftJoinAndSelect('job.employer', 'employer')
    .where('job.status = :status', { status: 'active' })
    .andWhere('job.location ILIKE :location', { location: `%${location}%` })
    .orderBy('job.createdAt', 'DESC')
    .getMany();
}

// ❌ Bad - Multiple queries
async findActiveJobs(location: string): Promise<Job[]> {
  const jobs = await this.jobRepository.find({
    where: { status: 'active' },
  });
  return jobs.filter(job => job.location.includes(location));
}
```

### Avoid N+1 Queries

```typescript
// ✅ Good - Eager loading
const jobs = await this.jobRepository.find({
  relations: ['employer', 'applications'],
});

// ❌ Bad - N+1 problem
const jobs = await this.jobRepository.find();
for (const job of jobs) {
  job.employer = await this.employerRepository.findOne(job.employerId);
}
```

## Security

### Password Hashing

```typescript
import * as crypto from 'crypto';

// ✅ Good
function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + process.env.TOKEN_SECRET)
    .digest('hex');
}

// ❌ Bad - Plain text
function hashPassword(password: string): string {
  return password;
}
```

### Input Sanitization

```typescript
// ✅ Good - Use DTOs with validation
@Post()
async create(@Body() dto: CreateJobDto) {
  return await this.jobsService.create(dto);
}

// ❌ Bad - Raw body
@Post()
async create(@Body() body: any) {
  return await this.jobsService.create(body);
}
```

### SQL Injection Prevention

```typescript
// ✅ Good - Parameterized queries
await this.jobRepository
  .createQueryBuilder('job')
  .where('job.title = :title', { title: userInput })
  .getMany();

// ❌ Bad - String concatenation
await this.jobRepository.query(
  `SELECT * FROM jobs WHERE title = '${userInput}'`
);
```

## Code Organization

### File Structure

```
modules/
└── jobs/
    ├── entities/
    │   └── job.entity.ts
    ├── dto/
    │   ├── create-job.dto.ts
    │   └── update-job.dto.ts
    ├── jobs.controller.ts
    ├── jobs.service.ts
    ├── jobs.module.ts
    └── jobs.controller.spec.ts
```

### Naming Conventions

```typescript
// Files
job.entity.ts
jobs.service.ts
jobs.controller.ts
create-job.dto.ts

// Classes
class Job {}
class JobsService {}
class JobsController {}
class CreateJobDto {}

// Functions
function createJob() {}
function findAllJobs() {}

// Constants
const MAX_JOBS = 100;
const DEFAULT_STATUS = 'draft';
```

## Comments

### When to Comment

```typescript
// ✅ Good - Complex logic
// Calculate weighted score based on resume (40%), test (30%), interview (30%)
const overallScore = 
  (resumeScore * 0.4) + 
  (testScore * 0.3) + 
  (interviewScore * 0.3);

// ✅ Good - Business rules
// Applications older than 90 days are automatically archived
if (daysSinceApplication > 90) {
  await this.archiveApplication(application.id);
}

// ❌ Bad - Obvious comments
// Create a job
const job = await this.jobRepository.create(data);
```

### JSDoc for Public APIs

```typescript
/**
 * Creates a new job posting
 * @param employerId - The ID of the employer creating the job
 * @param data - Job data
 * @returns The created job
 * @throws BadRequestException if validation fails
 */
async createJob(employerId: string, data: CreateJobDto): Promise<Job> {
  // Implementation
}
```

## Testing

### Test Naming

```typescript
describe('JobsService', () => {
  describe('createJob', () => {
    it('should create a job successfully', async () => {
      // Test
    });

    it('should throw BadRequestException if title is missing', async () => {
      // Test
    });

    it('should emit job.created event', async () => {
      // Test
    });
  });
});
```

### Test Structure

```typescript
it('should create a job successfully', async () => {
  // Arrange
  const data = { title: 'Software Engineer' };
  mockRepository.save.mockResolvedValue({ id: '1', ...data });

  // Act
  const result = await service.createJob('employer-1', data);

  // Assert
  expect(result).toEqual({ id: '1', ...data });
  expect(mockRepository.save).toHaveBeenCalledWith(data);
});
```

## Environment Variables

### Use ConfigService

```typescript
// ✅ Good
constructor(private configService: ConfigService) {}

const apiKey = this.configService.get<string>('OPENAI_API_KEY');
const port = this.configService.get<number>('PORT', 3001);

// ❌ Bad
const apiKey = process.env.OPENAI_API_KEY;
```

### Validate Environment

```typescript
// In app.module.ts
ConfigModule.forRoot({
  validationSchema: Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test'),
    PORT: Joi.number().default(3001),
    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().default(5432),
  }),
});
```

## Logging

### Use Logger

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  async createJob(data: CreateJobDto): Promise<Job> {
    this.logger.log(`Creating job: ${data.title}`);
    
    try {
      const job = await this.jobRepository.save(data);
      this.logger.log(`Job created: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to create job: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

## Performance

### Use Indexes

```typescript
@Entity('jobs')
@Index(['status', 'createdAt'])
export class Job {
  @Index()
  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### Pagination

```typescript
async findAll(page: number = 1, limit: number = 20): Promise<Job[]> {
  return await this.jobRepository.find({
    skip: (page - 1) * limit,
    take: limit,
    order: { createdAt: 'DESC' },
  });
}
```

### Caching (Future)

```typescript
@Injectable()
export class JobsService {
  @Cacheable({ ttl: 300 })
  async findAll(): Promise<Job[]> {
    return await this.jobRepository.find();
  }
}
```

---

**Follow these standards to maintain clean, consistent, and maintainable code!**

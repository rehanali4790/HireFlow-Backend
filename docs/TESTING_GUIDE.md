# Testing Guide

Complete guide for testing HireFlow backend.

## Testing Stack

- **Framework**: Jest
- **E2E Testing**: Supertest
- **Mocking**: Jest mocks
- **Coverage**: Jest coverage

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:cov

# Run specific test file
npm run test -- jobs.service.spec.ts
```

## Unit Testing

### Service Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobsService } from './jobs.service';
import { Job } from './entities/job.entity';
import { NotFoundException } from '@nestjs/common';

describe('JobsService', () => {
  let service: JobsService;
  let repository: Repository<Job>;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: getRepositoryToken(Job),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    repository = module.get<Repository<Job>>(getRepositoryToken(Job));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return an array of jobs', async () => {
      const jobs = [
        { id: '1', title: 'Software Engineer' },
        { id: '2', title: 'Product Manager' },
      ];
      mockRepository.find.mockResolvedValue(jobs);

      const result = await service.findAll();

      expect(result).toEqual(jobs);
      expect(mockRepository.find).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no jobs exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a job by id', async () => {
      const job = { id: '1', title: 'Software Engineer' };
      mockRepository.findOne.mockResolvedValue(job);

      const result = await service.findOne('1');

      expect(result).toEqual(job);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw NotFoundException when job not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new job', async () => {
      const createJobDto = { title: 'Software Engineer', description: 'Great job' };
      const savedJob = { id: '1', ...createJobDto };

      mockRepository.create.mockReturnValue(createJobDto);
      mockRepository.save.mockResolvedValue(savedJob);

      const result = await service.create('employer-1', createJobDto);

      expect(result).toEqual(savedJob);
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createJobDto,
        employerId: 'employer-1',
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a job', async () => {
      const updateData = { title: 'Senior Software Engineer' };
      const updatedJob = { id: '1', ...updateData };

      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValue(updatedJob);

      const result = await service.update('1', updateData);

      expect(result).toEqual(updatedJob);
      expect(mockRepository.update).toHaveBeenCalledWith('1', updateData);
    });
  });

  describe('remove', () => {
    it('should delete a job', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('1');

      expect(mockRepository.delete).toHaveBeenCalledWith('1');
    });
  });
});
```

### Controller Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { AuthGuard } from '../auth/auth.guard';

describe('JobsController', () => {
  let controller: JobsController;
  let service: JobsService;

  const mockJobsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<JobsController>(JobsController);
    service = module.get<JobsService>(JobsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return an array of jobs', async () => {
      const jobs = [{ id: '1', title: 'Software Engineer' }];
      mockJobsService.findAll.mockResolvedValue(jobs);

      const result = await controller.findAll();

      expect(result).toEqual(jobs);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single job', async () => {
      const job = { id: '1', title: 'Software Engineer' };
      mockJobsService.findOne.mockResolvedValue(job);

      const result = await controller.findOne('1');

      expect(result).toEqual(job);
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('create', () => {
    it('should create a new job', async () => {
      const createJobDto = { title: 'Software Engineer' };
      const employer = { id: 'employer-1' };
      const createdJob = { id: '1', ...createJobDto };

      mockJobsService.create.mockResolvedValue(createdJob);

      const result = await controller.create(createJobDto, employer);

      expect(result).toEqual(createdJob);
      expect(service.create).toHaveBeenCalledWith(employer.id, createJobDto);
    });
  });
});
```

## E2E Testing

### Setup Test Database

```typescript
// test/setup.ts
import { DataSource } from 'typeorm';

export const setupTestDatabase = async () => {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'password',
    database: 'hireflow_test',
    entities: ['src/**/*.entity.ts'],
    synchronize: true,
  });

  await dataSource.initialize();
  return dataSource;
};

export const cleanupTestDatabase = async (dataSource: DataSource) => {
  await dataSource.dropDatabase();
  await dataSource.destroy();
};
```

### E2E Test Example

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { setupTestDatabase, cleanupTestDatabase } from './setup';
import { DataSource } from 'typeorm';

describe('JobsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;

  beforeAll(async () => {
    dataSource = await setupTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create test user and get token
    const signupResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'password123',
        companyName: 'Test Company',
      });

    authToken = signupResponse.body.token;
  });

  afterAll(async () => {
    await cleanupTestDatabase(dataSource);
    await app.close();
  });

  describe('/jobs (GET)', () => {
    it('should return all jobs', () => {
      return request(app.getHttpServer())
        .get('/jobs')
        .expect(200)
        .expect('Content-Type', /json/)
        .then((response) => {
          expect(Array.isArray(response.body)).toBe(true);
        });
    });
  });

  describe('/jobs (POST)', () => {
    it('should create a new job', () => {
      return request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Software Engineer',
          description: 'Great opportunity',
          location: 'San Francisco',
          workType: 'full-time',
          remotePolicy: 'hybrid',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('id');
          expect(response.body.title).toBe('Software Engineer');
        });
    });

    it('should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .post('/jobs')
        .send({
          title: 'Software Engineer',
        })
        .expect(401);
    });

    it('should return 400 with invalid data', () => {
      return request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
        })
        .expect(400);
    });
  });

  describe('/jobs/:id (GET)', () => {
    it('should return a single job', async () => {
      // Create a job first
      const createResponse = await request(app.getHttpServer())
        .post('/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Job',
          description: 'Test description',
        });

      const jobId = createResponse.body.id;

      return request(app.getHttpServer())
        .get(`/jobs/${jobId}`)
        .expect(200)
        .then((response) => {
          expect(response.body.id).toBe(jobId);
          expect(response.body.title).toBe('Test Job');
        });
    });

    it('should return 404 for non-existent job', () => {
      return request(app.getHttpServer())
        .get('/jobs/non-existent-id')
        .expect(404);
    });
  });
});
```

## Integration Testing

### Testing with Real Database

```typescript
describe('JobsService Integration', () => {
  let service: JobsService;
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await setupTestDatabase();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'password',
          database: 'hireflow_test',
          entities: [Job, Employer],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Job]),
      ],
      providers: [JobsService],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  afterAll(async () => {
    await cleanupTestDatabase(dataSource);
  });

  it('should create and retrieve a job', async () => {
    const jobData = {
      title: 'Software Engineer',
      description: 'Great job',
      employerId: 'test-employer-id',
    };

    const created = await service.create('test-employer-id', jobData);
    expect(created).toHaveProperty('id');

    const retrieved = await service.findOne(created.id);
    expect(retrieved.title).toBe(jobData.title);
  });
});
```

## Mocking

### Mocking External Services

```typescript
describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter;

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: '123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: 'MAIL_TRANSPORTER',
          useValue: mockTransporter,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should send email', async () => {
    await service.sendEmail('test@example.com', 'Subject', 'Body');

    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'Subject',
      html: 'Body',
    });
  });
});
```

### Mocking Events

```typescript
describe('JobsService with Events', () => {
  let service: JobsService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        JobsService,
        {
          provide: getRepositoryToken(Job),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should emit job.created event', async () => {
    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    await service.create('employer-1', { title: 'Test Job' });

    expect(emitSpy).toHaveBeenCalledWith('job.created', expect.any(Object));
  });
});
```

## Test Coverage

### Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

### Generate Coverage Report

```bash
npm run test:cov
```

View report at `coverage/lcov-report/index.html`

### Coverage Configuration

```json
// package.json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "statements": 80,
        "branches": 75,
        "functions": 80,
        "lines": 80
      }
    }
  }
}
```

## Best Practices

### 1. Test Naming

```typescript
// ✅ Good
it('should create a job successfully', () => {});
it('should throw NotFoundException when job not found', () => {});
it('should return 401 without auth token', () => {});

// ❌ Bad
it('test 1', () => {});
it('works', () => {});
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should create a job', async () => {
  // Arrange
  const jobData = { title: 'Software Engineer' };
  mockRepository.save.mockResolvedValue({ id: '1', ...jobData });

  // Act
  const result = await service.create('employer-1', jobData);

  // Assert
  expect(result).toEqual({ id: '1', ...jobData });
  expect(mockRepository.save).toHaveBeenCalled();
});
```

### 3. Test One Thing

```typescript
// ✅ Good - Tests one behavior
it('should return 404 when job not found', async () => {
  mockRepository.findOne.mockResolvedValue(null);
  await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
});

// ❌ Bad - Tests multiple things
it('should handle jobs', async () => {
  // Tests creation, retrieval, update, and deletion
});
```

### 4. Use Descriptive Test Data

```typescript
// ✅ Good
const validJobData = {
  title: 'Software Engineer',
  description: 'Full-stack developer position',
  location: 'San Francisco',
};

// ❌ Bad
const data = { a: 'b', c: 'd' };
```

### 5. Clean Up After Tests

```typescript
afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await dataSource.destroy();
  await app.close();
});
```

## Debugging Tests

### Run Single Test

```bash
npm run test -- --testNamePattern="should create a job"
```

### Debug in VS Code

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal"
}
```

### Enable Verbose Output

```bash
npm run test -- --verbose
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: hireflow_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:cov
      - run: npm run test:e2e
```

---

**Write tests, ship with confidence!** 🧪

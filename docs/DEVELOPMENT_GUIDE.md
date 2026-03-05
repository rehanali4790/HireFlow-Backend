# Development Guide

Complete guide for developing features in HireFlow backend.

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn
- Git

### Initial Setup

```bash
# Clone and install
git clone <repo-url>
cd HireFlow-Backend
npm install

# Setup database
psql -U postgres -c "CREATE DATABASE hireflow_db;"

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development server
npm run start:dev
```

## Development Workflow

### 1. Create a New Feature

```bash
# Create a new module
nest g module modules/feature-name
nest g controller modules/feature-name
nest g service modules/feature-name
```

### 2. Define Entity

Create entity in `modules/feature-name/entities/`:

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('table_name')
export class FeatureName {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 3. Register Entity

In `modules/feature-name/feature-name.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureName } from './entities/feature-name.entity';
import { FeatureNameService } from './feature-name.service';
import { FeatureNameController } from './feature-name.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureName])],
  controllers: [FeatureNameController],
  providers: [FeatureNameService],
  exports: [FeatureNameService],
})
export class FeatureNameModule {}
```

### 4. Implement Service

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureName } from './entities/feature-name.entity';

@Injectable()
export class FeatureNameService {
  constructor(
    @InjectRepository(FeatureName)
    private featureRepository: Repository<FeatureName>,
  ) {}

  async findAll(): Promise<FeatureName[]> {
    return await this.featureRepository.find();
  }

  async findOne(id: string): Promise<FeatureName> {
    return await this.featureRepository.findOne({ where: { id } });
  }

  async create(data: Partial<FeatureName>): Promise<FeatureName> {
    const entity = this.featureRepository.create(data);
    return await this.featureRepository.save(entity);
  }

  async update(id: string, data: Partial<FeatureName>): Promise<FeatureName> {
    await this.featureRepository.update(id, data);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.featureRepository.delete(id);
  }
}
```

### 5. Implement Controller

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { FeatureNameService } from './feature-name.service';
import { FeatureName } from './entities/feature-name.entity';

@Controller('feature-name')
export class FeatureNameController {
  constructor(private readonly featureNameService: FeatureNameService) {}

  @Get()
  async findAll(): Promise<FeatureName[]> {
    return await this.featureNameService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<FeatureName> {
    return await this.featureNameService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  async create(@Body() data: Partial<FeatureName>): Promise<FeatureName> {
    return await this.featureNameService.create(data);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id') id: string,
    @Body() data: Partial<FeatureName>,
  ): Promise<FeatureName> {
    return await this.featureNameService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.featureNameService.remove(id);
  }
}
```

### 6. Register Module

In `app.module.ts`:

```typescript
import { FeatureNameModule } from './modules/feature-name/feature-name.module';

@Module({
  imports: [
    // ... other modules
    FeatureNameModule,
  ],
})
export class AppModule {}
```

## Common Patterns

### Adding Relationships

```typescript
// One-to-Many
@Entity('parent')
export class Parent {
  @OneToMany(() => Child, (child) => child.parent)
  children: Child[];
}

@Entity('child')
export class Child {
  @ManyToOne(() => Parent, (parent) => parent.children)
  parent: Parent;
}

// Many-to-Many
@Entity('user')
export class User {
  @ManyToMany(() => Role)
  @JoinTable()
  roles: Role[];
}
```

### Using Events

```typescript
// Emit event
import { EventEmitter2 } from '@nestjs/event-emitter';

constructor(private eventEmitter: EventEmitter2) {}

async create(data) {
  const entity = await this.repository.save(data);
  this.eventEmitter.emit('entity.created', { id: entity.id });
  return entity;
}

// Listen to event
import { OnEvent } from '@nestjs/event-emitter';

@OnEvent('entity.created')
handleEntityCreated(payload: { id: string }) {
  // React to event
}
```

### Adding Validation

```typescript
import { IsString, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;
}

// Use in controller
@Post()
async create(@Body() dto: CreateFeatureDto) {
  return await this.service.create(dto);
}
```

### Error Handling

```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';

async findOne(id: string) {
  const entity = await this.repository.findOne({ where: { id } });
  if (!entity) {
    throw new NotFoundException(`Entity with ID ${id} not found`);
  }
  return entity;
}
```

## Testing

### Unit Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeatureNameService } from './feature-name.service';
import { FeatureName } from './entities/feature-name.entity';

describe('FeatureNameService', () => {
  let service: FeatureNameService;
  let mockRepository;

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureNameService,
        {
          provide: getRepositoryToken(FeatureName),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<FeatureNameService>(FeatureNameService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find all entities', async () => {
    const entities = [{ id: '1', name: 'Test' }];
    mockRepository.find.mockResolvedValue(entities);

    const result = await service.findAll();
    expect(result).toEqual(entities);
  });
});
```

### E2E Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('FeatureNameController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/feature-name (GET)', () => {
    return request(app.getHttpServer())
      .get('/feature-name')
      .expect(200)
      .expect('Content-Type', /json/);
  });
});
```

## Database Operations

### Querying

```typescript
// Find all
await this.repository.find();

// Find with conditions
await this.repository.find({ where: { status: 'active' } });

// Find with relations
await this.repository.find({ relations: ['employer', 'applications'] });

// Find one
await this.repository.findOne({ where: { id } });

// Find with custom query
await this.repository
  .createQueryBuilder('job')
  .where('job.status = :status', { status: 'active' })
  .andWhere('job.salaryMax > :salary', { salary: 100000 })
  .getMany();
```

### Transactions

```typescript
import { DataSource } from 'typeorm';

constructor(private dataSource: DataSource) {}

async createWithTransaction(data) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const entity = await queryRunner.manager.save(Entity, data);
    const related = await queryRunner.manager.save(Related, { entityId: entity.id });
    
    await queryRunner.commitTransaction();
    return entity;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

## Environment Variables

Always use environment variables for configuration:

```typescript
// In service
constructor(private configService: ConfigService) {}

const apiKey = this.configService.get<string>('OPENAI_API_KEY');
```

## Debugging

### Enable Debug Logging

In `ormconfig.ts`:

```typescript
logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
```

### VS Code Debug Configuration

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeArgs": ["--nolazy", "-r", "ts-node/register"],
      "args": ["${workspaceFolder}/src/main.ts"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

## Code Style

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces**: `IPascalCase` or `PascalCase`

### File Organization

```
module/
├── entities/
│   └── entity.entity.ts
├── dto/
│   ├── create-entity.dto.ts
│   └── update-entity.dto.ts
├── module.controller.ts
├── module.service.ts
├── module.module.ts
└── module.controller.spec.ts
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/feature-name

# Make changes and commit
git add .
git commit -m "feat: add feature description"

# Push to remote
git push origin feature/feature-name

# Create pull request
```

### Commit Message Format

```
feat: add new feature
fix: fix bug description
docs: update documentation
refactor: refactor code
test: add tests
chore: update dependencies
```

## Performance Tips

1. **Use select to limit fields**
   ```typescript
   await this.repository.find({ select: ['id', 'name'] });
   ```

2. **Use indexes on frequently queried fields**
   ```typescript
   @Index()
   @Column()
   email: string;
   ```

3. **Avoid N+1 queries**
   ```typescript
   // Bad
   const jobs = await this.jobRepository.find();
   for (const job of jobs) {
     job.employer = await this.employerRepository.findOne(job.employerId);
   }

   // Good
   const jobs = await this.jobRepository.find({ relations: ['employer'] });
   ```

4. **Use pagination**
   ```typescript
   await this.repository.find({ skip: 0, take: 20 });
   ```

## Deployment Checklist

- [ ] Set `DB_SYNC=false`
- [ ] Use strong `TOKEN_SECRET`
- [ ] Configure production database
- [ ] Set up SSL for database connection
- [ ] Configure CORS properly
- [ ] Set up logging
- [ ] Configure rate limiting
- [ ] Set up monitoring
- [ ] Create database backups
- [ ] Test all endpoints

---

**Happy coding!** 🚀

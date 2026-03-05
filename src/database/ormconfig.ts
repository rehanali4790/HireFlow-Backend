// src/database/ormconfig.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { Employer } from '../modules/auth/entities/employer.entity';
import { Job } from '../modules/jobs/entities/job.entity';
import { Application } from '../modules/applications/entities/application.entity';
import { Candidate } from '../modules/candidates/entities/candidate.entity';

dotenv.config();

const config: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'hireflow_db',
  
  // Explicitly list all entities
  entities: [Employer, Job, Application, Candidate],
  
  // Enable synchronize based on DB_SYNC environment variable
  // WARNING: This will auto-create/update tables based on entities
  // Only use in development! Set DB_SYNC=false in production
  synchronize: process.env.DB_SYNC === 'true',
  
  // Log SQL queries in development for debugging
  logging: process.env.NODE_ENV !== 'production' ? ['error', 'warn', 'schema'] : ['error'],
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // Connection pool settings
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
};

export default config;

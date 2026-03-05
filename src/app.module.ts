import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { TestsModule } from './modules/tests/tests.module';
import { InterviewsModule } from './modules/interviews/interviews.module';
import { EmailModule } from './modules/email/email.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    JobsModule,
    ApplicationsModule,
    CandidatesModule,
    TestsModule,
    InterviewsModule,
    EmailModule,
    AnalyticsModule,
    ApprovalsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

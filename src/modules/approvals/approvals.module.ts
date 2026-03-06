import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { AuthModule } from '../auth/auth.module';
import { Application } from '../applications/entities/application.entity';
import { Job } from '../jobs/entities/job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Job]),
    AuthModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule { }

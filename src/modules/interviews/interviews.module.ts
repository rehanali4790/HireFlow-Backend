import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { AIInterview } from './entities/ai-interview.entity';
import { FinalInterview } from './entities/final-interview.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([AIInterview, FinalInterview]), AuthModule],
  controllers: [InterviewsController],
  providers: [InterviewsService],
})
export class InterviewsModule { }

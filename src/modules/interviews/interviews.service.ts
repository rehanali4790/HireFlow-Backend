import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIInterview } from './entities/ai-interview.entity';
import { FinalInterview } from './entities/final-interview.entity';

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(AIInterview)
    private aiInterviewRepository: Repository<AIInterview>,
    @InjectRepository(FinalInterview)
    private finalInterviewRepository: Repository<FinalInterview>,
  ) { }

  async getAIInterviews(employerId: string) {
    return await this.aiInterviewRepository.find({
      where: { job: { employerId } },
      relations: ['job', 'candidate', 'application'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFinalInterviews(employerId: string) {
    return await this.finalInterviewRepository.find({
      where: { employerId },
      relations: ['job', 'candidate', 'application'],
      order: { scheduledAt: 'ASC' },
    });
  }

  async createFinalInterview(employerId: string, data: any) {
    const interview = this.finalInterviewRepository.create({
      ...data,
      employerId,
    });
    return await this.finalInterviewRepository.save(interview);
  }

  async getAIInterview(id: string) {
    return await this.aiInterviewRepository.findOne({
      where: { id },
      relations: ['job', 'candidate', 'application'],
    });
  }
}

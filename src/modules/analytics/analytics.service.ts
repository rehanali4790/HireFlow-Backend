import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { Application } from '../applications/entities/application.entity';
import { Candidate } from '../candidates/entities/candidate.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Job)
    private jobRepository: Repository<Job>,
    @InjectRepository(Application)
    private applicationRepository: Repository<Application>,
    @InjectRepository(Candidate)
    private candidateRepository: Repository<Candidate>,
  ) { }

  async getDashboardAnalytics(employerId: string) {
    const totalJobs = await this.jobRepository.count({ where: { employerId } });
    const activeJobs = await this.jobRepository.count({ where: { employerId, status: 'active' } });

    // Total applications for all jobs of this employer
    const totalApplications = await this.applicationRepository.count({
      where: { job: { employerId } },
    });

    // Recent applications (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentApplications = await this.applicationRepository.count({
      where: {
        job: { employerId },
        createdAt: { $gte: sevenDaysAgo } as any // TypeORM syntax for >=
      }
    });

    // Mocking some other stats for the dashboard
    return {
      totalJobs,
      activeJobs,
      totalApplications,
      recentApplications,
      interviewsScheduled: 0, // Implement later
      averageMatchScore: 75, // Implement later
    };
  }
}

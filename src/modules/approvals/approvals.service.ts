import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Application } from '../applications/entities/application.entity';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(Application)
    private applicationRepository: Repository<Application>,
  ) { }

  async getPendingApprovals(employerId: string) {
    return await this.applicationRepository.find({
      where: {
        job: { employerId },
        status: In(['screening', 'testing', 'ai_interview']),
      },
      relations: ['job', 'candidate'],
      order: { updatedAt: 'DESC' },
    });
  }

  async processApproval(applicationId: string, employerId: string, decision: 'approve' | 'reject') {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId, job: { employerId } },
    });

    if (!application) return null;

    if (decision === 'approve') {
      let nextStatus = '';
      switch (application.status) {
        case 'screening':
          nextStatus = 'shortlisted';
          break;
        case 'testing':
          nextStatus = 'ai_interview';
          break;
        case 'ai_interview':
          nextStatus = 'final_interview';
          break;
        default:
          nextStatus = application.status;
      }
      application.status = nextStatus;
    } else {
      let rejectionStatus = '';
      switch (application.status) {
        case 'screening':
          rejectionStatus = 'rejected_screening';
          break;
        case 'testing':
          rejectionStatus = 'rejected_test';
          break;
        case 'ai_interview':
          rejectionStatus = 'rejected_ai_interview';
          break;
        default:
          rejectionStatus = 'rejected';
      }
      application.status = rejectionStatus;
      application.rejectionDate = new Date();
    }

    application.updatedAt = new Date();
    return await this.applicationRepository.save(application);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private jobRepository: Repository<Job>,
  ) {}

  async getJobs(employerId?: string) {
    if (employerId) {
      return await this.jobRepository.find({
        where: { employerId },
        relations: ['employer'],
        order: { createdAt: 'DESC' },
      });
    } else {
      return await this.jobRepository.find({
        where: { status: 'active' },
        relations: ['employer'],
        order: { createdAt: 'DESC' },
      });
    }
  }

  async getJob(id: string) {
    return await this.jobRepository.findOne({
      where: { id },
      relations: ['employer'],
    });
  }

  async createJob(employerId: string, data: Partial<Job>) {
    const job = this.jobRepository.create({
      ...data,
      employerId,
    });
    return await this.jobRepository.save(job);
  }

  async updateJob(id: string, employerId: string, data: Partial<Job>) {
    await this.jobRepository.update(
      { id, employerId },
      { ...data, updatedAt: new Date() },
    );
    return await this.jobRepository.findOne({ where: { id, employerId } });
  }

  async deleteJob(id: string, employerId: string) {
    const result = await this.jobRepository.delete({ id, employerId });
    return result.affected > 0;
  }
}

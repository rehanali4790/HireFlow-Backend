import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Test } from './entities/test.entity';

@Injectable()
export class TestsService {
  constructor(
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
  ) { }

  async getTests(employerId: string) {
    return await this.testRepository.find({
      where: { employerId },
      relations: ['job'],
      order: { createdAt: 'DESC' },
    });
  }

  async getTest(id: string, employerId: string) {
    return await this.testRepository.findOne({
      where: { id, employerId },
      relations: ['job'],
    });
  }

  async createTest(employerId: string, data: any) {
    const test = this.testRepository.create({
      ...data,
      employerId,
    });
    return await this.testRepository.save(test);
  }

  async updateTest(id: string, employerId: string, data: any) {
    await this.testRepository.update({ id, employerId }, data);
    return await this.testRepository.findOne({ where: { id, employerId } });
  }

  async deleteTest(id: string, employerId: string) {
    const result = await this.testRepository.delete({ id, employerId });
    return result.affected > 0;
  }
}

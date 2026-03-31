import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { CurrentEmployer } from '../auth/current-employer.decorator';

@Controller('jobs')
export class JobsController {
  constructor(
    private jobsService: JobsService,
    private authService: AuthService,
  ) {}

  @Get()
  async getJobs(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '');
    let employer = null;
    if (token) {
      employer = await this.authService.getEmployerByToken(token);
    }
    return await this.jobsService.getJobs(employer?.id);
  }

  @Get(':id')
  async getJob(@Param('id') id: string) {
    const job = await this.jobsService.getJob(id);
    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return job;
  }

  @Post()
  @UseGuards(AuthGuard)
  async createJob(@CurrentEmployer() employer: any, @Body() data: any) {
    return await this.jobsService.createJob(employer.id, data);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async updateJob(
    @Param('id') id: string,
    @CurrentEmployer() employer: any,
    @Body() data: any,
  ) {
    const job = await this.jobsService.updateJob(id, employer.id, data);
    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return job;
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteJob(@Param('id') id: string, @CurrentEmployer() employer: any) {
    const deleted = await this.jobsService.deleteJob(id, employer.id);
    if (!deleted) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentEmployer } from '../auth/current-employer.decorator';

@Controller('interviews')
@UseGuards(AuthGuard)
export class InterviewsController {
  constructor(private interviewsService: InterviewsService) { }

  @Get('ai')
  async getAIInterviews(@CurrentEmployer() employer: any) {
    return await this.interviewsService.getAIInterviews(employer.id);
  }

  @Get('final')
  async getFinalInterviews(@CurrentEmployer() employer: any) {
    return await this.interviewsService.getFinalInterviews(employer.id);
  }

  @Post('final')
  async createFinalInterview(
    @CurrentEmployer() employer: any,
    @Body() data: any,
  ) {
    return await this.interviewsService.createFinalInterview(employer.id, data);
  }

  @Get('ai/:id')
  async getAIInterview(@Param('id') id: string) {
    const interview = await this.interviewsService.getAIInterview(id);
    if (!interview) {
      throw new HttpException('AI Interview not found', HttpStatus.NOT_FOUND);
    }
    return interview;
  }
}

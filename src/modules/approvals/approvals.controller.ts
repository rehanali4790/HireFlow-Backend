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
import { ApprovalsService } from './approvals.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentEmployer } from '../auth/current-employer.decorator';

@Controller('approvals')
@UseGuards(AuthGuard)
export class ApprovalsController {
  constructor(private approvalsService: ApprovalsService) { }

  @Get()
  async getPendingApprovals(@CurrentEmployer() employer: any) {
    return await this.approvalsService.getPendingApprovals(employer.id);
  }

  @Post(':id')
  async processApproval(
    @Param('id') id: string,
    @CurrentEmployer() employer: any,
    @Body() data: { decision: 'approve' | 'reject' },
  ) {
    const result = await this.approvalsService.processApproval(
      id,
      employer.id,
      data.decision,
    );
    if (!result) {
      throw new HttpException('Application not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }
}

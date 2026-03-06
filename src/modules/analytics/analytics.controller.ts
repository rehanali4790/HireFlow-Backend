import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentEmployer } from '../auth/current-employer.decorator';

@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) { }

  @Get('dashboard')
  async getDashboardAnalytics(@CurrentEmployer() employer: any) {
    return await this.analyticsService.getDashboardAnalytics(employer.id);
  }
}

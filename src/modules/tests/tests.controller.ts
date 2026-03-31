import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TestsService } from './tests.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentEmployer } from '../auth/current-employer.decorator';

@Controller('tests')
@UseGuards(AuthGuard)
export class TestsController {
  constructor(private testsService: TestsService) { }

  @Get()
  async getTests(@CurrentEmployer() employer: any) {
    return await this.testsService.getTests(employer.id);
  }

  @Get(':id')
  async getTest(@Param('id') id: string, @CurrentEmployer() employer: any) {
    const test = await this.testsService.getTest(id, employer.id);
    if (!test) {
      throw new HttpException('Test not found', HttpStatus.NOT_FOUND);
    }
    return test;
  }

  @Post()
  async createTest(@CurrentEmployer() employer: any, @Body() data: any) {
    return await this.testsService.createTest(employer.id, data);
  }

  @Put(':id')
  async updateTest(
    @Param('id') id: string,
    @CurrentEmployer() employer: any,
    @Body() data: any,
  ) {
    const test = await this.testsService.updateTest(id, employer.id, data);
    if (!test) {
      throw new HttpException('Test not found', HttpStatus.NOT_FOUND);
    }
    return test;
  }

  @Delete(':id')
  async deleteTest(@Param('id') id: string, @CurrentEmployer() employer: any) {
    const deleted = await this.testsService.deleteTest(id, employer.id);
    if (!deleted) {
      throw new HttpException('Test not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}

import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      message: 'HireFlow API is running',
      timestamp: new Date().toISOString(),
    };
  }
}

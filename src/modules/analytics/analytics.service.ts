import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AnalyticsService {
  constructor(private db: DatabaseService) {}
  // TODO: Implement analytics service methods
}

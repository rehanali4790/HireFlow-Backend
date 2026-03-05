import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ApprovalsService {
  constructor(private db: DatabaseService) {}
  // TODO: Implement approval service methods
}

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class TestsService {
  constructor(private db: DatabaseService) {}
  // TODO: Implement test service methods
}

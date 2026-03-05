import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class InterviewsService {
  constructor(private db: DatabaseService) {}
  // TODO: Implement interview service methods
}

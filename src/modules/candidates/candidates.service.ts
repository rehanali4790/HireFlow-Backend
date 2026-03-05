import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CandidatesService {
  constructor(private db: DatabaseService) {}
  // TODO: Implement candidate service methods
}

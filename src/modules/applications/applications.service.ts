import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ApplicationsService {
  constructor(private db: DatabaseService) {}
  
  // TODO: Implement application service methods
}

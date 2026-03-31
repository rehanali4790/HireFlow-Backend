import { Controller } from '@nestjs/common';
import { ApplicationsService } from './applications.service';

@Controller('applications')
export class ApplicationsController {
  constructor(private applicationsService: ApplicationsService) {}
  
  // TODO: Implement application endpoints
  // - POST /applications (create application)
  // - GET /jobs/:jobId/applications (get applications for job)
  // - GET /applications/:id (get single application)
  // - PATCH /applications/:id/status (update application status)
}

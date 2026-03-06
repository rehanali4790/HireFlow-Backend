import {
    Controller,
    Post,
    Body,
    UseGuards,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('email')
@UseGuards(AuthGuard)
export class EmailController {
    constructor(private emailService: EmailService) { }

    @Post('send')
    async sendEmail(@Body() data: {
        recipientEmail: string;
        subject: string;
        htmlBody: string;
        applicationId?: string;
        candidateId?: string;
    }) {
        return await this.emailService.sendEmail(data);
    }
}

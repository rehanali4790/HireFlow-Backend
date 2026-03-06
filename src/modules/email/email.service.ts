import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { EmailLog } from './entities/email-log.entity';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private config: ConfigService,
    @InjectRepository(EmailLog)
    private emailLogRepository: Repository<EmailLog>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: parseInt(this.config.get('SMTP_PORT', '587')),
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASSWORD'),
      },
    });

    this.transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email transporter error:', error);
      } else {
        console.log('✅ Email server is ready to send messages');
      }
    });
  }

  async sendEmail(data: {
    recipientEmail: string;
    subject: string;
    htmlBody: string;
    applicationId?: string;
    candidateId?: string;
  }) {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.get('SMTP_FROM', '"HireFlow" <noreply@hireflow.ai>'),
        to: data.recipientEmail,
        subject: data.subject,
        html: data.htmlBody,
      });

      console.log('✅ Email sent: %s', info.messageId);

      // Log to DB
      const log = this.emailLogRepository.create({
        applicationId: data.applicationId,
        candidateId: data.candidateId,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        body: data.htmlBody,
        emailType: 'automated',
        deliveryStatus: 'sent',
      });
      await this.emailLogRepository.save(log);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send email:', error);

      // Log failed email
      const log = this.emailLogRepository.create({
        applicationId: data.applicationId,
        candidateId: data.candidateId,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        body: data.htmlBody,
        emailType: 'automated',
        deliveryStatus: 'failed',
        errorMessage: error.message,
      });
      await this.emailLogRepository.save(log);

      throw error;
    }
  }
}

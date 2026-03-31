import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Application } from '../../applications/entities/application.entity';
import { Candidate } from '../../candidates/entities/candidate.entity';

@Entity('email_logs')
export class EmailLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'application_id', nullable: true })
    applicationId: string;

    @Column({ type: 'uuid', name: 'candidate_id', nullable: true })
    candidateId: string;

    @Column({ name: 'email_type', nullable: true })
    emailType: string;

    @Column({ name: 'recipient_email', nullable: true })
    recipientEmail: string;

    @Column({ nullable: true })
    subject: string;

    @Column({ type: 'text', nullable: true })
    body: string;

    @Column({ name: 'delivery_status', default: 'sent' })
    deliveryStatus: string;

    @Column({ name: 'error_message', type: 'text', nullable: true })
    errorMessage: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // Relations
    @ManyToOne(() => Application)
    @JoinColumn({ name: 'application_id' })
    application: Application;

    @ManyToOne(() => Candidate)
    @JoinColumn({ name: 'candidate_id' })
    candidate: Candidate;
}

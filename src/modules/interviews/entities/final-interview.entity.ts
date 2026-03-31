import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Application } from '../../applications/entities/application.entity';
import { Job } from '../../jobs/entities/job.entity';
import { Candidate } from '../../candidates/entities/candidate.entity';
import { Employer } from '../../auth/entities/employer.entity';

@Entity('final_interviews')
export class FinalInterview {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'application_id', nullable: true })
    applicationId: string;

    @Column({ type: 'uuid', name: 'candidate_id', nullable: true })
    candidateId: string;

    @Column({ type: 'uuid', name: 'job_id', nullable: true })
    jobId: string;

    @Column({ type: 'uuid', name: 'employer_id', nullable: true })
    employerId: string;

    @Column({ type: 'uuid', name: 'ai_interview_id', nullable: true })
    aiInterviewId: string;

    @Column({ type: 'timestamp', name: 'scheduled_at', nullable: true })
    scheduledAt: Date;

    @Column({ type: 'integer', name: 'duration_minutes', default: 60 })
    durationMinutes: number;

    @Column({ name: 'interviewer_name', nullable: true })
    interviewerName: string;

    @Column({ name: 'interviewer_email', nullable: true })
    interviewerEmail: string;

    @Column({ name: 'meeting_link', nullable: true })
    meetingLink: string;

    @Column({ name: 'location', nullable: true })
    location: string;

    @Column({ default: 'pending_schedule' })
    status: string;

    @Column({ name: 'interview_type', default: 'final' })
    interviewType: string;

    @Column({ type: 'text', nullable: true })
    feedback: string;

    @Column({ type: 'jsonb', default: {} })
    settings: Record<string, any>;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Application)
    @JoinColumn({ name: 'application_id' })
    application: Application;

    @ManyToOne(() => Candidate)
    @JoinColumn({ name: 'candidate_id' })
    candidate: Candidate;

    @ManyToOne(() => Job)
    @JoinColumn({ name: 'job_id' })
    job: Job;

    @ManyToOne(() => Employer)
    @JoinColumn({ name: 'employer_id' })
    employer: Employer;
}

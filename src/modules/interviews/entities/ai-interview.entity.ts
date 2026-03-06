import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Application } from '../../applications/entities/application.entity';
import { Job } from '../../jobs/entities/job.entity';
import { Candidate } from '../../candidates/entities/candidate.entity';

@Entity('ai_interviews')
export class AIInterview {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'application_id', nullable: true })
    applicationId: string;

    @Column({ type: 'uuid', name: 'candidate_id', nullable: true })
    candidateId: string;

    @Column({ type: 'uuid', name: 'job_id', nullable: true })
    jobId: string;

    @Column({ default: 'scheduled' })
    status: string;

    @Column({ type: 'decimal', precision: 5, scale: 2, name: 'overall_score', nullable: true })
    overallScore: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, name: 'technical_score', nullable: true })
    technicalScore: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, name: 'communication_score', nullable: true })
    communicationScore: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, name: 'problem_solving_score', nullable: true })
    problemSolvingScore: number;

    @Column({ type: 'text', nullable: true })
    feedback: string;

    @Column({ nullable: true })
    recommendation: string;

    @Column({ type: 'timestamp', name: 'completed_at', nullable: true })
    completedAt: Date;

    @Column({ type: 'integer', name: 'duration_minutes', nullable: true })
    durationMinutes: number;

    @Column({ type: 'jsonb', default: [] })
    transcript: any[];

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
}

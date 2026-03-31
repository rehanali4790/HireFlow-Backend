import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Job } from '../../jobs/entities/job.entity';
import { Employer } from '../../auth/entities/employer.entity';

@Entity('tests')
export class Test {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'job_id', nullable: true })
    jobId: string;

    @Column({ type: 'uuid', name: 'employer_id', nullable: true })
    employerId: string;

    @Column({ nullable: true })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'integer', name: 'duration_minutes', default: 45 })
    durationMinutes: number;

    @Column({ type: 'integer', name: 'passing_score', default: 70 })
    passingScore: number;

    @Column({ type: 'jsonb', default: [] })
    questions: any[];

    @Column({ default: 'active' })
    status: string;

    @Column({ type: 'boolean', name: 'is_ai_generated', default: false })
    isAiGenerated: boolean;

    @Column({ type: 'boolean', name: 'ai_evaluation_enabled', default: true })
    aiEvaluationEnabled: boolean;

    @Column({ name: 'test_type', default: 'technical' })
    testType: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Job)
    @JoinColumn({ name: 'job_id' })
    job: Job;

    @ManyToOne(() => Employer)
    @JoinColumn({ name: 'employer_id' })
    employer: Employer;
}

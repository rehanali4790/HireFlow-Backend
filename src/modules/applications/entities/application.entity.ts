import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Job } from '../../jobs/entities/job.entity';
import { Candidate } from '../../candidates/entities/candidate.entity';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'job_id', nullable: true })
  jobId: string;

  @Column({ type: 'uuid', name: 'candidate_id', nullable: true })
  candidateId: string;

  @Column({ default: 'applied' })
  status: string;

  @Column({ name: 'current_stage', default: 'application_received' })
  currentStage: string;

  @Column({ type: 'timestamp', name: 'application_date', default: () => 'CURRENT_TIMESTAMP' })
  applicationDate: Date;

  @Column({ type: 'timestamp', name: 'screening_completed_at', nullable: true })
  screeningCompletedAt: Date;

  @Column({ type: 'timestamp', name: 'shortlist_approved_at', nullable: true })
  shortlistApprovedAt: Date;

  @Column({ type: 'timestamp', name: 'test_completed_at', nullable: true })
  testCompletedAt: Date;

  @Column({ type: 'timestamp', name: 'test_approved_at', nullable: true })
  testApprovedAt: Date;

  @Column({ type: 'timestamp', name: 'ai_interview_completed_at', nullable: true })
  aiInterviewCompletedAt: Date;

  @Column({ type: 'timestamp', name: 'ai_interview_approved_at', nullable: true })
  aiInterviewApprovedAt: Date;

  @Column({ type: 'timestamp', name: 'final_interview_scheduled_at', nullable: true })
  finalInterviewScheduledAt: Date;

  @Column({ type: 'timestamp', name: 'final_interview_completed_at', nullable: true })
  finalInterviewCompletedAt: Date;

  @Column({ type: 'timestamp', name: 'offer_date', nullable: true })
  offerDate: Date;

  @Column({ type: 'timestamp', name: 'hire_date', nullable: true })
  hireDate: Date;

  @Column({ type: 'timestamp', name: 'rejection_date', nullable: true })
  rejectionDate: Date;

  @Column({ type: 'text', name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @Column({ type: 'text', name: 'employer_notes', nullable: true })
  employerNotes: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'overall_score', default: 0 })
  overallScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Job, (job) => job.applications)
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @ManyToOne(() => Candidate, (candidate) => candidate.applications)
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;
}

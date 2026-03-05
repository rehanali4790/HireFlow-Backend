import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Employer } from '../../auth/entities/employer.entity';
import { Application } from '../../applications/entities/application.entity';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'employer_id' })
  employerId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  requirements: string;

  @Column({ type: 'text', nullable: true })
  responsibilities: string;

  @Column({ type: 'text', array: true, name: 'skills_required', default: [] })
  skillsRequired: string[];

  @Column({ nullable: true })
  location: string;

  @Column({ name: 'work_type', default: 'full-time' })
  workType: string;

  @Column({ name: 'remote_policy', default: 'on-site' })
  remotePolicy: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'salary_min', nullable: true })
  salaryMin: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'salary_max', nullable: true })
  salaryMax: number;

  @Column({ name: 'salary_currency', default: 'USD' })
  salaryCurrency: string;

  @Column({ name: 'experience_level', nullable: true })
  experienceLevel: string;

  @Column({ name: 'education_required', nullable: true })
  educationRequired: string;

  @Column({ default: 'draft' })
  status: string;

  @Column({ name: 'positions_available', default: 1 })
  positionsAvailable: number;

  @Column({ name: 'positions_filled', default: 0 })
  positionsFilled: number;

  @Column({ type: 'timestamp', name: 'application_deadline', nullable: true })
  applicationDeadline: Date;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  settings: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Employer, (employer) => employer.jobs)
  @JoinColumn({ name: 'employer_id' })
  employer: Employer;

  @OneToMany(() => Application, (application) => application.job)
  applications: Application[];
}

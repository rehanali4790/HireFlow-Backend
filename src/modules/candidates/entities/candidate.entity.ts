import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Application } from '../../applications/entities/application.entity';

@Entity('candidates')
export class Candidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  location: string;

  @Column({ name: 'linkedin_url', nullable: true })
  linkedinUrl: string;

  @Column({ name: 'portfolio_url', nullable: true })
  portfolioUrl: string;

  @Column({ name: 'resume_url', nullable: true })
  resumeUrl: string;

  @Column({ type: 'jsonb', name: 'resume_parsed_data', nullable: true })
  resumeParsedData: Record<string, any>;

  @Column({ type: 'text', name: 'cover_letter', nullable: true })
  coverLetter: string;

  @Column({ type: 'text', array: true, default: [] })
  skills: string[];

  @Column({ type: 'int', name: 'experience_years', nullable: true })
  experienceYears: number;

  @Column({ type: 'jsonb', nullable: true })
  education: Record<string, any>[];

  @Column({ type: 'jsonb', name: 'work_history', nullable: true })
  workHistory: Record<string, any>[];

  @Column({ name: 'is_duplicate', default: false })
  isDuplicate: boolean;

  @Column({ type: 'uuid', name: 'duplicate_of', nullable: true })
  duplicateOf: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Application, (application) => application.candidate)
  applications: Application[];
}

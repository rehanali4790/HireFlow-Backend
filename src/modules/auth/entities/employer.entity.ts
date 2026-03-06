import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Job } from '../../jobs/entities/job.entity';

@Entity('employers')
export class Employer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'company_name', nullable: true })
  companyName: string;

  @Column({ name: 'company_description', type: 'text', nullable: true })
  companyDescription: string;

  @Column({ name: 'company_logo_url', nullable: true })
  companyLogoUrl: string;

  @Column({ name: 'contact_email', unique: true, nullable: true })
  contactEmail: string;

  @Column({ name: 'contact_phone', nullable: true })
  contactPhone: string;

  @Column({ nullable: true })
  industry: string;

  @Column({ name: 'company_size', nullable: true })
  companySize: string;

  @Column({ nullable: true })
  website: string;

  @Column({ name: 'password_hash', nullable: true })
  passwordHash: string;

  @Column({ name: 'auth_token', nullable: true })
  authToken: string;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  settings: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Job, (job) => job.employer)
  jobs: Job[];
}

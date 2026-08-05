# Database Schema

Complete database schema for HireFlow backend.

## Tables Overview

```
employers          → Company accounts
jobs               → Job postings
candidates         → Candidate profiles
applications       → Job applications
tests              → Technical assessments (TODO)
test_attempts      → Test submissions (TODO)
ai_interviews      → AI interview records (TODO)
final_interviews   → Human interviews (TODO)
email_logs         → Email tracking (TODO)
email_templates    → Email templates (TODO)
approval_gates     → Workflow approvals (TODO)
resume_scores      → AI resume scoring (TODO)
```

## Entity Relationships

```
Employer (1) ──────< (N) Job
                           │
                           │
                           ├──< (N) Application
                           │         │
                           │         └──> (1) Candidate
                           │
                           └──< (N) Test
```

## Implemented Entities

### Employers

Company accounts that post jobs.

```typescript
@Entity('employers')
export class Employer {
  id: uuid                    // Primary key
  userId: uuid                // User reference
  companyName: string         // Company name
  companyDescription: text    // About company
  companyLogoUrl: string      // Logo URL
  contactEmail: string        // Email (unique)
  contactPhone: string        // Phone number
  industry: string            // Industry type
  companySize: string         // Company size
  website: string             // Website URL
  passwordHash: string        // Hashed password
  authToken: string           // Auth token
  settings: jsonb             // Additional settings
  createdAt: timestamp        // Created date
  updatedAt: timestamp        // Updated date
}
```

**Relationships:**
- `jobs`: One-to-Many with Job

**Indexes:**
- `contactEmail` (unique)
- `authToken`

### Jobs

Job postings created by employers.

```typescript
@Entity('jobs')
export class Job {
  id: uuid                    // Primary key
  employerId: uuid            // Foreign key → employers
  title: string               // Job title
  description: text           // Job description
  requirements: text          // Job requirements
  responsibilities: text      // Job responsibilities
  skillsRequired: string[]    // Required skills array
  location: string            // Job location
  workType: string            // full-time, part-time, etc.
  remotePolicy: string        // remote, hybrid, on-site
  salaryMin: decimal          // Minimum salary
  salaryMax: decimal          // Maximum salary
  salaryCurrency: string      // USD, EUR, etc.
  experienceLevel: string     // entry, mid, senior, etc.
  educationRequired: string   // Education requirements
  status: string              // draft, active, paused, closed
  positionsAvailable: int     // Number of positions
  positionsFilled: int        // Positions filled
  applicationDeadline: timestamp // Application deadline
  settings: jsonb             // Additional settings
  createdAt: timestamp        // Created date
  updatedAt: timestamp        // Updated date
}
```

**Relationships:**
- `employer`: Many-to-One with Employer
- `applications`: One-to-Many with Application

**Indexes:**
- `employerId`
- `status`
- `createdAt`

### Candidates

Candidate profiles who apply for jobs.

```typescript
@Entity('candidates')
export class Candidate {
  id: uuid                    // Primary key
  email: string               // Email (unique)
  firstName: string           // First name
  lastName: string            // Last name
  phone: string               // Phone number
  location: string            // Location
  linkedinUrl: string         // LinkedIn profile
  portfolioUrl: string        // Portfolio URL
  resumeUrl: string           // Resume file URL
  resumeParsedData: jsonb     // Parsed resume data
  coverLetter: text           // Cover letter
  skills: string[]            // Skills array
  experienceYears: int        // Years of experience
  education: jsonb[]          // Education history
  workHistory: jsonb[]        // Work history
  isDuplicate: boolean        // Duplicate flag
  duplicateOf: uuid           // Original candidate ID
  createdAt: timestamp        // Created date
  updatedAt: timestamp        // Updated date
}
```

**Relationships:**
- `applications`: One-to-Many with Application

**Indexes:**
- `email` (unique)
- `createdAt`

### Applications

Job applications linking candidates to jobs.

```typescript
@Entity('applications')
export class Application {
  id: uuid                    // Primary key
  jobId: uuid                 // Foreign key → jobs
  candidateId: uuid           // Foreign key → candidates
  status: string              // applied, screening, shortlisted, etc.
  currentStage: string        // Current hiring stage
  applicationDate: timestamp  // Application date
  screeningCompletedAt: timestamp
  shortlistApprovedAt: timestamp
  testCompletedAt: timestamp
  testApprovedAt: timestamp
  aiInterviewCompletedAt: timestamp
  aiInterviewApprovedAt: timestamp
  finalInterviewScheduledAt: timestamp
  finalInterviewCompletedAt: timestamp
  offerDate: timestamp
  hireDate: timestamp
  rejectionDate: timestamp
  rejectionReason: text
  employerNotes: text         // Internal notes
  overallScore: decimal       // Overall score (0-100)
  createdAt: timestamp        // Created date
  updatedAt: timestamp        // Updated date
}
```

**Relationships:**
- `job`: Many-to-One with Job
- `candidate`: Many-to-One with Candidate

**Indexes:**
- `jobId`
- `candidateId`
- `status`
- `currentStage`
- `applicationDate`

## Hiring Pipeline Stages

Applications progress through these stages:

```
1. application_received    → Initial application
2. screening              → Resume review
3. shortlisted            → Passed initial screening
4. test_invitation_sent   → Test sent to candidate
5. testing                → Candidate taking test
6. test_completed         → Test submitted
7. ai_interview           → AI interview in progress
8. ai_interview_completed → AI interview done
9. final_interview        → Human interview scheduled
10. offer_extended        → Job offer sent
11. hired                 → Candidate accepted
12. rejected              → Application rejected
```

## Application Status Values

```
- applied                 → Just submitted
- screening               → Under review
- shortlisted             → Moved to next stage
- testing                 → Taking test
- test_completed          → Test done
- ai_interview            → AI interview
- ai_interview_completed  → AI interview done
- final_interview         → Final interview
- offer_extended          → Offer sent
- hired                   → Hired!
- rejected                → Rejected
```

## TODO: Entities to Implement

### Tests

```typescript
@Entity('tests')
export class Test {
  id: uuid
  jobId: uuid
  employerId: uuid
  title: string
  description: text
  testType: string            // mcq, coding, essay, etc.
  durationMinutes: int
  passingScore: int
  questions: jsonb
  answerKey: jsonb
  isActive: boolean
  isAiGenerated: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

### AI Interviews

```typescript
@Entity('ai_interviews')
export class AIInterview {
  id: uuid
  applicationId: uuid
  candidateId: uuid
  jobId: uuid
  employerId: uuid
  interviewToken: string
  status: string
  transcript: jsonb
  snapshots: jsonb
  overallScore: decimal
  technicalScore: decimal
  communicationScore: decimal
  problemSolvingScore: decimal
  feedback: text
  recommendation: string
  startedAt: timestamp
  completedAt: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Email Logs

```typescript
@Entity('email_logs')
export class EmailLog {
  id: uuid
  candidateId: uuid
  applicationId: uuid
  emailType: string
  recipientEmail: string
  subject: string
  body: text
  deliveryStatus: string
  errorMessage: text
  templateId: uuid
  sentAt: timestamp
  createdAt: timestamp
}
```

## Database Sync

### Development Mode

Set `DB_SYNC=true` in `.env`:
- TypeORM automatically creates/updates tables
- Schema changes applied on server restart
- Perfect for rapid development

### Production Mode

Set `DB_SYNC=false` in `.env`:
- Manual migrations required
- No automatic schema changes
- Safe for production data

## Migrations (Future)

When ready for production migrations:

```bash
# Generate migration
npm run typeorm migration:generate -- -n MigrationName

# Run migrations
npm run typeorm migration:run

# Revert migration
npm run typeorm migration:revert
```

## Backup Strategy

### Recommended Backup Schedule

- **Daily**: Full database backup
- **Hourly**: Incremental backup
- **Before Deploy**: Manual backup

### Backup Command

```bash
pg_dump -U postgres -d hireflow_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Command

```bash
psql -U postgres -d hireflow_db < backup_file.sql
```

---

**Note**: This schema is designed for scalability and can handle millions of applications.

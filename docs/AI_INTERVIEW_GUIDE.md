# AI Interview Feature Guide

## Overview

The AI Interview feature uses OpenAI's GPT-4 for question generation and evaluation, along with Text-to-Speech (TTS) and Speech-to-Text (STT) capabilities for a natural voice-based interview experience.

## How It Works

### 1. Interview Invitation Flow

**HR Side:**
1. HR reviews applications and selects candidates for AI interview
2. HR clicks "Send AI Interview" button on the candidate's application
3. System generates a unique interview token and link
4. Email is sent to candidate with interview link

**Candidate Side:**
1. Candidate receives email with interview link
2. Clicks link to access AI interview page
3. Grants microphone (and optionally camera) permissions
4. Starts the interview

### 2. Interview Process

#### Question Generation (60% Resume + 40% Job Description)

The AI generates personalized questions based on:
- **60% from candidate's resume:**
  - Skills mentioned
  - Work experience
  - Projects
  - Education
  - Certifications

- **40% from job description:**
  - Required skills
  - Job responsibilities
  - Experience level
  - Technical requirements

#### Interview Flow

1. **Welcome Message:** AI greets the candidate
2. **Question Loop (8-10 questions):**
   - AI generates next question using GPT-4
   - Question is converted to speech using OpenAI TTS
   - AI speaks the question
   - Candidate responds verbally
   - Response is captured and converted to text using OpenAI Whisper STT
   - Response is saved to database
   - Process repeats for next question

3. **Completion:**
   - After all questions, interview is automatically completed
   - AI evaluates the full transcript
   - Scores are calculated and saved
   - Application status is updated

### 3. AI Evaluation

After interview completion, the AI evaluates:

- **Technical Score (0-100):** Knowledge of required technologies
- **Communication Score (0-100):** Clarity and articulation
- **Problem-Solving Score (0-100):** Analytical thinking
- **Overall Score (0-100):** Weighted average

**Recommendation Levels:**
- `strong_hire`: >= 85 (Excellent candidate)
- `hire`: 75-84 (Good candidate)
- `maybe`: 60-74 (Potential with reservations)
- `no_hire`: < 60 (Not recommended)

## API Endpoints

### For Candidates (Public)

#### Get Interview by Token
```
GET /api/ai-interviews/token/:token
```
Returns interview details, job info, and candidate info.

#### Start Interview
```
POST /api/ai-interviews/token/:token/start
```
Marks interview as started.

#### Generate Next Question
```
POST /api/ai-interviews/token/:token/question
```
Generates the next AI question based on transcript history.

Response:
```json
{
  "question": "Tell me about your experience with...",
  "question_number": 1
}
```

Or if interview should end:
```json
{
  "should_end": true,
  "reason": "Interview complete"
}
```

#### Submit Answer
```
POST /api/ai-interviews/token/:token/answer
Body: {
  "answer": "candidate's response text",
  "question_number": 1
}
```

#### Complete Interview
```
POST /api/ai-interviews/token/:token/complete
```
Evaluates the interview and returns scores.

### For HR (Authenticated)

#### Send AI Interview Invitation
```
POST /api/ai-interviews/send-invitation
Headers: { Authorization: Bearer <token> }
Body: { "applicationId": "uuid" }
```

#### Get All AI Interviews
```
GET /api/ai-interviews
Headers: { Authorization: Bearer <token> }
```

### Speech APIs

#### Text-to-Speech (TTS)
```
POST /api/ai-speech/tts
Body: { "text": "Question to speak" }
```
Returns: Audio stream (MP3)

#### Speech-to-Text (STT)
```
POST /api/ai-speech/stt
Content-Type: multipart/form-data
Body: audio file
```
Returns:
```json
{
  "text": "transcribed text",
  "duration": 5.2
}
```

## Database Schema

### ai_interviews Table

```sql
CREATE TABLE ai_interviews (
  id uuid PRIMARY KEY,
  application_id uuid REFERENCES applications(id),
  interview_token text UNIQUE,
  started_at timestamptz,
  completed_at timestamptz,
  questions_asked jsonb DEFAULT '[]'::jsonb,
  candidate_responses jsonb DEFAULT '[]'::jsonb,
  technical_score numeric,
  communication_score numeric,
  problem_solving_score numeric,
  overall_score numeric,
  ai_summary text,
  recommendation text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Transcript Format

**questions_asked:**
```json
[
  {
    "role": "ai",
    "message": "Tell me about your experience with React",
    "timestamp": "2024-01-15T10:30:00Z",
    "question_number": 1
  }
]
```

**candidate_responses:**
```json
[
  {
    "role": "candidate",
    "message": "I have 3 years of experience with React...",
    "timestamp": "2024-01-15T10:30:45Z",
    "question_number": 1
  }
]
```

## Configuration

### Environment Variables

```env
# OpenAI API Key (required)
OPENAI_API_KEY=sk-...

# Application URL for interview links
APP_URL=http://localhost:5173

# Email configuration for invitations
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Frontend Integration

The frontend (`AIInterviewPage.tsx`) handles:
- Microphone/camera permissions
- Audio recording and playback
- Speech recognition (browser-based or OpenAI Whisper)
- Text-to-Speech (browser-based or OpenAI TTS)
- Real-time transcript display
- Interview state management

### Key Features:
- **Dual Mode:** Browser Web Speech API or OpenAI APIs
- **Fallback:** Text-based interview if speech not available
- **Security:** Random camera snapshots during interview
- **Auto-save:** Transcript saved after each Q&A

## Testing

### Run Migrations
```bash
npm run db:migrate
```

### Test Interview Flow
1. Create a job posting
2. Submit an application
3. As HR, send AI interview invitation
4. Check candidate email for link
5. Click link and complete interview
6. Review scores in HR dashboard

## Troubleshooting

### Common Issues

**1. "Microphone not detected"**
- Ensure browser has microphone permissions
- Use Chrome or Edge (best compatibility)
- Check system microphone settings

**2. "Speech recognition failed"**
- Fallback to text-based interview
- Check browser compatibility
- Ensure HTTPS connection

**3. "OpenAI API error"**
- Verify OPENAI_API_KEY in .env
- Check API quota/billing
- Review error logs

**4. "Interview link expired"**
- Links are valid for 7 days by default
- Resend invitation from HR dashboard

## Best Practices

### For HR:
- Review candidate resume before sending interview
- Ensure job description is detailed and accurate
- Monitor interview completion rates
- Review AI evaluations alongside human judgment

### For Candidates:
- Use quiet environment
- Test microphone before starting
- Speak clearly and provide specific examples
- Take time to think before responding
- Provide concrete examples from experience

## Future Enhancements

- [ ] Video recording support
- [ ] Multi-language support
- [ ] Custom question templates
- [ ] Live interview monitoring
- [ ] Sentiment analysis
- [ ] Facial expression analysis
- [ ] Interview replay feature
- [ ] Candidate feedback collection

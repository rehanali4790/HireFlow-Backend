const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze resume and score candidate against job requirements
 */
async function analyzeResume(candidateData, jobRequirements) {
  const prompt = `You are an expert HR recruiter analyzing a candidate's resume for a SPECIFIC job position. Your job is to determine if this candidate is a GOOD FIT for THIS SPECIFIC ROLE.

=== JOB REQUIREMENTS ===
Job Title: ${jobRequirements.title}
Job Description: ${jobRequirements.description}
Required Skills: ${jobRequirements.skills_required.join(', ')}
Experience Level: ${jobRequirements.experience_level || 'Not specified'}

=== CANDIDATE PROFILE ===
Skills: ${candidateData.skills.join(', ')}
Years of Experience: ${candidateData.experience_years || 'Not specified'}
Education: ${JSON.stringify(candidateData.education || [])}
Certifications: ${candidateData.certifications?.join(', ') || 'None'}

${candidateData.resume_text ? `=== FULL RESUME TEXT ===
${candidateData.resume_text.substring(0, 4000)}
` : ''}

=== CRITICAL SCORING RULES ===

**ANALYZE THE FULL RESUME TEXT TO UNDERSTAND THE CANDIDATE'S ACTUAL BACKGROUND**

1. Skills Match Score (0-100):
   STEP 1: Read the resume carefully and identify the candidate's PRIMARY role/expertise
   - Is this a Backend Developer? (Node.js, Python, Java, SQL, APIs, Databases)
   - Is this a Frontend Developer? (React, Vue, Angular, HTML, CSS, JavaScript)
   - Is this a UI/UX Designer? (Figma, Sketch, Adobe XD, Prototyping, User Research, Wireframing)
   - Is this a Data Scientist? (Python, R, Machine Learning, Statistics, Data Analysis)
   - Is this a DevOps Engineer? (Docker, Kubernetes, CI/CD, AWS, Cloud Infrastructure)
   
   STEP 2: Compare candidate's PRIMARY expertise to the JOB REQUIREMENTS
   - Count EXACT matches between candidate skills and required job skills
   - Include synonyms: React/ReactJS, JS/JavaScript, Node/NodeJS, PostgreSQL/Postgres, etc.
   
   STEP 3: Calculate base score
   - Formula: (matched_skills / required_skills) × 100
   - **CRITICAL**: If candidate's PRIMARY role is DIFFERENT from job role → Score = 0-25
     * Example: Backend Engineer applying for UI/UX Designer → Score = 0-20
     * Example: UI/UX Designer applying for Backend Engineer → Score = 0-20
     * Example: Frontend Developer applying for Data Scientist → Score = 0-25
   - If candidate has 1-2 matching skills but wrong role → Score = 20-35
   - If candidate has 50%+ matching skills and right role → Score = 50-75
   - If candidate has 80%+ matching skills and right role → Score = 75-95
   
   STEP 4: Adjustments
   - Add +10 if 3+ years experience with matched skills
   - Deduct -20 if candidate's primary expertise is for a completely different role
   - Cap at 100

2. Experience Score (0-100):
   - **CRITICAL**: Check if experience is RELEVANT to this specific job
   - Backend experience does NOT count for UI/UX roles
   - UI/UX experience does NOT count for Backend roles
   - Frontend experience does NOT count for Backend roles (and vice versa)
   - If experience is in WRONG field: Score = 30-40 (regardless of years)
   - If experience matches job requirements:
     * Entry (0-2yr): 60 base
     * Junior (2-4yr): 70 base
     * Mid (4-7yr): 80 base
     * Senior (7+yr): 90 base

3. Education Score (0-100):
   BASE SCORES:
   - PhD: 100, Master: 90, Bachelor: 80, Associate: 70, HS: 60
   
   RELEVANCE BONUS:
   - Check if degree field is RELEVANT to the job:
     * Computer Science/Software Engineering → Relevant for: Backend, Frontend, Full Stack, DevOps
     * Design/HCI/UX → Relevant for: UI/UX Designer, Product Designer
     * Data Science/Statistics/Math → Relevant for: Data Scientist, ML Engineer
     * Business/Marketing → Relevant for: Product Manager, Marketing roles
   - Add +15 if degree field is HIGHLY relevant to job
   - Add +8 if degree field is SOMEWHAT relevant to job
   - Add 0 if degree field is NOT relevant to job
   
   CERTIFICATIONS BONUS:
   - Certifications are VALUABLE and show commitment to learning
   - Check if certifications are relevant to the job:
     * AWS/Azure/GCP certifications → Relevant for: Backend, DevOps, Cloud roles
     * React/Angular/Vue certifications → Relevant for: Frontend roles
     * UX/Design certifications → Relevant for: UI/UX Designer roles
     * PMP/Agile certifications → Relevant for: Project Manager, Scrum Master
   - Add +10 for EACH relevant certification (max +30 total)
   - Add +5 for EACH somewhat relevant certification (max +15 total)
   
   FINAL EDUCATION SCORE = BASE + RELEVANCE BONUS + CERTIFICATIONS BONUS (capped at 100)

4. Overall Score Calculation:
   - Formula: (Skills Match × 0.60) + (Experience × 0.25) + (Education × 0.15)
   - Skills are weighted HIGHEST because they matter most
   - **CRITICAL**: If skills match < 30, overall score CANNOT exceed 45
   - **CRITICAL**: If candidate is from wrong field, overall score CANNOT exceed 40

5. Recommendation:
   - "strong_yes": >= 85 (Excellent fit, has most required skills, right background)
   - "yes": 75-84 (Good fit, has many required skills, right background)
   - "maybe": 60-74 (Partial fit, missing some key skills but right field)
   - "no": 40-59 (Poor fit, missing most required skills or wrong field)
   - "strong_no": < 40 (Not qualified, completely wrong role/skills)

=== EXAMPLES ===
- Backend Engineer (Node.js, Python, SQL) applying for UI/UX Designer (Figma, Sketch) 
  → Skills Match: 0-15, Experience: 35, Education: 60, Overall: 15-30, Recommendation: "strong_no"
  
- UI/UX Designer (Figma, Adobe XD, Prototyping) applying for Backend Engineer (Node.js, Python)
  → Skills Match: 0-15, Experience: 35, Education: 60, Overall: 15-30, Recommendation: "strong_no"
  
- Frontend Developer (React, JavaScript, CSS) with AWS certification applying for Frontend role (React, TypeScript, CSS)
  → Skills Match: 75-85, Experience: 75, Education: 85 (with cert bonus), Overall: 78-84, Recommendation: "yes"
  
- Senior Backend Engineer (Node.js, Python, AWS, SQL) with AWS Solutions Architect cert applying for Backend role (Node.js, PostgreSQL, Docker)
  → Skills Match: 80-90, Experience: 90, Education: 95 (with cert bonus), Overall: 85-92, Recommendation: "strong_yes"

BE STRICT. Read the resume carefully. If the candidate's background doesn't match the job requirements, give a LOW score. Certifications and relevant education should boost scores.

Return ONLY valid JSON:
{
  "overall_score": number,
  "skills_match_score": number,
  "experience_score": number,
  "education_score": number,
  "keywords_matched": string[],
  "keywords_missing": string[],
  "ai_summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "recommendation": string,
  "certifications_found": string[],
  "education_relevance": string
}

IMPORTANT NOTES:
- "keywords_matched" should contain SKILLS that the candidate HAS and the job REQUIRES
- "keywords_missing" should contain SKILLS that the job REQUIRES but the candidate LACKS
- "weaknesses" should focus on MISSING SKILLS or GAPS IN EXPERIENCE, not lack of certifications
- "certifications_found" should list any certifications mentioned in the resume
- "education_relevance" should explain if the degree is relevant to the job (e.g., "Highly relevant - Computer Science degree for Backend role")
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { 
        role: 'system', 
        content: 'You are an expert HR recruiter. BE STRICT - only recommend candidates who are a GOOD FIT for the SPECIFIC job role. If skills don\'t match the job requirements, give LOW scores. Use objective skill matching, not generous assumptions. IMPORTANT: "keywords_matched" and "keywords_missing" should be SKILLS (technical abilities), not certifications. "weaknesses" should focus on missing skills or experience gaps, not lack of certifications.' 
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    seed: 12345,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate AI interview question
 */
async function generateInterviewQuestion(jobDescription, jobRequirements, transcript, questionNumber) {
  const conversationHistory = transcript.map(entry => ({
    role: entry.role === 'ai' ? 'assistant' : 'user',
    content: entry.message
  }));

  // Check if interview should end
  if (questionNumber >= 4) {
    const evaluationPrompt = `You are evaluating this interview. BE DECISIVE.

Job Requirements: ${JSON.stringify(jobRequirements)}
Job Description: ${jobDescription}

Interview Transcript (${questionNumber} questions so far):
${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n\n')}

MAKE A DECISION NOW:

1. If candidate is CLEARLY NOT QUALIFIED:
   - Vague, generic answers
   - No relevant experience
   - Can't explain their own work
   - Doesn't match job requirements
   → END NOW with should_end: true

2. If candidate seems QUALIFIED:
   - Has relevant experience
   - Can explain their work
   - Matches most requirements
   - After 5-6 questions → END with should_end: true
   - After 4 questions if EXCELLENT → can END

3. If UNCERTAIN (only if truly unclear):
   - Continue ONLY if you genuinely need more info
   - Maximum 8 questions total
   - Don't drag it out

4. After 8 questions → MUST END regardless

BE DECISIVE. Don't be polite and keep going. Real interviewers make decisions.

Respond ONLY with JSON:
{
  "should_end": true/false,
  "reason": "One sentence why",
  "assessment": "not_qualified" | "qualified" | "highly_qualified" | "needs_more_info"
}`;

    const evalResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert interviewer making decisions about interview continuation.' },
        { role: 'user', content: evaluationPrompt }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    try {
      const evalContent = evalResponse.choices[0].message.content;
      const jsonMatch = evalContent.match(/\{[\s\S]*\}/);
      const decision = JSON.parse(jsonMatch ? jsonMatch[0] : evalContent);
      
      if (decision.should_end || questionNumber >= 10) {
        return {
          should_end_interview: true,
          end_reason: decision.reason || 'Interview complete',
          assessment: decision.assessment
        };
      }
    } catch (e) {
      console.error('Failed to parse decision:', e);
    }
  }

  // Generate next question
  const systemPrompt = `You are a Senior Technical Interviewer conducting a professional technical interview. Act like a real person having a conversation, not a robot.

Your interviewing style:
- Ask questions naturally, like a real interview conversation
- Listen to what they say and respond accordingly - don't repeat back what they just told you
- If an answer is vague, ask ONE specific follow-up question to dig deeper
- Move the conversation forward - don't get stuck on one topic
- Be direct but conversational

Job Description: ${jobDescription}
Job Requirements: ${JSON.stringify(jobRequirements)}

Question ${questionNumber} - ${
  questionNumber === 1 
    ? 'Start conversationally. Ask about their background and relevant experience.'
    : questionNumber === 2
    ? 'Based on their answer, dig into one specific area they mentioned.'
    : questionNumber <= 5
    ? 'Ask a technical question about core job requirements.'
    : questionNumber <= 8
    ? 'Present a realistic scenario or problem they might face in this role.'
    : 'Final questions - test depth, decision-making, or anything they seem weak on.'
}

IMPORTANT:
- Ask ONE clear question
- Respond naturally to what they said
- Keep the conversation flowing
- Sound like a human interviewer`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ],
    temperature: 0.8,
    max_tokens: 300,
  });

  return { question: response.choices[0].message.content };
}

/**
 * Evaluate complete interview
 */
async function evaluateInterview(jobDescription, jobRequirements, transcript) {
  const fullTranscript = transcript.map(entry => 
    `${entry.role.toUpperCase()}: ${entry.message}`
  ).join('\n\n');

  const evaluationPrompt = `You are evaluating a technical interview. Analyze the full transcript and provide scores.

Job Description: ${jobDescription}
Requirements: ${JSON.stringify(jobRequirements)}

FULL TRANSCRIPT:
${fullTranscript}

Evaluate the candidate on:
1. Technical Knowledge (0-100): Deep understanding of required technologies and concepts
2. Problem-Solving Skills (0-100): Ability to think through problems systematically
3. Communication (0-100): Clarity, articulation, and ability to explain technical concepts

Be STRICT in your evaluation:
- Vague answers should score low
- Lack of specifics or examples should be penalized
- Buzzwords without substance should be flagged
- Strong, detailed, specific answers with real examples should score high

Provide:
1. technical_score (0-100)
2. problem_solving_score (0-100)
3. communication_score (0-100)
4. overall_score (0-100) - weighted average
5. feedback (2-3 paragraphs)
6. recommendation: "strong_hire", "hire", "maybe", or "no_hire"

Respond ONLY with valid JSON in this exact format:
{
  "technical_score": 75,
  "problem_solving_score": 80,
  "communication_score": 70,
  "overall_score": 75,
  "feedback": "Detailed feedback here...",
  "recommendation": "hire"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an expert technical interviewer evaluating candidates. Respond only with valid JSON.' },
      { role: 'user', content: evaluationPrompt }
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  try {
    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch (e) {
    console.error('Failed to parse evaluation JSON:', e);
    return {
      technical_score: 60,
      problem_solving_score: 60,
      communication_score: 60,
      overall_score: 60,
      feedback: 'Interview evaluation completed. The candidate demonstrated varying levels of competency.',
      recommendation: 'maybe'
    };
  }
}

module.exports = {
  analyzeResume,
  generateInterviewQuestion,
  evaluateInterview,
};

/**
 * Test script to verify question generation doesn't repeat
 * Run: node test-question-generation.js
 */

require('dotenv').config();
const aiService = require('./services/ai-service');

async function testQuestionGeneration() {
  console.log('🧪 Testing AI Question Generation\n');
  
  const jobDescription = 'We are looking for a Senior Full Stack Developer with expertise in React, Node.js, and PostgreSQL.';
  const jobRequirements = {
    title: 'Senior Full Stack Developer',
    skills_required: ['React', 'Node.js', 'PostgreSQL', 'REST APIs', 'Git'],
    requirements: 'Must have 5+ years of experience in web development'
  };
  
  const transcript = [];
  
  console.log('📋 Job:', jobRequirements.title);
  console.log('📋 Skills Required:', jobRequirements.skills_required.join(', '));
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Generate 5 questions with simulated answers
  for (let i = 1; i <= 5; i++) {
    console.log(`\n🤖 Generating Question ${i}...`);
    console.log(`📊 Transcript length: ${transcript.length} messages\n`);
    
    try {
      const result = await aiService.generateInterviewQuestion(
        jobDescription,
        jobRequirements,
        transcript,
        i
      );
      
      if (result.should_end_interview) {
        console.log('🏁 Interview should end:', result.end_reason);
        break;
      }
      
      const question = result.question;
      console.log(`❓ Question ${i}:`);
      console.log(`   ${question}\n`);
      
      // Add question to transcript
      transcript.push({
        role: 'ai',
        message: question,
        timestamp: new Date().toISOString(),
        question_number: i
      });
      
      // Simulate candidate answer
      const simulatedAnswers = [
        'I have 6 years of experience as a full-stack developer, primarily working with React on the frontend and Node.js on the backend. I\'ve built several large-scale web applications.',
        'I recently built a real-time analytics dashboard using React with Redux for state management. It handled data from multiple APIs and displayed interactive charts.',
        'I use PostgreSQL for most projects. I design schemas with proper normalization, use indexes for performance, and implement migrations for version control.',
        'I follow RESTful principles with proper HTTP methods, status codes, and resource naming. I also implement authentication with JWT tokens and rate limiting.',
        'I use Git with feature branches and pull requests. I write clear commit messages and use tools like Husky for pre-commit hooks.'
      ];
      
      const answer = simulatedAnswers[i - 1] || 'That\'s a great question. Let me think about that...';
      
      console.log(`💬 Simulated Answer ${i}:`);
      console.log(`   ${answer}\n`);
      
      // Add answer to transcript
      transcript.push({
        role: 'candidate',
        message: answer,
        timestamp: new Date().toISOString(),
        question_number: i
      });
      
      console.log('─'.repeat(80));
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('❌ Error generating question:', error.message);
      break;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Test Complete!\n');
  console.log('📊 Final Statistics:');
  console.log(`   Total messages in transcript: ${transcript.length}`);
  console.log(`   Questions asked: ${transcript.filter(m => m.role === 'ai').length}`);
  console.log(`   Answers given: ${transcript.filter(m => m.role === 'candidate').length}`);
  
  // Check for repetition
  const questions = transcript.filter(m => m.role === 'ai').map(m => m.message);
  const uniqueQuestions = new Set(questions);
  
  console.log(`\n🔍 Repetition Check:`);
  console.log(`   Total questions: ${questions.length}`);
  console.log(`   Unique questions: ${uniqueQuestions.size}`);
  
  if (questions.length === uniqueQuestions.size) {
    console.log('   ✅ All questions are unique!');
  } else {
    console.log('   ⚠️  Some questions were repeated!');
    console.log('\n   Questions:');
    questions.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.substring(0, 80)}...`);
    });
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Run test
testQuestionGeneration()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });


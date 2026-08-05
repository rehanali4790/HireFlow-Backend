const aiService = require('./services/ai-service');

async function testQuestionLimit() {
  console.log('🧪 Testing AI Interview Question Limit Logic\n');
  
  const testCases = [
    { maxQuestions: 3, description: '3 questions (short interview)' },
    { maxQuestions: 4, description: '4 questions (short interview)' },
    { maxQuestions: 5, description: '5 questions (medium interview)' },
    { maxQuestions: 8, description: '8 questions (standard interview)' },
    { maxQuestions: 10, description: '10 questions (long interview)' },
  ];
  
  const jobDescription = 'Senior Backend Developer position';
  const jobRequirements = {
    title: 'Senior Backend Developer',
    skills_required: ['Node.js', 'PostgreSQL', 'REST APIs'],
    requirements: 'Experience with backend development'
  };
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test Case: ${testCase.description}`);
    console.log(`   Max Questions: ${testCase.maxQuestions}`);
    console.log('   ---');
    
    let questionNumber = 1;
    let shouldContinue = true;
    const transcript = [];
    
    while (shouldContinue && questionNumber <= testCase.maxQuestions + 1) {
      try {
        console.log(`   Question ${questionNumber}/${testCase.maxQuestions}:`);
        
        const result = await aiService.generateInterviewQuestion(
          jobDescription,
          jobRequirements,
          transcript,
          questionNumber,
          testCase.maxQuestions
        );
        
        if (result.should_end_interview) {
          console.log(`   ❌ Interview ended: ${result.end_reason}`);
          console.log(`   Assessment: ${result.assessment}`);
          shouldContinue = false;
          
          if (questionNumber <= testCase.maxQuestions) {
            console.log(`   ⚠️  WARNING: Ended at question ${questionNumber}, expected ${testCase.maxQuestions}`);
          } else {
            console.log(`   ✅ Correctly ended after ${testCase.maxQuestions} questions`);
          }
        } else {
          console.log(`   ✅ Question generated successfully`);
          
          // Add mock question and response to transcript
          transcript.push({
            role: 'ai',
            message: result.question || 'Test question',
            timestamp: new Date().toISOString()
          });
          
          transcript.push({
            role: 'candidate',
            message: 'I have experience with Node.js and PostgreSQL. I built several REST APIs.',
            timestamp: new Date().toISOString()
          });
          
          questionNumber++;
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        shouldContinue = false;
      }
    }
    
    console.log(`   Final: Asked ${questionNumber - 1} questions out of ${testCase.maxQuestions} planned`);
  }
  
  console.log('\n✅ Test completed!');
  console.log('\nExpected behavior:');
  console.log('- Short interviews (≤5 questions): Should ask ALL questions');
  console.log('- Long interviews (>5 questions): May end early only if candidate is clearly not qualified');
}

testQuestionLimit().catch(console.error);

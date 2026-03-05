import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║              SEEDING DEMO DATA TO SUPABASE                     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

async function seedDemoData() {
  try {
    console.log('🌱 Starting data seeding process...\n');

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('⚠️  No authenticated user found.');
      console.log('📝 To seed demo data:\n');
      console.log('   1. Run: npm run dev');
      console.log('   2. Sign up as an employer');
      console.log('   3. Run this script again: npm run db:seed\n');
      return;
    }

    console.log('✅ Authenticated user found:', user.email);

    const { data: employer, error: empError } = await supabase
      .from('employers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (empError) throw empError;

    if (!employer) {
      console.log('⚠️  No employer profile found.');
      console.log('📝 Please create an employer profile first by signing up.\n');
      return;
    }

    console.log('✅ Employer profile found\n');
    console.log('📊 Creating demo jobs...');

    const demoJobs = [
      {
        employer_id: employer.id,
        title: 'Senior Full Stack Engineer',
        description: 'We are looking for an experienced Full Stack Engineer to join our growing team. You will work on building scalable web applications using modern technologies.',
        requirements: 'Bachelor\'s degree in Computer Science or equivalent\n5+ years of professional experience\nStrong knowledge of React, Node.js, and TypeScript\nExperience with cloud platforms (AWS/GCP)\nExcellent problem-solving skills',
        responsibilities: 'Design and implement new features\nWrite clean, maintainable code\nCollaborate with cross-functional teams\nMentor junior developers\nParticipate in code reviews',
        skills_required: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'REST APIs', 'Git'],
        location: 'San Francisco, CA',
        work_type: 'full-time',
        remote_policy: 'hybrid',
        salary_min: 140000,
        salary_max: 180000,
        salary_currency: 'USD',
        experience_level: 'senior',
        status: 'active',
        positions_available: 2
      },
      {
        employer_id: employer.id,
        title: 'Product Designer',
        description: 'Join our design team to create beautiful, user-friendly interfaces for our SaaS platform.',
        requirements: '3+ years of product design experience\nProficiency in Figma and design systems\nStrong portfolio demonstrating UI/UX skills\nExperience with user research and testing',
        responsibilities: 'Create wireframes and prototypes\nDesign user interfaces\nConduct user research\nCollaborate with engineering teams\nMaintain design system',
        skills_required: ['Figma', 'UI/UX Design', 'Prototyping', 'User Research', 'Design Systems'],
        location: 'New York, NY',
        work_type: 'full-time',
        remote_policy: 'remote',
        salary_min: 100000,
        salary_max: 140000,
        salary_currency: 'USD',
        experience_level: 'mid',
        status: 'active',
        positions_available: 1
      },
      {
        employer_id: employer.id,
        title: 'DevOps Engineer',
        description: 'We need a skilled DevOps engineer to manage our infrastructure and deployment pipelines.',
        requirements: 'Strong experience with Kubernetes and Docker\nKnowledge of CI/CD pipelines\nExperience with infrastructure as code (Terraform)\nCloud platform expertise (AWS or GCP)',
        responsibilities: 'Manage cloud infrastructure\nAutomate deployment processes\nMonitor system performance\nImplement security best practices\nSupport development teams',
        skills_required: ['Kubernetes', 'Docker', 'Terraform', 'AWS', 'CI/CD', 'Linux', 'Python'],
        location: 'Austin, TX',
        work_type: 'full-time',
        remote_policy: 'hybrid',
        salary_min: 120000,
        salary_max: 160000,
        salary_currency: 'USD',
        experience_level: 'senior',
        status: 'active',
        positions_available: 1
      }
    ];

    const { data: createdJobs, error: jobError } = await supabase
      .from('jobs')
      .insert(demoJobs)
      .select();

    if (jobError) throw jobError;

    console.log(`✅ Created ${createdJobs.length} demo jobs\n`);
    console.log('📊 Creating demo candidates...');

    const demoCandidates = [
      {
        email: 'john.doe@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1-555-0101',
        location: 'San Francisco, CA',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        skills: ['React', 'TypeScript', 'Node.js', 'AWS', 'PostgreSQL'],
        experience_years: 6,
        cover_letter: 'I am excited to apply for the Senior Full Stack Engineer position. With over 6 years of experience building scalable web applications, I believe I would be a great fit for your team.'
      },
      {
        email: 'sarah.smith@example.com',
        first_name: 'Sarah',
        last_name: 'Smith',
        phone: '+1-555-0102',
        location: 'New York, NY',
        linkedin_url: 'https://linkedin.com/in/sarahsmith',
        skills: ['Figma', 'UI/UX Design', 'Prototyping', 'User Research'],
        experience_years: 4,
        cover_letter: 'As a passionate product designer with 4 years of experience, I would love to contribute to your design team.'
      },
      {
        email: 'mike.johnson@example.com',
        first_name: 'Mike',
        last_name: 'Johnson',
        phone: '+1-555-0103',
        location: 'Austin, TX',
        linkedin_url: 'https://linkedin.com/in/mikejohnson',
        skills: ['Kubernetes', 'Docker', 'Terraform', 'AWS', 'Python'],
        experience_years: 7,
        cover_letter: 'I am interested in the DevOps Engineer role. My extensive experience with cloud infrastructure and automation makes me an ideal candidate.'
      },
      {
        email: 'emily.chen@example.com',
        first_name: 'Emily',
        last_name: 'Chen',
        phone: '+1-555-0104',
        location: 'Seattle, WA',
        linkedin_url: 'https://linkedin.com/in/emilychen',
        skills: ['React', 'JavaScript', 'CSS', 'Node.js', 'MongoDB'],
        experience_years: 5,
        cover_letter: 'I am very interested in joining your engineering team and contributing to building great products.'
      }
    ];

    const { data: createdCandidates, error: candError } = await supabase
      .from('candidates')
      .insert(demoCandidates)
      .select();

    if (candError) throw candError;

    console.log(`✅ Created ${createdCandidates.length} demo candidates\n`);
    console.log('📊 Creating demo applications...');

    const demoApplications = [
      {
        job_id: createdJobs[0].id,
        candidate_id: createdCandidates[0].id,
        status: 'screening',
        overall_score: 85,
        application_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        job_id: createdJobs[0].id,
        candidate_id: createdCandidates[3].id,
        status: 'applied',
        overall_score: 72,
        application_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        job_id: createdJobs[1].id,
        candidate_id: createdCandidates[1].id,
        status: 'testing',
        overall_score: 88,
        application_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        job_id: createdJobs[2].id,
        candidate_id: createdCandidates[2].id,
        status: 'ai_interview',
        overall_score: 91,
        application_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const { data: createdApps, error: appError } = await supabase
      .from('applications')
      .insert(demoApplications)
      .select();

    if (appError) throw appError;

    console.log(`✅ Created ${createdApps.length} demo applications\n`);
    console.log('📊 Creating demo resume scores...');

    const demoScores = [
      {
        application_id: createdApps[0].id,
        overall_score: 85,
        skills_match_score: 90,
        experience_score: 85,
        education_score: 80,
        keywords_matched: ['React', 'TypeScript', 'Node.js', 'AWS'],
        keywords_missing: ['GraphQL', 'Microservices'],
        ai_summary: 'Strong candidate with excellent technical skills and relevant experience. Good fit for senior role.',
        strengths: ['Extensive React experience', 'Strong TypeScript skills', 'AWS expertise'],
        weaknesses: ['Limited GraphQL experience'],
        recommendation: 'strong_yes'
      },
      {
        application_id: createdApps[1].id,
        overall_score: 72,
        skills_match_score: 75,
        experience_score: 70,
        education_score: 70,
        keywords_matched: ['React', 'JavaScript', 'Node.js'],
        keywords_missing: ['TypeScript', 'AWS', 'PostgreSQL'],
        ai_summary: 'Good candidate with solid fundamentals. Would benefit from more experience with TypeScript and cloud platforms.',
        strengths: ['Solid React knowledge', 'Good problem-solving skills'],
        weaknesses: ['Limited TypeScript experience', 'No cloud platform experience'],
        recommendation: 'maybe'
      },
      {
        application_id: createdApps[2].id,
        overall_score: 88,
        skills_match_score: 92,
        experience_score: 85,
        education_score: 85,
        keywords_matched: ['Figma', 'UI/UX', 'Prototyping', 'User Research'],
        keywords_missing: [],
        ai_summary: 'Excellent designer with strong portfolio and relevant experience. Perfect match for the role.',
        strengths: ['Strong Figma skills', 'Excellent portfolio', 'User research experience'],
        weaknesses: [],
        recommendation: 'strong_yes'
      },
      {
        application_id: createdApps[3].id,
        overall_score: 91,
        skills_match_score: 95,
        experience_score: 90,
        education_score: 85,
        keywords_matched: ['Kubernetes', 'Docker', 'Terraform', 'AWS', 'Python'],
        keywords_missing: [],
        ai_summary: 'Outstanding DevOps engineer with comprehensive skills and extensive experience. Highly recommended.',
        strengths: ['Expert Kubernetes knowledge', 'Strong automation skills', 'Excellent cloud expertise'],
        weaknesses: [],
        recommendation: 'strong_yes'
      }
    ];

    const { error: scoreError } = await supabase
      .from('resume_scores')
      .insert(demoScores);

    if (scoreError) throw scoreError;

    console.log(`✅ Created ${demoScores.length} resume scores\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 Demo data seeded successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • ${createdJobs.length} jobs created`);
    console.log(`   • ${createdCandidates.length} candidates created`);
    console.log(`   • ${createdApps.length} applications created`);
    console.log(`   • ${demoScores.length} resume scores created\n`);
    console.log('🚀 You can now view the demo data in your dashboard!\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

seedDemoData();

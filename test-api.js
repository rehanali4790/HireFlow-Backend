// Quick API test script
const http = require('http');

function testEndpoint(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing HireFlow API...\n');

  // Test 1: Health check
  console.log('1. Testing health endpoint...');
  try {
    const result = await testEndpoint('/api/health');
    console.log(`   ✅ Status: ${result.status}`);
    console.log(`   Response:`, result.data);
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
  }

  // Test 2: Upload endpoint
  console.log('\n2. Testing upload endpoint (should fail without file)...');
  try {
    const result = await testEndpoint('/api/upload/picture', 'POST');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, result.data);
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
  }

  // Test 3: Applications endpoint (GET)
  console.log('\n3. Testing applications list (should fail without auth)...');
  try {
    const result = await testEndpoint('/api/applications', 'GET');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, result.data);
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
  }

  console.log('\n✅ Tests complete!');
}

runTests().catch(console.error);

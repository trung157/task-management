const axios = require('axios');

async function testCategoriesAPI() {
  try {
    console.log('🔐 Testing login...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'vinhtrung15799@gmail.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful, token received');
    
    // Test categories API
    console.log('\n📂 Testing categories API...');
    const categoriesResponse = await axios.get('http://localhost:5000/api/categories', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Categories API successful');
    console.log('Categories:', categoriesResponse.data.data.length);
    categoriesResponse.data.data.forEach(cat => {
      console.log(`   - ${cat.name} (${cat.color})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testCategoriesAPI();

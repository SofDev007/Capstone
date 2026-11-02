import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth/admin/create-default';

console.log('Creating default admin account...');
console.log('Make sure the backend server is running on port 5000\n');

axios.post(API_URL)
  .then(response => {
    console.log('✅ Success!');
    console.log('Response:', response.data);
    console.log('\nYou can now login with:');
    console.log('Email: admin@transport.com');
    console.log('Password: admin123');
  })
  .catch(error => {
    if (error.response) {
      console.error('❌ Error:', error.response.data.message || error.response.data);
      if (error.response.data.message === 'Default admin already exists') {
        console.log('\n✅ Admin already exists! You can login with:');
        console.log('Email: admin@transport.com');
        console.log('Password: admin123');
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to server!');
      console.error('Make sure the backend is running:');
      console.error('  cd backend');
      console.error('  npm run dev');
    } else {
      console.error('❌ Error:', error.message);
    }
  });


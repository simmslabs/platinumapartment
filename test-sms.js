// Test MNotify SMS functionality
const { mnotifyService } = require('./app/utils/mnotify.server');

async function testSMS() {
  try {
    console.log('Testing MNotify SMS service...');
    
    // Test SMS
    const result = await mnotifyService.sendSMS({
      recipient: '+233123456789', // Replace with a test phone number
      message: 'Test: Your check-in date has been updated. This is a test message from Platinum Apartment Management.',
    });
    
    console.log('SMS Test Result:', result);
    
    if (result.status === 'success') {
      console.log('✅ SMS sent successfully!');
    } else {
      console.log('❌ SMS failed:', result.message);
    }
  } catch (error) {
    console.error('❌ Error testing SMS:', error.message);
  }
}

// Only run test if environment variables are set
if (process.env.MNOTIFY_API_KEY) {
  testSMS();
} else {
  console.log('⚠️ MNOTIFY_API_KEY not found in environment variables. Skipping SMS test.');
  console.log('To test SMS functionality, set your MNotify API key in the environment.');
}

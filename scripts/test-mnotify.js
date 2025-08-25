#!/usr/bin/env node

/**
 * Test script for Mnotify SMS API integration
 * Run with: node scripts/test-mnotify.js
 */

require('dotenv').config();

async function testMnotifyAPI() {
  const apiKey = process.env.MNOTIFY_API_KEY;
  const senderId = process.env.MNOTIFY_SENDER_ID || "PlatinumApt";
  
  if (!apiKey) {
    console.error('❌ MNOTIFY_API_KEY not found in .env file');
    console.log('Please add your Mnotify API key to the .env file:');
    console.log('MNOTIFY_API_KEY=your-mnotify-api-key-here');
    return;
  }

  // Test phone number (replace with your actual phone number for testing)
  const testPhone = "233241234567"; // Ghana format
  const testMessage = "Test SMS from Platinum Apartment Management System. If you receive this, the integration is working!";

  console.log('🧪 Testing Mnotify SMS API...');
  console.log(`📱 Sending to: ${testPhone}`);
  console.log(`📧 Sender ID: ${senderId}`);
  console.log(`💬 Message: ${testMessage}`);
  console.log('⏳ Please wait...\n');

  const payload = {
    key: apiKey,
    to: testPhone,
    msg: testMessage,
    sender_id: senderId
  };

  try {
    const response = await fetch('https://api.mnotify.com/api/sms/quick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    console.log('📋 API Response:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.code === '2000' || result.status === 'success') {
      console.log('\n✅ SMS sent successfully!');
      console.log('✅ Mnotify integration is working correctly');
    } else {
      console.log('\n❌ SMS failed to send');
      console.log(`❌ Error: ${result.message || result.status}`);
      
      // Common error explanations
      switch (result.code) {
        case '1000':
          console.log('💡 Solution: Check your API key in the .env file');
          break;
        case '1002':
          console.log('💡 Solution: Top up your Mnotify account balance');
          break;
        case '1003':
          console.log('💡 Solution: Check the phone number format (should be 233XXXXXXXXX for Ghana)');
          break;
        case '1004':
          console.log('💡 Solution: Check your sender ID or get it approved by Mnotify');
          break;
        case '1005':
          console.log('💡 Solution: Message is too long (max 160 characters for single SMS)');
          break;
        default:
          console.log('💡 Check the Mnotify documentation or contact their support');
      }
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.log('💡 Check your internet connection and try again');
  }
}

// Run the test
testMnotifyAPI();

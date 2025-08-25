/**
 * Test script for Mnotify SMS API integration
 * Run with: bun run scripts/test-mnotify.ts
 */

import { mnotifyService } from '../app/utils/mnotify.server';

async function testMnotifyAPI() {
  if (!process.env.MNOTIFY_API_KEY) {
    console.error('❌ MNOTIFY_API_KEY not found in .env file');
    console.log('Please add your Mnotify API key to the .env file:');
    console.log('MNOTIFY_API_KEY=your-mnotify-api-key-here');
    return;
  }

  // Test phone number (replace with your actual phone number for testing)
  const testPhone = "233241234567"; // Ghana format
  
  console.log('🧪 Testing Mnotify SMS API using the service utility...');
  console.log(`� Test phone: ${testPhone}`);
  console.log('⏳ Please wait...\n');

  try {
    // Test 1: Check account balance
    console.log('1️⃣ Testing account balance...');
    try {
      const balance = await mnotifyService.checkBalance();
      console.log(`✅ Account Balance: ${balance.balance} ${balance.currency}`);
    } catch (error) {
      console.log(`❌ Balance check failed: ${error}`);
    }

    // Test 2: Send a simple SMS
    console.log('\n2️⃣ Testing basic SMS sending...');
    const basicResult = await mnotifyService.sendSMS({
      recipient: testPhone,
      message: "Test SMS from Platinum Apartment Management System. Integration working!"
    });
    
    console.log('📋 Basic SMS Response:');
    console.log(JSON.stringify(basicResult, null, 2));
    
    if (basicResult.status === 'success' || basicResult.code === '2000') {
      console.log('✅ Basic SMS sent successfully!');
    } else {
      console.log('❌ Basic SMS failed');
    }

    // Test 3: Send checkout reminder (apartment-specific template)
    console.log('\n3️⃣ Testing checkout reminder template...');
    const checkoutResult = await mnotifyService.sendCheckOutReminder(
      testPhone,
      "John",
      "101",
      "Aug 26, 2025"
    );
    
    console.log('� Checkout Reminder Response:');
    console.log(JSON.stringify(checkoutResult, null, 2));
    
    if (checkoutResult.status === 'success' || checkoutResult.code === '2000') {
      console.log('✅ Checkout reminder sent successfully!');
    } else {
      console.log('❌ Checkout reminder failed');
    }

    // Test 4: Send welcome message
    console.log('\n4️⃣ Testing welcome message template...');
    const welcomeResult = await mnotifyService.sendWelcomeMessage(
      testPhone,
      "John",
      "101"
    );
    
    console.log('� Welcome Message Response:');
    console.log(JSON.stringify(welcomeResult, null, 2));
    
    if (welcomeResult.status === 'success' || welcomeResult.code === '2000') {
      console.log('✅ Welcome message sent successfully!');
    } else {
      console.log('❌ Welcome message failed');
    }

    console.log('\n🎉 Mnotify integration test completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.log('💡 Check your API configuration and network connection');
  }
}

// Run the test
testMnotifyAPI();

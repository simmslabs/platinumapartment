/**
 * Test script for the checkout reminders cron job with all user notifications
 * Run with: bun run scripts/test-checkout-cron.ts
 */

async function testCheckoutCron() {
  const cronSecret = process.env.CRON_SECRET_KEY;
  
  if (!cronSecret || cronSecret === 'your-secret-cron-key-here') {
    console.error('❌ CRON_SECRET_KEY not configured');
    console.log('Please set a proper CRON_SECRET_KEY in your .env file');
    return;
  }

  console.log('🧪 Testing Checkout Reminders Cron Job...');
  console.log('🔔 This will alert ALL users in the system');
  console.log('⏳ Calling the cron endpoint...\n');

  try {
    const response = await fetch(`http://localhost:8081/api/cron/checkout-reminders?key=${cronSecret}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Cron job executed successfully!');
      console.log('\n📊 Summary:');
      console.log(`   • Total active bookings: ${result.summary.totalActiveBookings}`);
      console.log(`   • Notifications sent to guests: ${result.summary.notificationsSent}`);
      console.log(`   • SMS successful: ${result.summary.smsSuccessful}`);
      console.log(`   • SMS failed: ${result.summary.smsFailed}`);
      console.log(`   • All users notified: ${result.summary.allUsersNotified ? 'Yes' : 'No'}`);
      console.log(`   • Timestamp: ${result.summary.timestamp}`);
      
      if (result.notifications && result.notifications.length > 0) {
        console.log('\n📋 Tenant Notifications Sent:');
        result.notifications.forEach((notification: { guest: string; room: string; checkOut: string; daysRemaining: number; completionPercentage: number; phoneNumber: string }, index: number) => {
          console.log(`   ${index + 1}. ${notification.guest} - Room ${notification.room}`);
          console.log(`      Check out: ${notification.checkOut} (${notification.daysRemaining} days remaining)`);
          console.log(`      Stay completion: ${notification.completionPercentage}%`);
          console.log(`      Phone: ${notification.phoneNumber}`);
        });
      } else {
        console.log('\n📋 No guests meeting 75% completion criteria at this time');
      }
      
      if (result.smsResults && result.smsResults.length > 0) {
        console.log('\n📱 SMS Results:');
        result.smsResults.forEach((sms: { success: boolean; guest: string; phone: string; error?: string }) => {
          const status = sms.success ? '✅' : '❌';
          console.log(`   ${status} ${sms.guest} (${sms.phone})`);
          if (sms.error) console.log(`      Error: ${sms.error}`);
        });
      }
      
      console.log('\n🔔 All Users Notified:');
      console.log('   • In-app notifications created for all users');
      console.log('   • Email summaries sent to all users');
      console.log('   • SMS system alerts sent to all users with phone numbers');
      console.log('   • Staff/Admin users receive detailed notifications');
      console.log('   • Regular users receive general system status notifications');
      
    } else {
      console.log('❌ Cron job failed');
      console.log(`   Error: ${result.error || result.message}`);
      console.log(`   Status: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Network error calling cron endpoint:', error);
    console.log('💡 Make sure the development server is running on port 8081');
  }
}

// Run the test
testCheckoutCron();

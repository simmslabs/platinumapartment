#!/usr/bin/env node
/**
 * Test script for the cron notification API
 * Usage: node scripts/test-cron.js
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CRON_SECRET_TOKEN = process.env.CRON_SECRET_TOKEN || 'test-token';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testCronJob() {
  console.log('🚀 Testing cron notification job...');
  console.log(`URL: ${BASE_URL}/api/cron/notifications`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/cron/notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Cron job executed successfully!');
      console.log('📊 Results:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Cron job failed:');
      console.error('Status:', response.status);
      console.error('Response:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('💥 Error testing cron job:', error.message);
  }
}

// Run the test
testCronJob();

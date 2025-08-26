// Check R2 configuration
console.log('=== R2 Environment Variables ===');
console.log('R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? 'SET' : 'NOT SET');
console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME ? 'SET' : 'NOT SET');
console.log('R2_PUBLIC_URL:', process.env.R2_PUBLIC_URL ? 'SET' : 'NOT SET');

const { isR2Configured } = require('./app/utils/r2.server.ts');

console.log('\n=== R2 Configuration Status ===');
try {
  console.log('Is R2 Configured:', isR2Configured());
} catch (error) {
  console.log('Error checking R2 configuration:', error.message);
}

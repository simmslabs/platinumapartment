# Checkout Reminder Cron Job Setup

This guide explains how to set up the automated checkout reminder system that sends SMS notifications twice daily to guests who have completed 75% of their stay duration.

## Overview

The system sends:
- **SMS notifications** to guests who have completed 75% of their stay duration
- **Email notifications** to staff members summarizing the reminders sent
- **In-app notifications** to both guests and staff

## API Endpoint

**URL:** `/api/cron/checkout-reminders`
**Method:** POST
**Authentication:** Requires `CRON_SECRET_KEY` parameter

## Environment Variables Required

Add these to your `.env` file:

```bash
# Cron job security
CRON_SECRET_KEY=your-secret-cron-key-here

# Mnotify SMS Service
MNOTIFY_API_KEY=your-mnotify-api-key
MNOTIFY_SENDER_ID=PlatinumApt

# Email service (already configured if using Resend)
RESEND_API_KEY=your-resend-api-key
```

## SMS Service Implementation

The system uses the **existing Mnotify service utility** located in `app/utils/mnotify.server.ts`. This service provides comprehensive SMS functionality including:

- **Basic SMS sending**
- **Apartment-specific templates** (booking confirmations, check-in/out reminders, payment reminders)
- **Bulk SMS capabilities**
- **WhatsApp messaging** (if supported)
- **Voice call notifications**
- **Account balance checking**

### Pre-built Templates Available

The checkout reminder system uses the `sendCheckOutReminder()` method which sends:
```
"Dear [GuestName], your check-out from Room [RoomNumber] is due at [CheckOutTime]. Please ensure all belongings are packed. Thank you for staying with us!"
```

### Other Available Templates

1. **Booking Confirmation**: `sendBookingConfirmation()`
2. **Check-in Reminder**: `sendCheckInReminder()`
3. **Payment Reminder**: `sendPaymentReminder()`
4. **Maintenance Notification**: `sendMaintenanceNotification()`
5. **Staff Alert**: `sendStaffAlert()`
6. **Overdue Alert**: `sendOverdueAlert()`
7. **Welcome Message**: `sendWelcomeMessage()`

### Mnotify Setup

1. **Sign up for Mnotify**: Visit [mnotify.com](https://mnotify.com) and create an account
2. **Get your API Key**: From your dashboard, copy your API key
3. **Configure Sender ID**: Set up a sender ID (up to 11 characters, e.g., "PlatinumApt")
4. **Add environment variables**:

```bash
MNOTIFY_API_KEY=your-mnotify-api-key-here
MNOTIFY_SENDER_ID=PlatinumApt
```

### Phone Number Format

The Mnotify service automatically handles phone number formatting:
- **Ghana numbers**: Converts to `233XXXXXXXXX` format
- **Input formats accepted**: `+233241234567`, `0241234567`, `233241234567`
- **Automatic cleaning**: Removes spaces, dashes, and parentheses

### Testing the Integration

Run the test script to verify your Mnotify setup:

```bash
# Test the Mnotify service
bun run scripts/test-mnotify.ts
```

This will test:
- Account balance retrieval
- Basic SMS sending
- Checkout reminder template
- Welcome message template

### Alternative SMS Providers

If you prefer to use other SMS providers, you can replace the Mnotify implementation:

#### Option 1: Twilio
```typescript
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const smsService = {
  async sendSMS(to: string, message: string) {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
  }
};
```

#### Option 2: AWS SNS
```typescript
import { SNS } from 'aws-sdk';

const sns = new SNS({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const smsService = {
  async sendSMS(to: string, message: string) {
    await sns.publish({
      PhoneNumber: to,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'PlatinumApt'
        }
      }
    }).promise();
  }
};
```

## Cron Job Scheduling

### Option 1: Using cron on Linux/macOS

Add these entries to your crontab (`crontab -e`):

```bash
# Send checkout reminders twice daily: 9:00 AM and 6:00 PM
0 9 * * * curl -X POST "https://yourdomain.com/api/cron/checkout-reminders?key=your-secret-cron-key-here"
0 18 * * * curl -X POST "https://yourdomain.com/api/cron/checkout-reminders?key=your-secret-cron-key-here"
```

### Option 2: Using GitHub Actions (for deployed apps)

Create `.github/workflows/checkout-reminders.yml`:

```yaml
name: Checkout Reminders

on:
  schedule:
    # Run twice daily at 9:00 AM and 6:00 PM UTC
    - cron: '0 9 * * *'
    - cron: '0 18 * * *'
  workflow_dispatch: # Allow manual triggering

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Send checkout reminders
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/cron/checkout-reminders?key=${{ secrets.CRON_SECRET_KEY }}"
```

### Option 3: Using Vercel Cron (for Vercel deployments)

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/checkout-reminders?key=your-secret-key",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/checkout-reminders?key=your-secret-key",
      "schedule": "0 18 * * *"
    }
  ]
}
```

### Option 4: Using a Third-party Service

#### EasyCron.com
1. Sign up at easycron.com
2. Create a new cron job with URL: `https://yourdomain.com/api/cron/checkout-reminders?key=your-secret-key`
3. Set schedule: `0 9,18 * * *` (twice daily)

#### Cron-job.org
1. Sign up at cron-job.org
2. Create new cron job
3. URL: `https://yourdomain.com/api/cron/checkout-reminders?key=your-secret-key`
4. Schedule: Every day at 09:00 and 18:00

## Testing

### Test the endpoint manually:
```bash
curl -X POST "http://localhost:3000/api/cron/checkout-reminders?key=your-secret-cron-key-here"
```

### Expected Response:
```json
{
  "success": true,
  "message": "Checkout reminder cron completed successfully",
  "summary": {
    "totalActiveBookings": 5,
    "notificationsSent": 2,
    "smsSuccessful": 1,
    "smsFailed": 1,
    "timestamp": "2025-08-25T10:00:00.000Z"
  },
  "notifications": [...],
  "smsResults": [...]
}
```

## What Happens When the Cron Runs

1. **Finds Active Bookings**: Looks for guests currently checked in or confirmed
2. **Calculates Completion**: Determines what percentage of their stay is complete
3. **Identifies 75%+ Guests**: Finds guests who have completed 75% or more of their stay
4. **Sends SMS**: Sends SMS to guests with phone numbers
5. **Creates Notifications**: Logs notifications in the database
6. **Notifies Staff**: Sends summary email and in-app notifications to staff
7. **Returns Summary**: Provides detailed results of the operation

## Monitoring

### Logs to Monitor:
- Check application logs for SMS sending success/failures
- Monitor email delivery status
- Check database notifications table for records

### Database Queries for Monitoring:
```sql
-- Check recent notifications sent
SELECT * FROM "Notification" 
WHERE type = 'SEVENTY_FIVE_PERCENT_STAY' 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- Check SMS delivery status
SELECT 
  status,
  COUNT(*) as count
FROM "Notification" 
WHERE type = 'SEVENTY_FIVE_PERCENT_STAY' 
  AND "createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY status;
```

## Customization

### Modify the Completion Percentage:
Change the `75` in the condition to any percentage you prefer:
```typescript
if (completionPercentage >= 80) { // Changed from 75 to 80
```

### Customize SMS Message:
Edit the `guestMessage` template in the cron file:
```typescript
const guestMessage = `Custom message for ${booking.user.firstName}...`;
```

### Change Scheduling:
Modify cron expressions to run at different times:
- `0 8 * * *` - Once daily at 8:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 9,15,21 * * *` - Three times daily at 9 AM, 3 PM, 9 PM

## Troubleshooting

### Common Issues:

1. **SMS not sending**: Check Mnotify API key and sender ID configuration
2. **Unauthorized error**: Verify CRON_SECRET_KEY is set correctly
3. **No notifications sent**: Check if there are active bookings meeting the 75% criteria
4. **Email failures**: Verify RESEND_API_KEY is configured correctly

### Mnotify Specific Issues:

1. **Invalid phone number format**: 
   - Ensure phone numbers are stored in correct format in database
   - Check that number formatting logic handles your country code correctly

2. **Sender ID not approved**:
   - Contact Mnotify support to approve your sender ID
   - Use default sender ID temporarily while waiting for approval

3. **Insufficient credits**:
   - Check your Mnotify account balance
   - Top up credits if needed

4. **API rate limits**:
   - Mnotify has rate limits; if sending many SMS, add delays
   - Consider batching SMS sending if you have many guests

### Mnotify Error Codes:

- **2000**: Success
- **1000**: Invalid API key
- **1002**: Insufficient balance
- **1003**: Invalid phone number
- **1004**: Invalid sender ID
- **1005**: Message too long (max 160 characters for single SMS)

### Debug Mode:
Add logging to see what's happening:
```typescript
console.log(`Processing booking ${booking.id}: ${completionPercentage}% complete`);
console.log(`Formatted phone: ${formattedPhone}, Original: ${booking.user.phone}`);
```

### Testing Mnotify Integration:
```bash
# Test the Mnotify API directly
curl -X POST "https://api.mnotify.com/api/sms/quick" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "your-api-key",
    "to": "233241234567",
    "msg": "Test message from apartment system",
    "sender_id": "PlatinumApt"
  }'
```

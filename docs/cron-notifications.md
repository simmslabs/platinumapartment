# Cron Job Notification System

This system automatically sends SMS and email notifications to guests when they complete 75% of their stay.

## Features

- **75% Stay Notification**: Automatically detects when guests have completed 75% of their stay
- **Multi-Channel Notifications**: Sends both email and SMS notifications
- **Duplicate Prevention**: Ensures notifications are only sent once per booking
- **Error Handling**: Comprehensive error logging and reporting
- **Security**: Token-based authentication for cron job endpoint

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and configure the following:

```bash
# Required
CRON_SECRET_TOKEN=your-unique-secret-token
RESEND_API_KEY=your-resend-api-key

# SMS (choose one option)
# Option A: Twilio
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Option B: Custom webhook
SMS_WEBHOOK_URL=https://your-sms-service.com/api/send
SMS_WEBHOOK_TOKEN=your-webhook-token

# Option C: Disable SMS
ENABLE_SMS=false
```

### 2. Database Migration

The notification system requires a new `Notification` table:

```bash
npm run db:migrate
```

### 3. Setting Up Cron Job

#### Option A: Using crontab (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Add this line to run every hour
0 * * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" https://yourdomain.com/api/cron/notifications
```

#### Option B: Using GitHub Actions

Create `.github/workflows/cron-notifications.yml`:

```yaml
name: Cron Notifications
on:
  schedule:
    # Run every hour
    - cron: '0 * * * *'
  workflow_dispatch: # Allow manual triggers

jobs:
  notifications:
    runs-on: ubuntu-latest
    steps:
      - name: Send notifications
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET_TOKEN }}" \
            https://yourdomain.com/api/cron/notifications
```

#### Option C: Using Vercel Cron Jobs

Add to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 * * * *"
    }
  ]
}
```

### 4. Testing

Test the cron job locally:

```bash
node scripts/test-cron.js
```

Or test manually:

```bash
curl -X POST \
  -H "Authorization: Bearer your-cron-secret-token" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/cron/notifications
```

## API Endpoint

### POST `/api/cron/notifications`

**Headers:**
- `Authorization: Bearer YOUR_CRON_SECRET_TOKEN`

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-07-31T12:24:13.000Z",
  "results": {
    "processed": 5,
    "emailsSent": 5,
    "smsSent": 3,
    "errors": []
  }
}
```

## How It Works

1. **Detection**: The cron job runs hourly and checks for bookings where guests have completed exactly 75% of their stay
2. **Validation**: Ensures notifications haven't already been sent for the same booking on the same day
3. **Content Generation**: Creates personalized email and SMS content with booking details
4. **Delivery**: Sends notifications via configured email and SMS providers
5. **Logging**: Records successful notifications in the database

## Notification Content

### Email
- Professional HTML email with booking details
- Check-out reminders and instructions
- Branded template with Platinum Apartment styling

### SMS
- Concise text message with essential information
- Includes room number and check-out date
- Character-optimized for cost efficiency

## Error Handling

The system includes comprehensive error handling:
- Individual booking failures don't stop processing
- Email and SMS failures are logged separately
- Detailed error reporting in API response
- Graceful degradation when services are unavailable

## Security

- Token-based authentication prevents unauthorized access
- Environment-based configuration for sensitive data
- Request validation and rate limiting
- Production/development environment checks

## Monitoring

Monitor the cron job through:
- API response logs
- Database notification records
- Email/SMS provider dashboards
- Application monitoring tools

## Troubleshooting

### Common Issues

1. **No notifications sent**
   - Check that guests have phone/email in their profile
   - Verify environment variables are set correctly
   - Ensure bookings are in "CHECKED_IN" status

2. **Email delivery failures**
   - Verify RESEND_API_KEY is valid
   - Check email address format
   - Review Resend dashboard for delivery status

3. **SMS delivery failures**
   - Ensure phone numbers are in international format (+1234567890)
   - Verify SMS provider credentials
   - Check provider account balance/limits

4. **Duplicate notifications**
   - Check if cron job is running multiple times
   - Verify notification deduplication logic
   - Review database notification records

### Debug Mode

For testing, you can modify the time window in the cron job from 2 hours to a larger range to test with existing bookings.

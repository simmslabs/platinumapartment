# Email Service Setup Guide

This guide will help you set up the Resend email service for Platinum Apartment Management System.

## 1. Create a Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

## 2. Get Your API Key

1. Log in to your Resend dashboard
2. Navigate to "API Keys" in the sidebar
3. Click "Create API Key"
4. Give it a name like "Platinum Apartment"
5. Copy the generated API key

## 3. Configure Environment Variables

Update your `.env` file with your Resend API key:

```env
# Email Service (Resend)
RESEND_API_KEY="re_your_actual_api_key_here"

# Application URL (update for production)
APP_URL="http://localhost:5173"
```

## 4. Verify Domain (For Production)

For production use, you'll need to verify your domain:

1. In Resend dashboard, go to "Domains"
2. Click "Add Domain"
3. Enter your domain (e.g., `platinum-apartment.com`)
4. Follow the DNS setup instructions
5. Wait for verification

## 5. Update Email From Address

Once your domain is verified, update the `from` address in `/app/utils/email.server.ts`:

```typescript
from: 'Platinum Apartment <noreply@your-verified-domain.com>'
```

## 6. Testing the Email Service

### Development Testing
- Use the default settings for testing
- Emails will be sent to the sandbox
- Check your Resend dashboard for email logs

### Production Testing
- Ensure your domain is verified
- Test with real email addresses
- Monitor the Resend dashboard for delivery status

## 7. Email Templates

The system includes two email templates:

### Welcome Email
- Sent when a new guest is created
- Includes login credentials
- Features apartment amenities
- Branded with Platinum Apartment styling

### Booking Confirmation
- Sent when a booking is created
- Includes booking details
- Check-in/check-out information
- Total amount and booking ID

## 8. Customization

You can customize the email templates by editing:
- `generateWelcomeEmailHTML()` - Welcome email HTML template
- `generateWelcomeEmailText()` - Welcome email text template
- `generateBookingConfirmationHTML()` - Booking confirmation HTML template
- `generateBookingConfirmationText()` - Booking confirmation text template

## 9. Error Handling

The email service includes robust error handling:
- Emails won't block user creation or booking processes
- Errors are logged for debugging
- Graceful fallback if email service is unavailable

## 10. Monitoring

Monitor your email sending:
- Check Resend dashboard for delivery statistics
- Review server logs for email errors
- Set up alerts for failed deliveries

## Free Tier Limits

Resend free tier includes:
- 3,000 emails per month
- 100 emails per day
- All features included

For higher volume, consider upgrading to a paid plan.

## Support

If you encounter issues:
1. Check the Resend documentation: [https://resend.com/docs](https://resend.com/docs)
2. Verify your API key is correct
3. Check your domain verification status
4. Review server logs for specific error messages

## Security Best Practices

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Regularly rotate API keys
- Monitor usage for unusual activity
- Use verified domains in production

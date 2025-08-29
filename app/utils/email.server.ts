import { Resend } from 'resend';

// Initialize Resend with API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

interface WelcomeEmailData {
  firstName: string;
  lastName: string;
  email: string;
  temporaryPassword: string;
}

interface BookingConfirmationData {
  firstName: string;
  lastName: string;
  email: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  bookingId: string;
}

export const emailService = {
  async sendWelcomeEmail({ firstName, lastName, email, temporaryPassword }: WelcomeEmailData) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Platinum Apartment <noreply@platinum-apartment.com>',
        to: [email],
        subject: 'Welcome to Platinum Apartment!',
        html: generateWelcomeEmailHTML({ firstName, lastName, email, temporaryPassword }),
        text: generateWelcomeEmailText({ firstName, lastName, email, temporaryPassword }),
      });

      if (error) {
        console.error('Failed to send welcome email:', error);
        throw new Error(`Failed to send welcome email: ${error.message}`);
      }

      console.log('Welcome email sent successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  },

  async sendBookingConfirmation({ 
    firstName, 
    lastName, 
    email, 
    roomNumber, 
    checkIn, 
    checkOut, 
    totalAmount, 
    bookingId 
  }: BookingConfirmationData) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Platinum Apartment <noreply@platinum-apartment.com>',
        to: [email],
        subject: 'Booking Confirmation - Platinum Apartment',
        html: generateBookingConfirmationHTML({ 
          firstName, 
          lastName, 
          email, 
          roomNumber, 
          checkIn, 
          checkOut, 
          totalAmount, 
          bookingId 
        }),
        text: generateBookingConfirmationText({ 
          firstName, 
          lastName, 
          email, 
          roomNumber, 
          checkIn, 
          checkOut, 
          totalAmount, 
          bookingId 
        }),
      });

      if (error) {
        console.error('Failed to send booking confirmation:', error);
        throw new Error(`Failed to send booking confirmation: ${error.message}`);
      }

      console.log('Booking confirmation sent successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error sending booking confirmation:', error);
      throw error;
    }
  },

  async sendCustomEmail({ to, subject, html, from }: { to: string; subject: string; html: string; from?: string }) {
    try {
      const { data, error } = await resend.emails.send({
        from: from || 'Platinum Apartment <noreply@platinum-apartment.com>',
        to: [to],
        subject,
        html,
      });

      if (error) {
        console.error('Failed to send custom email:', error);
        throw new Error(`Failed to send custom email: ${error.message}`);
      }

      console.log('Custom email sent successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error sending custom email:', error);
      throw error;
    }
  },
};

function generateWelcomeEmailHTML({ firstName, lastName, email, temporaryPassword }: WelcomeEmailData): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Platinum Apartment</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .credentials {
          background: #e3f2fd;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #2196f3;
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏨 Welcome to Platinum Apartment!</h1>
      </div>
      <div class="content">
        <h2>Hello ${firstName} ${lastName}!</h2>
        
        <p>We're thrilled to welcome you to Platinum Apartment, where luxury meets comfort. Your account has been successfully created and you're now part of our exclusive community.</p>
        
        <div class="credentials">
          <h3>Your Account Details:</h3>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> <code>${temporaryPassword}</code></p>
          <p><em>⚠️ Please change your password after your first login for security purposes.</em></p>
        </div>
        
        <h3>What's Next?</h3>
        <ul>
          <li>Log in to your account using the credentials above</li>
          <li>Update your profile and change your password</li>
          <li>Explore our premium amenities and services</li>
          <li>Make your first booking and experience luxury living</li>
        </ul>
        
        <div style="text-align: center;">
          <a href="${process.env.APP_URL || 'http://localhost:5173'}/login" class="button">
            Login to Your Account
          </a>
        </div>
        
        <h3>Our Premium Amenities:</h3>
        <ul>
          <li>🛏️ Luxury furnished apartments</li>
          <li>📶 High-speed WiFi throughout the complex</li>
          <li>🚗 Complimentary parking for residents</li>
          <li>🏊‍♂️ Outdoor pool with city views</li>
          <li>🍽️ Fine dining restaurant</li>
          <li>💆‍♀️ Spa & wellness center</li>
        </ul>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact our 24/7 support team.</p>
        
        <p>Welcome aboard!</p>
        <p><strong>The Platinum Apartment Team</strong></p>
      </div>
      
      <div class="footer">
        <p>© 2025 Platinum Apartment. All rights reserved.</p>
        <p>This email was sent to ${email}. If you received this in error, please contact us.</p>
      </div>
    </body>
    </html>
  `;
}

function generateWelcomeEmailText({ firstName, lastName, email, temporaryPassword }: WelcomeEmailData): string {
  return `
Welcome to Platinum Apartment!

Hello ${firstName} ${lastName}!

We're thrilled to welcome you to Platinum Apartment, where luxury meets comfort. Your account has been successfully created and you're now part of our exclusive community.

Your Account Details:
- Email: ${email}
- Temporary Password: ${temporaryPassword}

⚠️ Please change your password after your first login for security purposes.

What's Next?
1. Log in to your account using the credentials above
2. Update your profile and change your password
3. Explore our premium amenities and services
4. Make your first booking and experience luxury living

Login URL: ${process.env.APP_URL || 'http://localhost:5173'}/login

Our Premium Amenities:
- Luxury furnished apartments
- High-speed WiFi throughout the complex
- Complimentary parking for residents
- Outdoor pool with city views
- Fine dining restaurant
- Spa & wellness center

If you have any questions or need assistance, please don't hesitate to contact our 24/7 support team.

Welcome aboard!
The Platinum Apartment Team

© 2025 Platinum Apartment. All rights reserved.
This email was sent to ${email}. If you received this in error, please contact us.
  `;
}

function generateBookingConfirmationHTML({ 
  firstName, 
  lastName, 
  email, 
  roomNumber, 
  checkIn, 
  checkOut, 
  totalAmount, 
  bookingId 
}: BookingConfirmationData): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation - Platinum Apartment</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .booking-details {
          background: #e8f5e8;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #4caf50;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin: 10px 0;
          padding: 5px 0;
          border-bottom: 1px solid #ddd;
        }
        .total-amount {
          background: #fff3cd;
          padding: 15px;
          border-radius: 5px;
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 Booking Confirmed!</h1>
      </div>
      <div class="content">
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <p>Great news! Your booking at Platinum Apartment has been confirmed. We're excited to host you and ensure you have a memorable stay.</p>
        
        <div class="booking-details">
          <h3>Booking Details:</h3>
          <div class="detail-row">
            <span><strong>Booking ID:</strong></span>
            <span>${bookingId}</span>
          </div>
          <div class="detail-row">
            <span><strong>Tenant:</strong></span>
            <span>${firstName} ${lastName}</span>
          </div>
          <div class="detail-row">
            <span><strong>Unit:</strong></span>
            <span>Unit ${roomNumber}</span>
          </div>
          <div class="detail-row">
            <span><strong>Check-in:</strong></span>
            <span>${checkIn}</span>
          </div>
          <div class="detail-row">
            <span><strong>Check-out:</strong></span>
            <span>${checkOut}</span>
          </div>
          <div class="detail-row">
            <span><strong>Email:</strong></span>
            <span>${email}</span>
          </div>
        </div>
        
        <div class="total-amount">
          Total Amount: $${totalAmount.toLocaleString()}
        </div>
        
        <h3>What to Expect:</h3>
        <ul>
          <li>Check-in starts at 3:00 PM</li>
          <li>Check-out is at 11:00 AM</li>
          <li>24/7 concierge service available</li>
          <li>Complimentary WiFi and parking</li>
          <li>Access to all apartment amenities</li>
        </ul>
        
        <h3>Need to Make Changes?</h3>
        <p>If you need to modify or cancel your booking, please contact us at least 24 hours before your check-in date.</p>
        
        <p>We look forward to welcoming you to Platinum Apartment!</p>
        
        <p><strong>The Platinum Apartment Team</strong></p>
      </div>
      
      <div class="footer">
        <p>© 2025 Platinum Apartment. All rights reserved.</p>
        <p>Questions? Contact us at support@platinum-apartment.com</p>
      </div>
    </body>
    </html>
  `;
}

function generateBookingConfirmationText({ 
  firstName, 
  lastName, 
  email, 
  roomNumber, 
  checkIn, 
  checkOut, 
  totalAmount, 
  bookingId 
}: BookingConfirmationData): string {
  return `
Booking Confirmed - Platinum Apartment

Dear ${firstName} ${lastName},

Great news! Your booking at Platinum Apartment has been confirmed. We're excited to host you and ensure you have a memorable stay.

Booking Details:
- Booking ID: ${bookingId}
- Tenant: ${firstName} ${lastName}
- Unit: Unit ${roomNumber}
- Check-in: ${checkIn}
- Check-out: ${checkOut}
- Email: ${email}
- Total Amount: $${totalAmount.toLocaleString()}

What to Expect:
- Check-in starts at 3:00 PM
- Check-out is at 11:00 AM
- 24/7 concierge service available
- Complimentary WiFi and parking
- Access to all apartment amenities

Need to Make Changes?
If you need to modify or cancel your booking, please contact us at least 24 hours before your check-in date.

We look forward to welcoming you to Platinum Apartment!

The Platinum Apartment Team

© 2025 Platinum Apartment. All rights reserved.
Questions? Contact us at support@platinum-apartment.com
  `;
}

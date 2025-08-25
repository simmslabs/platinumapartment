// MNotify SMS Service Integration
// API Documentation: https://docs.mnotify.net/

interface MNotifyConfig {
  apiKey: string;
  senderId: string;
  baseUrl: string;
}

interface SMSData {
  recipient: string;
  message: string;
  senderId?: string;
  scheduleDate?: string;
}

interface WhatsAppData {
  recipient: string;
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
}

interface VoiceData {
  recipient: string;
  message: string;
  voice?: 'male' | 'female';
  language?: 'en' | 'tw';
}

interface MNotifyResponse {
  status: string;
  code: string;
  message: string;
  data?: any;
}

class MNotifyService {
  private config: MNotifyConfig;

  constructor() {
    this.config = {
      apiKey: process.env.MNOTIFY_API_KEY || '',
      senderId: process.env.MNOTIFY_SENDER_ID || 'ApartmentMgmt',
      baseUrl: 'https://api.mnotify.com/api/sms/quick',
    };

    if (!this.config.apiKey) {
      console.warn('MNotify API key not configured. SMS notifications will be disabled.');
    }
  }

  private async makeRequest(endpoint: string, data: any): Promise<MNotifyResponse> {
    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          key: this.config.apiKey,
          ...data,
        }),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('MNotify API Error:', error);
      throw new Error(`MNotify service error: ${error}`);
    }
  }

  async sendSMS({ recipient, message, senderId }: SMSData): Promise<MNotifyResponse> {
    if (!this.config.apiKey) {
      throw new Error('MNotify API key not configured');
    }

    // Clean phone number (remove spaces, dashes, and ensure proper format)
    const cleanedRecipient = recipient.replace(/[\s\-\(\)]/g, '');
    
    return await this.makeRequest('', {
      to: cleanedRecipient,
      msg: message,
      sender_id: senderId || this.config.senderId,
    });
  }

  async sendBulkSMS(recipients: string[], message: string, senderId?: string): Promise<MNotifyResponse> {
    if (!this.config.apiKey) {
      throw new Error('MNotify API key not configured');
    }

    const cleanedRecipients = recipients.map(phone => phone.replace(/[\s\-\(\)]/g, ''));

    return await this.makeRequest('', {
      to: cleanedRecipients.join(','),
      msg: message,
      sender_id: senderId || this.config.senderId,
    });
  }

  async sendWhatsApp({ recipient, message, mediaUrl, mediaType }: WhatsAppData): Promise<MNotifyResponse> {
    if (!this.config.apiKey) {
      throw new Error('MNotify API key not configured');
    }

    const cleanedRecipient = recipient.replace(/[\s\-\(\)]/g, '');

    const payload: any = {
      key: this.config.apiKey,
      to: cleanedRecipient,
      msg: message,
    };

    if (mediaUrl && mediaType) {
      payload.media_url = mediaUrl;
      payload.media_type = mediaType;
    }

    const response = await fetch('https://api.mnotify.net/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await response.json();
  }

  async sendVoiceCall({ recipient, message, voice = 'female', language = 'en' }: VoiceData): Promise<MNotifyResponse> {
    if (!this.config.apiKey) {
      throw new Error('MNotify API key not configured');
    }

    const cleanedRecipient = recipient.replace(/[\s\-\(\)]/g, '');

    const response = await fetch('https://api.mnotify.net/api/voice/quick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        key: this.config.apiKey,
        to: cleanedRecipient,
        msg: message,
        voice: voice,
        lang: language,
      }),
    });

    return await response.json();
  }

  async checkBalance(): Promise<{ balance: number; currency: string }> {
    if (!this.config.apiKey) {
      throw new Error('MNotify API key not configured');
    }

    const response = await fetch('https://api.mnotify.net/api/balance/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        key: this.config.apiKey,
      }),
    });

    const result = await response.json();
    return {
      balance: parseFloat(result.balance || '0'),
      currency: result.currency || 'GHS',
    };
  }

  // Apartment-specific notification templates
  async sendBookingConfirmation(phone: string, guestName: string, roomNumber: string, checkIn: string, checkOut: string): Promise<MNotifyResponse> {
    const message = `Hello ${guestName}! Your booking for Room ${roomNumber} is confirmed. Check-in: ${checkIn}, Check-out: ${checkOut}. Welcome to Platinum Apartment!`;
    
    return await this.sendSMS({
      recipient: phone,
      message: message,
    });
  }

  async sendCheckInReminder(phone: string, guestName: string, roomNumber: string, checkInTime: string): Promise<MNotifyResponse> {
    const message = `Hi ${guestName}! Reminder: Your check-in for Room ${roomNumber} is scheduled for ${checkInTime}. Please arrive on time. Contact us if you need assistance.`;
    
    return await this.sendSMS({
      recipient: phone,
      message: message,
    });
  }

  async sendCheckOutReminder(phone: string, guestName: string, roomNumber: string, checkOutTime: string): Promise<MNotifyResponse> {
    const message = `Dear ${guestName}, your check-out from Room ${roomNumber} is due at ${checkOutTime}. Please ensure all belongings are packed. Thank you for staying with us!`;
    
    return await this.sendSMS({
      recipient: phone,
      message: message,
    });
  }

  async sendPaymentReminder(phone: string, guestName: string, amount: number, dueDate: string): Promise<MNotifyResponse> {
    const message = `Hello ${guestName}, this is a reminder that your payment of $${amount} is due on ${dueDate}. Please settle your bill to avoid any inconvenience.`;
    
    return await this.sendSMS({
      recipient: phone,
      message: message,
    });
  }

  async sendMaintenanceNotification(phone: string, guestName: string, roomNumber: string, issue: string): Promise<MNotifyResponse> {
    const message = `Hi ${guestName}, we've received your maintenance request for Room ${roomNumber} regarding: ${issue}. Our team will address this shortly. Thank you for your patience.`;
    
    return await this.sendSMS({
      recipient: phone,
      message: message,
    });
  }

  async sendStaffAlert(phone: string, staffName: string, alertType: string, details: string): Promise<MNotifyResponse> {
    const message = `ALERT - ${alertType}: ${details}. Please check the system for more details. - Platinum Apartment Management`;
    
    return await this.sendSMS({
      recipient: phone,
      message: message,
    });
  }

  async sendOverdueAlert(phone: string, guestName: string, roomNumber: string, hoursOverdue: number): Promise<MNotifyResponse> {
    const message = `URGENT: ${guestName} in Room ${roomNumber} is ${hoursOverdue} hours overdue for checkout. Please contact immediately. - Platinum Apartment`;
    
    return await this.sendSMS({
      recipient: phone,
      message: message,
    });
  }

  async sendWelcomeMessage(phone: string, guestName: string, roomNumber: string): Promise<MNotifyResponse> {
    const message = `Welcome to Platinum Apartment, ${guestName}! You're in Room ${roomNumber}. Wi-Fi: ApartmentGuest, Password: welcome123. Reception: +233-XXX-XXXX. Enjoy your stay!`;
    
    return await this.sendSMS({
      recipient: phone,
      message: message,
    });
  }

  // Bulk notifications for multiple recipients
  async sendBulkCheckOutReminders(guests: Array<{ phone: string; name: string; room: string; time: string }>): Promise<MNotifyResponse[]> {
    const results: MNotifyResponse[] = [];
    
    for (const guest of guests) {
      try {
        const result = await this.sendCheckOutReminder(guest.phone, guest.name, guest.room, guest.time);
        results.push(result);
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to send checkout reminder to ${guest.name}:`, error);
        results.push({
          status: 'error',
          code: '500',
          message: `Failed to send to ${guest.name}: ${error}`,
        });
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const mnotifyService = new MNotifyService();

// Export types for use in other files
export type { SMSData, WhatsAppData, VoiceData, MNotifyResponse };

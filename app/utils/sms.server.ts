// SMS Service using Twilio or similar service
// You can replace this with your preferred SMS provider

interface SMSOptions {
  to: string;
  message: string;
}

export async function sendSMS({ to, message }: SMSOptions) {
  // Check if SMS is enabled in environment
  if (!process.env.ENABLE_SMS || process.env.ENABLE_SMS !== "true") {
    console.log("SMS disabled, skipping:", { to, message });
    return { success: true, skipped: true };
  }

  // Example implementation with Twilio
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      // Use fetch to call Twilio API directly
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: process.env.TWILIO_PHONE_NUMBER || "",
            To: to,
            Body: message,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Twilio API failed with status: ${response.status}`);
      }

      const result = await response.json();
      console.log("SMS sent successfully via Twilio:", result.sid);
      return { success: true, sid: result.sid };
    } catch (error) {
      console.error("Failed to send SMS via Twilio:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`SMS delivery failed: ${errorMessage}`);
    }
  }

  // Alternative: Use a webhook-based SMS service
  if (process.env.SMS_WEBHOOK_URL) {
    try {
      const response = await fetch(process.env.SMS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.SMS_WEBHOOK_TOKEN}`,
        },
        body: JSON.stringify({
          to,
          message,
          from: process.env.SMS_FROM_NUMBER || "Platinum Apartment",
        }),
      });

      if (!response.ok) {
        throw new Error(`SMS webhook failed with status: ${response.status}`);
      }

      const result = await response.json();
      console.log("SMS sent via webhook:", result);
      return { success: true, result };
    } catch (error) {
      console.error("Failed to send SMS via webhook:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`SMS webhook failed: ${errorMessage}`);
    }
  }

  // Fallback: Log SMS for development/testing
  console.log("SMS would be sent:", { to, message });
  return { success: true, mock: true };
}

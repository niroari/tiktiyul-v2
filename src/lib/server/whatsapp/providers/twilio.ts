export interface TwilioIncomingMessage {
  senderPhone: string;
  text: string;
  messageId: string;
}

export function parseTwilioWebhook(
  formData: FormData | Record<string, string>
): TwilioIncomingMessage | null {
  const getVal = (key: string): string => {
    if (typeof (formData as FormData).get === "function") {
      return ((formData as FormData).get(key) as string) || "";
    }
    return (formData as Record<string, string>)[key] || "";
  };

  const from = getVal("From"); // e.g. "whatsapp:+972556649325"
  const body = getVal("Body");
  const messageId = getVal("MessageSid");

  if (!from || !body) return null;

  // Clean phone number: remove "whatsapp:" prefix and non-digits
  const cleanPhone = from.replace("whatsapp:", "").replace(/\D/g, "");

  return {
    senderPhone: cleanPhone,
    text: body.trim(),
    messageId,
  };
}

export function createTwilioTwiMLResponse(replyText: string): Response {
  const escaped = replyText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escaped}</Message>
</Response>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

export async function sendTwilioMessage(
  toPhone: string,
  message: string
): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone =
    process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    console.warn("Twilio credentials not configured in environment variables");
    return false;
  }

  let formattedTo = toPhone.replace(/\D/g, "");
  if (!formattedTo.startsWith("+")) {
    formattedTo = "+" + formattedTo;
  }
  const to = `whatsapp:${formattedTo}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const params = new URLSearchParams();
  params.append("From", fromPhone);
  params.append("To", to);
  params.append("Body", message);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Twilio send error:", res.status, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to send message via Twilio:", err);
    return false;
  }
}

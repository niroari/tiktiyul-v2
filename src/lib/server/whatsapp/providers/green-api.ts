export interface IncomingWhatsAppMessage {
  senderPhone: string;
  senderName?: string;
  text: string;
  messageId: string;
}

interface RawGreenApiBody {
  typeWebhook?: string;
  idMessage?: string;
  senderData?: {
    chatId?: string;
    sender?: string;
    chatName?: string;
    senderName?: string;
  };
  messageData?: {
    typeMessage?: string;
    textMessageData?: {
      textMessage?: string;
    };
    extendedTextMessageData?: {
      text?: string;
    };
  };
}

export function parseGreenApiWebhook(
  body: unknown
): IncomingWhatsAppMessage | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const payload = body as RawGreenApiBody;
  if (payload.typeWebhook !== "incomingMessageReceived") {
    return null;
  }

  const senderData = payload.senderData || {};
  const messageData = payload.messageData || {};

  // Extract phone number from chatId (e.g. 972501234567@c.us)
  const chatId = senderData.chatId || senderData.sender || "";
  const senderPhone = chatId.replace("@c.us", "").replace("@s.whatsapp.net", "");

  // Extract message text
  let text = "";
  if (messageData.typeMessage === "textMessage" && messageData.textMessageData) {
    text = messageData.textMessageData.textMessage || "";
  } else if (
    messageData.typeMessage === "extendedTextMessage" &&
    messageData.extendedTextMessageData
  ) {
    text = messageData.extendedTextMessageData.text || "";
  }

  if (!text || !senderPhone) return null;

  return {
    senderPhone,
    senderName: senderData.senderName || senderData.chatName,
    text: text.trim(),
    messageId: payload.idMessage || "",
  };
}

export async function sendGreenApiMessage(
  phoneNumber: string,
  message: string
): Promise<boolean> {
  const idInstance = process.env.GREEN_API_INSTANCE_ID;
  const apiTokenInstance = process.env.GREEN_API_TOKEN;
  const apiUrl = process.env.GREEN_API_URL || "https://api.green-api.com";

  if (!idInstance || !apiTokenInstance) {
    console.warn(
      "Green API credentials missing (GREEN_API_INSTANCE_ID or GREEN_API_TOKEN). Message not sent:",
      message
    );
    return false;
  }

  // Format chatId: international format without leading + followed by @c.us
  let cleanPhone = phoneNumber.replace(/\D/g, "");
  if (cleanPhone.startsWith("05") && cleanPhone.length === 10) {
    cleanPhone = "972" + cleanPhone.slice(1);
  }
  const chatId = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@c.us`;

  const url = `${apiUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId,
        message,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Green API send error:", res.status, errText);
      return false;
    }

    return true;
  } catch (err: unknown) {
    console.error("Failed to send message via Green API:", err);
    return false;
  }
}

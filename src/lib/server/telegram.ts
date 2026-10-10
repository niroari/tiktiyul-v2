export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: "private" | "group" | "supergroup" | "channel";
      title?: string;
      first_name?: string;
      username?: string;
    };
    date: number;
    text?: string;
  };
}

export function getTelegramBotToken(): string {
  const token =
    process.env.TELEGRAM_BOT_TOKEN ||
    "8783888018:AAHy8AN3MFJd71_pfAV4cjg4lDIdOGFTg_w";
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not defined in environment variables");
  }
  return token.trim();
}

/**
 * Sends a text message to a Telegram chat.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string
): Promise<boolean> {
  const token = getTelegramBotToken();
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Telegram sendMessage error:", res.status, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
    return false;
  }
}

/**
 * Sends a 'typing' chat action to show the user the bot is processing.
 */
export async function sendTelegramTyping(chatId: string | number): Promise<void> {
  try {
    const token = getTelegramBotToken();
    const url = `https://api.telegram.org/bot${token}/sendChatAction`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        action: "typing",
      }),
    });
  } catch {
    // Non-critical action, ignore error
  }
}

/**
 * Registers or updates the webhook URL with Telegram.
 */
export async function setTelegramWebhook(webhookUrl: string): Promise<{
  ok: boolean;
  description?: string;
}> {
  const token = getTelegramBotToken();
  const url = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(
    webhookUrl
  )}`;

  const res = await fetch(url);
  return (await res.json()) as { ok: boolean; description?: string };
}

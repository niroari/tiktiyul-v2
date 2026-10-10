import { NextRequest, NextResponse } from "next/server";
import {
  TelegramUpdate,
  sendTelegramMessage,
  sendTelegramTyping,
  setTelegramWebhook,
} from "@/lib/server/telegram";
import {
  getTelegramSession,
  linkTelegramSessionWithPin,
  addSessionMessageTurn,
  clearSessionHistory,
} from "@/lib/server/session-manager";
import { askTripAgent } from "@/lib/server/agent";

export const dynamic = "force-dynamic";

/**
 * GET endpoint to check status or easily register the Telegram webhook.
 * Example: GET /api/telegram/webhook?setup=true
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const setup = searchParams.get("setup");

  if (setup === "true") {
    const origin = req.nextUrl.origin;
    const webhookUrl = `${origin}/api/telegram/webhook`;
    const res = await setTelegramWebhook(webhookUrl);
    return NextResponse.json({
      status: "webhook_setup",
      targetUrl: webhookUrl,
      result: res,
    });
  }

  return NextResponse.json({
    status: "ok",
    service: "tik-tiyul-telegram-agent",
    botName: "חיליק",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const update: TelegramUpdate = await req.json();
    const msg = update.message;

    if (!msg || !msg.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const username = msg.from?.username;
    const firstName = msg.from?.first_name;

    // ── 1. Handle /start command (with optional deep-link PIN) ──
    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/);
      const possiblePin = parts[1]; // e.g. "/start 160222"

      if (possiblePin && /^\d{6}$/.test(possiblePin)) {
        const linkResult = await linkTelegramSessionWithPin(chatId, possiblePin, {
          username,
          firstName,
        });
        await sendTelegramMessage(chatId, linkResult.message);
        return NextResponse.json({ ok: true });
      }

      // Check if user is already linked
      const existingSession = await getTelegramSession(chatId);
      if (existingSession) {
        const welcomeBack = `שלום ${firstName || ""}! 👋\nאני חיליק - העוזר המבצעי של 'תיק טיול' 🎒\nמחובר כעת לטיול: *${existingSession.tripName || existingSession.tripId}*.\n\nתוכל לשאול אותי כל שאלה על תלמידים, אוטובוסים, חדרים, אלרגיות ונהלי בטיחות.`;
        await sendTelegramMessage(chatId, welcomeBack);
        return NextResponse.json({ ok: true });
      }

      const welcomeHelp = `שלום ${firstName || ""}! 👋 נעים להכיר, אני חיליק - העוזר המבצעי של 'תיק טיול' 🎒

הטלגרם שלך עדיין אינו מחובר לטיול פעיל.
כדי להתחבר:
1. היכנס למערכת באתר ללשונית "פרטי הטיול" (הגדרות).
2. לחץ על "הפק קוד חיבור לטלגרם" והעתק את הקוד בן 6 הספרות.
3. שלח לכאן את הקוד (לדוגמה: 123456).`;

      await sendTelegramMessage(chatId, welcomeHelp);
      return NextResponse.json({ ok: true });
    }

    // ── 2. Handle PIN link text (e.g. "123456", "#123456", "קוד 123456") ──
    const pinMatch = text.match(/(?:חבר|קוד|#)?\s*(\d{6})/);
    if (pinMatch) {
      const pin = pinMatch[1];
      const linkResult = await linkTelegramSessionWithPin(chatId, pin, {
        username,
        firstName,
      });
      await sendTelegramMessage(chatId, linkResult.message);
      return NextResponse.json({ ok: true });
    }

    // ── 3. Check Active Trip Session ──
    const session = await getTelegramSession(chatId);
    if (!session) {
      const notLinkedMsg = `מספר הטלגרם שלך עדיין אינו מחובר לטיול פעיל. 🎒
אנא הפק קוד בן 6 ספרות בהגדרות הטיול באתר ושלח אותו לכאן כדי להתחבר.`;
      await sendTelegramMessage(chatId, notLinkedMsg);
      return NextResponse.json({ ok: true });
    }

    // ── 4. Handle Conversation Reset (/clear or /reset) ──
    if (text === "/clear" || text === "/reset" || text === "איפוס" || text === "אפס שיחה") {
      await clearSessionHistory(chatId);
      await sendTelegramMessage(
        chatId,
        "היסטוריית השיחה אופסה בהצלחה! 🔄\nבמה אוכל לסייע לך כעת בנוגע לטיול?"
      );
      return NextResponse.json({ ok: true });
    }

    // ── 5. Process Query with AI Agent (Gemini 2.5 Flash + Session History) ──
    await sendTelegramTyping(chatId);

    const reply = await askTripAgent(
      text,
      session.tripId,
      session.tripName,
      session.recentMessages
    );

    await sendTelegramMessage(chatId, reply);

    // Save turn to session memory (fire & forget to keep webhook response fast)
    addSessionMessageTurn(chatId, text, reply).catch((err) =>
      console.warn("Failed to persist session message turn:", err)
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true }); // Always ack to Telegram to avoid retry loops
  }
}

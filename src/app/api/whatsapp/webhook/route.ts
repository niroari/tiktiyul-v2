import { NextRequest, NextResponse } from "next/server";
import {
  parseGreenApiWebhook,
  sendGreenApiMessage,
} from "@/lib/server/whatsapp/providers/green-api";
import {
  parseTwilioWebhook,
  createTwilioTwiMLResponse,
} from "@/lib/server/whatsapp/providers/twilio";
import {
  getSession,
  linkSessionWithPin,
} from "@/lib/server/session-manager";
import { askTripAgent } from "@/lib/server/whatsapp/agent";

// Simple in-memory deduplication cache for WhatsApp message IDs (1 minute TTL)
const processedMessageIds = new Map<string, number>();

function isDuplicate(messageId: string): boolean {
  if (!messageId) return false;
  const now = Date.now();
  for (const [id, time] of processedMessageIds.entries()) {
    if (now - time > 60000) processedMessageIds.delete(id);
  }
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.set(messageId, now);
  return false;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const hubChallenge = searchParams.get("hub.challenge");
  if (hubChallenge) {
    return new Response(hubChallenge, { status: 200 });
  }

  return NextResponse.json({
    status: "ok",
    service: "tik-tiyul-whatsapp-agent",
    providers: ["twilio", "green-api"],
    botName: "חיליק",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let senderPhone = "";
    let text = "";
    let messageId = "";
    let isTwilio = false;

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      // ── Handle Twilio Webhook ──
      isTwilio = true;
      const formData = await req.formData();
      const parsed = parseTwilioWebhook(formData);
      if (!parsed) {
        return createTwilioTwiMLResponse("");
      }
      senderPhone = parsed.senderPhone;
      text = parsed.text;
      messageId = parsed.messageId;
    } else {
      // ── Handle Green API Webhook (JSON) ──
      const body: unknown = await req.json();
      const incoming = parseGreenApiWebhook(body);
      if (!incoming) {
        return NextResponse.json({ status: "ignored" });
      }
      senderPhone = incoming.senderPhone;
      text = incoming.text;
      messageId = incoming.messageId;
    }

    if (isDuplicate(messageId)) {
      return isTwilio
        ? createTwilioTwiMLResponse("")
        : NextResponse.json({ status: "already_processed" });
    }

    // ── Helper to dispatch reply ──
    const sendReply = async (replyText: string) => {
      if (isTwilio) {
        return createTwilioTwiMLResponse(replyText);
      }
      await sendGreenApiMessage(senderPhone, replyText);
      return NextResponse.json({ status: "success" });
    };

    // ── Check for PIN Link Command (e.g. "123456" or "#123456" or "חבר 123456") ──
    const pinMatch = text.match(/(?:חבר|קוד|#)?\s*(\d{6})/);
    if (pinMatch) {
      const pin = pinMatch[1];
      const linkResult = await linkSessionWithPin(senderPhone, pin);
      return await sendReply(linkResult.message);
    }

    // ── Check Active Trip Session ──
    const session = await getSession(senderPhone);
    if (!session) {
      const welcomeHelp = `שלום! 👋 נעים להכיר, אני חיליק - העוזר המבצעי של 'תיק טיול' 🎒

מספר הוואטסאפ שלך עדיין אינו מחובר לטיול פעיל.
כדי לחבר את המספר:
1. היכנס למערכת באתר ללשונית "פרטי הטיול" (הגדרות).
2. לחץ על "הפק קוד חיבור לוואטסאפ" והעתק את הקוד בן 6 הספרות.
3. שלח את הקוד לכאן (לדוגמה: #123456).`;

      return await sendReply(welcomeHelp);
    }

    // ── Process Query with AI Agent (Gemini 2.5 Flash) ──
    const replyText = await askTripAgent(
      text,
      session.tripId,
      session.tripName
    );

    return await sendReply(replyText);
  } catch (err: unknown) {
    console.error("Webhook processing error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

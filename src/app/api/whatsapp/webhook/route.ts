import { NextRequest, NextResponse } from "next/server";
import {
  parseGreenApiWebhook,
  sendGreenApiMessage,
} from "@/lib/server/whatsapp/providers/green-api";
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
  // Clean old IDs (older than 60s)
  for (const [id, time] of processedMessageIds.entries()) {
    if (now - time > 60000) processedMessageIds.delete(id);
  }
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.set(messageId, now);
  return false;
}

export async function GET(req: NextRequest) {
  // Supports Meta verify challenge if queried by Meta, or simple healthcheck
  const searchParams = req.nextUrl.searchParams;
  const hubChallenge = searchParams.get("hub.challenge");
  if (hubChallenge) {
    return new Response(hubChallenge, { status: 200 });
  }

  return NextResponse.json({
    status: "ok",
    service: "tik-tiyul-whatsapp-agent",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const incoming = parseGreenApiWebhook(body);

    if (!incoming) {
      // Ignored non-message webhook notifications (e.g. status updates)
      return NextResponse.json({ status: "ignored" });
    }

    if (isDuplicate(incoming.messageId)) {
      return NextResponse.json({ status: "already_processed" });
    }

    const { senderPhone, text } = incoming;

    // Check if the user is sending a 6-digit PIN to link a trip (e.g. "123456" or "#123456" or "חבר 123456")
    const pinMatch = text.match(/(?:חבר|קוד|#)?\s*(\d{6})/);
    if (pinMatch) {
      const pin = pinMatch[1];
      const linkResult = await linkSessionWithPin(senderPhone, pin);
      await sendGreenApiMessage(senderPhone, linkResult.message);
      return NextResponse.json({ status: "linked", success: linkResult.success });
    }

    // Check active session
    const session = await getSession(senderPhone);
    if (!session) {
      const welcomeHelp = `שלום! 👋 ברוך הבא לעוזר המבצעי של 'תיק טיול' 🎒

מספר הוואטסאפ שלך עדיין אינו מחובר לטיול פעיל.
כדי לחבר את המספר:
1. היכנס למערכת באתר ללשונית "הגדרות טיול".
2. לחץ על "חיבור סוכן וואטסאפ" והעתק את הקוד בן 6 הספרות.
3. שלח את הקוד לכאן (לדוגמה: #123456).`;

      await sendGreenApiMessage(senderPhone, welcomeHelp);
      return NextResponse.json({ status: "unauthenticated_guided" });
    }

    // Process message with AI Agent
    const replyText = await askTripAgent(
      text,
      session.tripId,
      session.tripName
    );

    // Send answer back to WhatsApp
    await sendGreenApiMessage(senderPhone, replyText);

    return NextResponse.json({ status: "success" });
  } catch (err: unknown) {
    console.error("Webhook processing error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

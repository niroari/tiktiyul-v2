import { getAdminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export interface TelegramSession {
  chatId: string;
  tripId: string;
  tripName?: string;
  username?: string;
  firstName?: string;
  linkedAt: unknown;
}

export async function getTelegramSession(
  chatId: string | number
): Promise<TelegramSession | null> {
  const db = getAdminDb();
  const id = chatId.toString();

  const doc = await db.collection("telegram_sessions").doc(id).get();
  if (doc.exists) {
    return doc.data() as TelegramSession;
  }

  return null;
}

export async function linkTelegramSessionWithPin(
  chatId: string | number,
  pin: string,
  meta?: { username?: string; firstName?: string }
): Promise<{ success: boolean; message: string; session?: TelegramSession }> {
  const db = getAdminDb();
  const id = chatId.toString();
  const cleanPin = pin.replace(/\D/g, "").trim();

  let pinDoc = await db.collection("tripPinCodes").doc(cleanPin).get();
  if (!pinDoc.exists) {
    pinDoc = await db.collection("trip_pin_codes").doc(cleanPin).get();
  }
  if (!pinDoc.exists) {
    return {
      success: false,
      message: "הקוד שהוזן שגוי או שפג תוקפו. אנא בדוק בהגדרות הטיול באתר.",
    };
  }

  const pinData = pinDoc.data() as {
    expiresAt?: { toDate: () => Date };
    tripId: string;
  };

  if (pinData?.expiresAt && pinData.expiresAt.toDate() < new Date()) {
    return {
      success: false,
      message: "פג תוקפו של הקוד. אנא צור קוד חדש במסך הגדרות הטיול באתר.",
    };
  }

  const tripId = pinData.tripId;
  const tripDoc = await db.collection("trips").doc(tripId).get();
  const tripData = tripDoc.exists ? (tripDoc.data() as { name?: string }) : undefined;
  const tripName = tripData?.name || "";

  const session: TelegramSession = {
    chatId: id,
    tripId,
    tripName,
    username: meta?.username || "",
    firstName: meta?.firstName || "",
    linkedAt: FieldValue.serverTimestamp(),
  };

  await db.collection("telegram_sessions").doc(id).set(session);

  return {
    success: true,
    message: `הטלגרם שלך חובר בהצלחה לטיול "${tripName || tripId}"! 🎉\nכעת תוכל לשאול אותי כל שאלה על תלמידים, אוטובוסים, חדרים, אלרגיות ונהלי בטיחות.`,
    session,
  };
}

export async function generateTripPin(tripId: string): Promise<string> {
  const db = getAdminDb();
  const pin = Math.floor(100000 + Math.random() * 900000).toString();

  // Expires in 48 hours
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await db.collection("trip_pin_codes").doc(pin).set({
    tripId,
    pin,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });

  return pin;
}

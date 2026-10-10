import { getAdminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export interface WhatsAppSession {
  phoneNumber: string;
  tripId: string;
  tripName?: string;
  linkedAt: unknown;
}

/**
 * Normalizes Israeli and international phone numbers to standard format (e.g. 0501234567 or 972501234567).
 */
export function normalizePhone(raw: string): string {
  let clean = raw.replace(/\D/g, "");
  if (clean.startsWith("972") && clean.length === 12) {
    clean = "0" + clean.slice(3);
  }
  return clean;
}

export async function getSession(
  phoneNumber: string
): Promise<WhatsAppSession | null> {
  const db = getAdminDb();
  const clean = normalizePhone(phoneNumber);

  const doc = await db.collection("whatsapp_sessions").doc(clean).get();
  if (doc.exists) {
    const data = doc.data() as WhatsAppSession;
    return data;
  }

  return null;
}

export async function linkSessionWithPin(
  phoneNumber: string,
  pin: string
): Promise<{ success: boolean; message: string; session?: WhatsAppSession }> {
  const db = getAdminDb();
  const cleanPhone = normalizePhone(phoneNumber);
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
      message: "פג תוקפו של הקוד. אנא צור קוד חדש במסך הגדרות הטיול.",
    };
  }

  const tripId = pinData.tripId;
  const tripDoc = await db.collection("trips").doc(tripId).get();
  const tripData = tripDoc.exists ? (tripDoc.data() as { name?: string }) : undefined;
  const tripName = tripData?.name || "";

  const session: WhatsAppSession = {
    phoneNumber: cleanPhone,
    tripId,
    tripName,
    linkedAt: FieldValue.serverTimestamp(),
  };

  await db.collection("whatsapp_sessions").doc(cleanPhone).set(session);

  return {
    success: true,
    message: `הוואטסאפ שלך חובר בהצלחה לטיול "${tripName || tripId}"! 🎉\nכעת תוכל לשאול כל שאלה על תלמידים, אוטובוסים, חדרים, אלרגיות ונהלי בטיחות.`,
    session,
  };
}

export async function generateTripPin(tripId: string): Promise<string> {
  const db = getAdminDb();
  // Generate random 6-digit pin
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

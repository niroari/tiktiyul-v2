import { getAdminDb } from "./firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { sendTelegramMessage } from "./telegram";
import { getMedicalRestrictions, getBusManifest, getWeatherAndClimate, getTripDocumentsAndSignatures } from "./trip-tools";
import type { Trip } from "@/lib/types";

export interface TripReminder {
  id?: string;
  tripId: string;
  tripName?: string;
  senderChatId: string;
  targetType: "self" | "all_staff" | "bus_crew";
  targetBusNumber?: number;
  text: string;
  scheduledAt: string; // ISO string
  createdAt?: unknown;
  status: "pending" | "sent" | "cancelled" | "failed";
  sentAt?: unknown;
  recipientsCount?: number;
}

/**
 * Schedule a new reminder or future broadcast.
 */
export async function scheduleReminder(data: {
  tripId: string;
  tripName?: string;
  senderChatId: string;
  targetType: "self" | "all_staff" | "bus_crew";
  targetBusNumber?: number;
  text: string;
  scheduledAt: string; // ISO date string
}): Promise<{ success: boolean; id: string; scheduledAtHebrew: string; message: string }> {
  const db = getAdminDb();
  const dateObj = new Date(data.scheduledAt);

  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid scheduledAt date format");
  }

  const reminderDoc: Record<string, unknown> = {
    tripId: data.tripId,
    tripName: data.tripName || "",
    senderChatId: data.senderChatId.toString(),
    targetType: data.targetType,
    text: data.text.trim(),
    scheduledAt: dateObj.toISOString(),
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  };

  if (data.targetBusNumber !== undefined) {
    reminderDoc.targetBusNumber = data.targetBusNumber;
  }

  const ref = await db.collection("trip_reminders").add(reminderDoc);

  // Format date in Hebrew for confirmation message
  const hebrewDate = dateObj.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  });

  return {
    success: true,
    id: ref.id,
    scheduledAtHebrew: hebrewDate,
    message: `התזכורת נשמרה בהצלחה ותישלח ב-${hebrewDate} ⏰`,
  };
}

/**
 * Immediate broadcast to all staff members connected to a trip.
 */
export async function broadcastToStaff(
  tripId: string,
  text: string,
  senderChatId: string,
  senderName?: string
): Promise<{ success: boolean; count: number; message: string }> {
  const db = getAdminDb();
  const sessionsSnap = await db
    .collection("telegram_sessions")
    .where("tripId", "==", tripId)
    .get();

  if (sessionsSnap.empty) {
    return {
      success: false,
      count: 0,
      message: "לא נמצאו מורים מחוברים לטיול זה בטלגרם.",
    };
  }

  const broadcastMessage = `📢 *הודעה לצוות המורים המלווים:*
${text}

_נשלח ע״י ${senderName || "רכז הטיול"}_`;

  let sentCount = 0;
  const promises: Promise<boolean>[] = [];

  sessionsSnap.forEach((doc) => {
    const sessionData = doc.data();
    const targetChatId = sessionData.chatId;
    if (targetChatId) {
      promises.push(sendTelegramMessage(targetChatId, broadcastMessage));
    }
  });

  const results = await Promise.all(promises);
  sentCount = results.filter(Boolean).length;

  return {
    success: true,
    count: sentCount,
    message: `ההודעה שודרה בהצלחה ל-${sentCount} מורים מחוברים! 📢`,
  };
}

/**
 * List active pending reminders for a trip/user.
 */
export async function listActiveReminders(
  tripId: string,
  chatId?: string
): Promise<TripReminder[]> {
  const db = getAdminDb();
  const snap = await db
    .collection("trip_reminders")
    .where("tripId", "==", tripId)
    .get();

  const reminders: TripReminder[] = [];

  snap.forEach((doc) => {
    const data = doc.data();
    if (data.status !== "pending") return;
    if (chatId && data.senderChatId !== chatId.toString()) return;

    reminders.push({
      id: doc.id,
      tripId: data.tripId,
      tripName: data.tripName,
      senderChatId: data.senderChatId,
      targetType: data.targetType || "self",
      targetBusNumber: data.targetBusNumber,
      text: data.text,
      scheduledAt: data.scheduledAt,
      status: data.status,
    });
  });

  // Sort by scheduledAt ascending
  reminders.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  return reminders;
}

/**
 * Cancel a pending reminder.
 */
export async function cancelReminder(
  reminderId: string,
  chatId?: string
): Promise<{ success: boolean; message: string }> {
  const db = getAdminDb();
  const ref = db.collection("trip_reminders").doc(reminderId);
  const doc = await ref.get();

  if (!doc.exists) {
    return { success: false, message: "התזכורת לא נמצאה." };
  }

  const data = doc.data();
  if (chatId && data?.senderChatId !== chatId.toString()) {
    return { success: false, message: "אין הרשאה לבטל תזכורת זו." };
  }

  await ref.update({
    status: "cancelled",
    cancelledAt: FieldValue.serverTimestamp(),
  });

  return { success: true, message: "התזכורת בוטלה בהצלחה." };
}

/**
 * Cron dispatcher: Polls Firestore for due reminders and dispatches them via Telegram.
 */
export async function processDueReminders(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const db = getAdminDb();
  const nowIso = new Date().toISOString();

  // Fetch pending reminders without requiring composite index
  const snap = await db
    .collection("trip_reminders")
    .where("status", "==", "pending")
    .limit(100)
    .get();

  if (snap.empty) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  const dueDocs = snap.docs.filter((d) => {
    const data = d.data();
    return data.scheduledAt && data.scheduledAt <= nowIso;
  });

  if (dueDocs.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const doc of dueDocs) {
    const r = doc.data() as TripReminder;
    const reminderId = doc.id;

    try {
      if (r.targetType === "all_staff") {
        const broadcastRes = await broadcastToStaff(
          r.tripId,
          r.text,
          r.senderChatId,
          "תזכורת מתוזמנת"
        );
        await doc.ref.update({
          status: "sent",
          sentAt: FieldValue.serverTimestamp(),
          recipientsCount: broadcastRes.count,
        });
        sent++;
      } else {
        // Send directly to the sender (self)
        const ok = await sendTelegramMessage(
          r.senderChatId,
          `⏰ *תזכורת מחיליק:*
${r.text}`
        );

        if (ok) {
          await doc.ref.update({
            status: "sent",
            sentAt: FieldValue.serverTimestamp(),
            recipientsCount: 1,
          });
          sent++;
        } else {
          failed++;
        }
      }
    } catch (err) {
      console.error(`Error processing reminder ${reminderId}:`, err);
      failed++;
    }
  }

  return { processed: snap.size, sent, failed };
}

/**
 * Autonomous trip health alerts: Checks trip countdown and sends smart alerts.
 */
export async function runAutonomousTripAlerts(): Promise<{ alertsTriggered: number }> {
  const db = getAdminDb();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // Query trips starting today or in the future
  const tripsSnap = await db
    .collection("trips")
    .where("startDate", ">=", todayStr)
    .limit(30)
    .get();

  if (tripsSnap.empty) return { alertsTriggered: 0 };

  let alertsTriggered = 0;

  for (const doc of tripsSnap.docs) {
    const trip = doc.data() as Trip;
    const tripId = doc.id;
    if (!trip.startDate) continue;

    const startDate = new Date(trip.startDate);
    const diffMs = startDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Find coordinator/sessions connected to this trip
    const sessionsSnap = await db
      .collection("telegram_sessions")
      .where("tripId", "==", tripId)
      .get();

    if (sessionsSnap.empty) continue;
    const chatIds = sessionsSnap.docs.map((d) => d.data().chatId).filter(Boolean);

    // Helper to send alert once with deduplication in `trip_alert_logs`
    const sendDeduplicatedAlert = async (alertKey: string, alertText: string): Promise<boolean> => {
      const logRef = db.collection("trip_alert_logs").doc(`${tripId}_${alertKey}`);
      const logDoc = await logRef.get();
      if (logDoc.exists) return false; // Already sent

      for (const chatId of chatIds) {
        await sendTelegramMessage(chatId, alertText);
      }

      await logRef.set({
        tripId,
        alertKey,
        sentAt: FieldValue.serverTimestamp(),
        recipientsCount: chatIds.length,
      });

      alertsTriggered++;
      return true;
    };

    // ── T-7 Days: Readiness & Security Approval Audit ──
    if (diffDays <= 7 && diffDays > 3) {
      const secSnap = await db
        .collection("trips")
        .doc(tripId)
        .collection("appendices")
        .doc("security")
        .get();
      const hasSecurity = secSnap.exists && secSnap.data()?.fileUrl;

      if (!hasSecurity) {
        await sendDeduplicatedAlert(
          "tminus_7_security",
          `🔔 *בדיקת מוכנות שבוע לטיול (${trip.name || "הטיול"}):*
שים לב, נותרו ${diffDays} ימים לטיול וטרם הועלה אישור ביטחוני רשמי (PDF) בלשונית 'אישור ביטחוני'.
מומלץ לוודא את קבלת האישור מחדר המצב.`
        );
      }
    }

    // ── T-3 Days: Digital Signatures Check ──
    if (diffDays <= 3 && diffDays > 1) {
      const docsRes = await getTripDocumentsAndSignatures(tripId);
      if (!docsRes.isFullySigned) {
        await sendDeduplicatedAlert(
          "tminus_3_signatures",
          `✍️ *תזכורת חתימות - 3 ימים לטיול:*
נותרו חתימות דיגיטליות ממתינות (${docsRes.pendingCount} חתימות טרם הושלמו) לטיול "${trip.name}".
מומלץ להיכנס למערכת ולהשלים את החתימות הנדרשות לאישור הטיול.`
        );
      }
    }

    // ── T-1 Day (Evening): Weather & Medical Life-Safety Briefing ──
    if (diffDays === 1) {
      const medRes = await getMedicalRestrictions(tripId);
      const epipenCount = medRes.epipenCarriersCount;

      let medNote = "";
      if (epipenCount > 0) {
        medNote = `\n🚨 *תשומת לב רפואית דחופה:* בטיול משתתפים ${epipenCount} תלמידים נושאי מזרק אפיפן! יש לוודא שכל מזרק נמצא בתיק התלמיד ושהחובשים/מורים מעודכנים.`;
      }

      await sendDeduplicatedAlert(
        "tminus_1_briefing",
        `🎒 *תדריך ערב היציאה לטיול מחר!*
טיול: *${trip.name}*
תאריך יציאה: ${trip.startDate}
לינה: ${trip.accommodation || "כמתוכנן"}${medNote}

נא לוודא שכל התלמידים מגיעים עם 3 ליטר מים, כובע ונעלי הליכה סגורות. בהצלחה מחר!`
      );
    }
  }

  return { alertsTriggered };
}

import { doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function createClientTripPin(tripId: string): Promise<string> {
  // Generate random 6-digit pin
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await setDoc(doc(db, "tripPinCodes", pin), {
    tripId,
    pin,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  return pin;
}

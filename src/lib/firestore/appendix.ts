import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function appendixDoc(tripId: string, appendixId: string) {
  return doc(db, "trips", tripId, "appendices", appendixId);
}

export async function saveAppendix(
  tripId: string,
  appendixId: string,
  data: Record<string, unknown>
): Promise<void> {
  await setDoc(appendixDoc(tripId, appendixId), {
    ...data,
    savedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getAppendix(
  tripId: string,
  appendixId: string
): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(appendixDoc(tripId, appendixId));
  return snap.exists() ? snap.data() : null;
}

export function subscribeToAppendix(
  tripId: string,
  appendixId: string,
  callback: (data: Record<string, unknown> | null) => void
): Unsubscribe {
  return onSnapshot(appendixDoc(tripId, appendixId), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

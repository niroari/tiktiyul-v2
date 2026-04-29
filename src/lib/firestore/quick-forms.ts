import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function quickFormDoc(uid: string, type: string) {
  return doc(db, "quick-forms", `${uid}_${type}`);
}

export async function saveQuickForm(
  uid: string,
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  await setDoc(quickFormDoc(uid, type), { ...data, uid, savedAt: serverTimestamp() }, { merge: true });
}

export function subscribeToQuickForm(
  uid: string,
  type: string,
  callback: (data: Record<string, unknown> | null) => void
): Unsubscribe {
  return onSnapshot(quickFormDoc(uid, type), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

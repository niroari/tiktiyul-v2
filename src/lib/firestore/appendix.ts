import {
  doc,
  collection,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== "object" || obj === null) return false;
  const proto = Object.getPrototypeOf(obj);
  return proto === Object.prototype || proto === null;
}

function removeUndefinedDeep<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map(removeUndefinedDeep) as unknown as T;
  }
  if (isPlainObject(val)) {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        res[k] = removeUndefinedDeep(v);
      }
    }
    return res as T;
  }
  return val;
}

function appendixDoc(tripId: string, appendixId: string) {
  return doc(db, "trips", tripId, "appendices", appendixId);
}

export async function saveAppendix(
  tripId: string,
  appendixId: string,
  data: Record<string, unknown>
): Promise<void> {
  const cleanData = removeUndefinedDeep(data);
  await setDoc(appendixDoc(tripId, appendixId), {
    ...cleanData,
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

/** Subscribe to all appendices for a trip. Returns a map of appendixId → data. */
export function subscribeToAllAppendices(
  tripId: string,
  callback: (map: Record<string, Record<string, unknown>>) => void
): Unsubscribe {
  const col = collection(db, "trips", tripId, "appendices");
  return onSnapshot(col, (snap) => {
    const map: Record<string, Record<string, unknown>> = {};
    snap.docs.forEach((d) => { map[d.id] = d.data(); });
    callback(map);
  });
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

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PendingUpdate } from "@/lib/types";

function col(tripId: string) {
  return collection(db, "trips", tripId, "pendingUpdates");
}

/** Submit a batch of proposed updates from the teacher edit page. One doc per student. */
export async function submitPendingUpdate(
  tripId: string,
  data: Omit<PendingUpdate, "id" | "submittedAt" | "status">
): Promise<void> {
  const ref = doc(col(tripId));
  await setDoc(ref, {
    ...data,
    status: "pending",
    submittedAt: serverTimestamp(),
  });
}

/** Approve or reject a pending update. */
export async function resolvePendingUpdate(
  tripId: string,
  updateId: string,
  resolution: "approved" | "rejected"
): Promise<void> {
  await updateDoc(doc(col(tripId), updateId), { status: resolution });
}

/** Live subscription to all pending updates for a trip. */
export function subscribeToPendingUpdates(
  tripId: string,
  callback: (updates: PendingUpdate[]) => void
): Unsubscribe {
  return onSnapshot(
    query(col(tripId), where("status", "==", "pending")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PendingUpdate)))
  );
}

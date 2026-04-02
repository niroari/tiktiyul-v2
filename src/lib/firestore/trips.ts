import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trip } from "@/lib/types";

// v2 uses top-level "trips" collection (v1 used users/{uid}/trips)
const tripsCol = collection(db, "trips");

export function tripDoc(tripId: string) {
  return doc(db, "trips", tripId);
}

export async function getTrip(tripId: string): Promise<Trip | null> {
  const snap = await getDoc(tripDoc(tripId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Trip;
}

export async function getAllTrips(): Promise<Trip[]> {
  const q = query(tripsCol, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip));
}

export async function createTrip(trip: Omit<Trip, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const ref = doc(tripsCol);
  await setDoc(ref, {
    ...trip,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveTripMetadata(
  tripId: string,
  data: Partial<Omit<Trip, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  await updateDoc(tripDoc(tripId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTrip(tripId: string): Promise<void> {
  await deleteDoc(tripDoc(tripId));
}

export function subscribeToTrip(
  tripId: string,
  callback: (trip: Trip | null) => void
): Unsubscribe {
  return onSnapshot(tripDoc(tripId), (snap) => {
    if (!snap.exists()) {
      callback(null);
    } else {
      callback({ id: snap.id, ...snap.data() } as Trip);
    }
  });
}

export function subscribeToAllTrips(
  callback: (trips: Trip[]) => void
): Unsubscribe {
  const q = query(tripsCol, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip)));
  });
}

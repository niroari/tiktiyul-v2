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
  where,
  limit,
  arrayUnion,
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
  return onSnapshot(tripsCol, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip)));
  });
}

export function subscribeToUserTrips(
  uid: string,
  callback: (trips: Trip[]) => void
): Unsubscribe {
  const ownerQ       = query(tripsCol, where("ownerUid", "==", uid));
  const collaboratorQ = query(tripsCol, where("collaborators", "array-contains", uid));

  // Merge two snapshots, deduplicate by id, sort by createdAt descending
  const snapshots: Record<"owner" | "collab", Trip[]> = { owner: [], collab: [] };

  function emit() {
    const merged = [...snapshots.owner];
    for (const t of snapshots.collab) {
      if (!merged.some((x) => x.id === t.id)) merged.push(t);
    }
    merged.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    callback(merged);
  }

  const unsubOwner = onSnapshot(ownerQ, (snap) => {
    snapshots.owner = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip));
    emit();
  });

  const unsubCollab = onSnapshot(collaboratorQ, (snap) => {
    snapshots.collab = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip));
    emit();
  });

  return () => { unsubOwner(); unsubCollab(); };
}

export async function generateInviteToken(tripId: string): Promise<string> {
  const token = crypto.randomUUID();
  await updateDoc(tripDoc(tripId), { inviteToken: token, updatedAt: serverTimestamp() });
  return token;
}

export async function joinTripByToken(token: string, uid: string): Promise<string | null> {
  const q = query(tripsCol, where("inviteToken", "==", token), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const ref  = snap.docs[0].ref;
  const data = snap.docs[0].data() as Trip;
  if (data.ownerUid === uid || (data.collaborators ?? []).includes(uid)) {
    return snap.docs[0].id;
  }
  await updateDoc(ref, { collaborators: arrayUnion(uid), updatedAt: serverTimestamp() });
  return snap.docs[0].id;
}

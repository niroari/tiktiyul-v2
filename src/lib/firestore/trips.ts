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

// Public reverse lookup: inviteTokens/{token} = { tripId }
// Allows non-members to look up a tripId by invite token without querying the
// protected trips collection.
const inviteTokensCol = collection(db, "inviteTokens");

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
  // Write token to the trip doc AND to the public reverse-lookup collection so
  // non-members can resolve a tripId without querying the protected trips collection.
  await Promise.all([
    updateDoc(tripDoc(tripId), { inviteToken: token, updatedAt: serverTimestamp() }),
    setDoc(doc(inviteTokensCol, token), { tripId }),
  ]);
  return token;
}

export async function joinTripByToken(token: string, uid: string): Promise<string | null> {
  // Look up tripId from the public inviteTokens collection — no auth required,
  // avoids querying the protected trips collection.
  const linkSnap = await getDoc(doc(inviteTokensCol, token));
  if (!linkSnap.exists()) return null;
  const tripId = (linkSnap.data() as { tripId: string }).tripId;

  // arrayUnion is idempotent — safe to call even if already a collaborator.
  // The Firestore update rule permits any auth'd user to add themselves to collaborators.
  await updateDoc(tripDoc(tripId), { collaborators: arrayUnion(uid), updatedAt: serverTimestamp() });
  return tripId;
}

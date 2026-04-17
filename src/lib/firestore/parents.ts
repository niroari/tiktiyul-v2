import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Parent } from "@/lib/types";

function parentsCol(tripId: string) {
  return collection(db, "trips", tripId, "parents");
}

function parentDoc(tripId: string, parentId: string) {
  return doc(db, "trips", tripId, "parents", parentId);
}

export async function addParent(
  tripId: string,
  parent: Omit<Parent, "id">
): Promise<string> {
  const ref = doc(parentsCol(tripId));
  await setDoc(ref, { ...parent, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateParent(
  tripId: string,
  parentId: string,
  data: Partial<Omit<Parent, "id">>
): Promise<void> {
  await updateDoc(parentDoc(tripId, parentId), data);
}

export async function deleteParent(
  tripId: string,
  parentId: string
): Promise<void> {
  await deleteDoc(parentDoc(tripId, parentId));
}

export function subscribeToParents(
  tripId: string,
  callback: (parents: Parent[]) => void
): Unsubscribe {
  return onSnapshot(parentsCol(tripId), (snap) => {
    const parents = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Parent));
    parents.sort((a, b) => a.name.localeCompare(b.name, "he"));
    callback(parents);
  });
}

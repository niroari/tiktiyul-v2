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
import { StaffMember } from "@/lib/types";

function staffCol(tripId: string) {
  return collection(db, "trips", tripId, "staff");
}

function staffDoc(tripId: string, staffId: string) {
  return doc(db, "trips", tripId, "staff", staffId);
}

export async function addStaffMember(
  tripId: string,
  member: Omit<StaffMember, "id">
): Promise<string> {
  const ref = doc(staffCol(tripId));
  await setDoc(ref, { ...member, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateStaffMember(
  tripId: string,
  staffId: string,
  data: Partial<Omit<StaffMember, "id">>
): Promise<void> {
  await updateDoc(staffDoc(tripId, staffId), data);
}

export async function deleteStaffMember(
  tripId: string,
  staffId: string
): Promise<void> {
  await deleteDoc(staffDoc(tripId, staffId));
}

export function subscribeToStaff(
  tripId: string,
  callback: (staff: StaffMember[]) => void
): Unsubscribe {
  return onSnapshot(staffCol(tripId), (snap) => {
    const staff = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffMember));
    staff.sort((a, b) => a.name.localeCompare(b.name, "he"));
    callback(staff);
  });
}

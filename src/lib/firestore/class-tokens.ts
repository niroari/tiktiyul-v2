import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ClassToken } from "@/lib/types";

// Flat top-level collection — token UUID is the doc ID.
// The public edit page only knows the token, not the tripId.
const col = collection(db, "classTokens");

export async function createClassToken(
  tripId: string,
  className: string,
  tripName: string,
  schoolName: string
): Promise<string> {
  const token = crypto.randomUUID();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 60);
  await setDoc(doc(col, token), {
    token,
    tripId,
    class: className,
    tripName,
    schoolName,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiry),
  });
  return token;
}

export async function getClassToken(token: string): Promise<ClassToken | null> {
  const snap = await getDoc(doc(col, token));
  return snap.exists() ? (snap.data() as ClassToken) : null;
}

export async function listClassTokensForTrip(tripId: string): Promise<ClassToken[]> {
  const snap = await getDocs(query(col, where("tripId", "==", tripId)));
  return snap.docs.map((d) => d.data() as ClassToken);
}

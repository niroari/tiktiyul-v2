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

export type RoomForToken = {
  id: string;
  number: string;
  capacity?: number;
  gender: "male" | "female";
};

export type RoomFillToken = {
  token: string;
  tripId: string;
  class: string;
  tripName: string;
  schoolName: string;
  rooms: RoomForToken[];
  createdAt: Timestamp;
  expiresAt: Timestamp;
};

const col = collection(db, "roomFillTokens");

export async function createRoomFillToken(
  tripId: string,
  className: string,
  tripName: string,
  schoolName: string,
  rooms: RoomForToken[]
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
    rooms,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiry),
  });
  return token;
}

export async function getRoomFillToken(token: string): Promise<RoomFillToken | null> {
  const snap = await getDoc(doc(col, token));
  return snap.exists() ? ({ token: snap.id, ...snap.data() } as RoomFillToken) : null;
}

export async function listRoomFillTokensForTrip(tripId: string): Promise<RoomFillToken[]> {
  const snap = await getDocs(query(col, where("tripId", "==", tripId)));
  return snap.docs.map((d) => ({ token: d.id, ...d.data() } as RoomFillToken));
}

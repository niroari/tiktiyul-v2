import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SigStatus = "pending" | "signed";

export type SignatureDoc = {
  tripId:      string;
  role:        string;
  roleName:    string;
  tripName:    string;
  schoolName:  string;
  leaderName:  string;
  previewHTML: string | null;  // inner HTML snapshot of the document at send time
  requiresId?: boolean;        // if true, sign page collects ID number
  idNumber?:   string;         // filled in by the signer
  status:      SigStatus;
  signature:   string | null;  // base64 PNG data URL
  createdAt:   Timestamp;
  expiresAt:   Timestamp;
  signedAt?:   Timestamp;
};

function sigRef(docId: string) {
  return doc(db, "signatures", docId);
}

/** Deterministic doc ID: "{tripId}_{role}" */
export function sigDocId(tripId: string, role: string): string {
  return `${tripId}_${role}`;
}

export async function createSignatureRequest(
  docId: string,
  data: Pick<SignatureDoc, "tripId" | "role" | "roleName" | "tripName" | "schoolName" | "leaderName" | "previewHTML" | "requiresId">
): Promise<void> {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  await setDoc(sigRef(docId), {
    ...data,
    status:    "pending",
    signature: null,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiry),
  });
}

export async function getSignatureRequest(docId: string): Promise<SignatureDoc | null> {
  const snap = await getDoc(sigRef(docId));
  return snap.exists() ? (snap.data() as SignatureDoc) : null;
}

export function subscribeToSignature(
  docId: string,
  callback: (data: SignatureDoc | null) => void
): Unsubscribe {
  return onSnapshot(sigRef(docId), (snap) => {
    callback(snap.exists() ? (snap.data() as SignatureDoc) : null);
  });
}

export async function submitSignature(docId: string, dataUrl: string, idNumber?: string): Promise<void> {
  if (
    (!dataUrl.startsWith("data:image/png;base64,") && !dataUrl.startsWith("data:image/jpeg;base64,")) ||
    dataUrl.length > 300_000
  ) {
    throw new Error("Invalid signature data");
  }
  await updateDoc(sigRef(docId), {
    signature: dataUrl,
    status:    "signed",
    signedAt:  serverTimestamp(),
    ...(idNumber ? { idNumber } : {}),
  });
}

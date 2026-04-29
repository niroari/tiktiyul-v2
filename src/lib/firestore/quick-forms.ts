import {
  doc,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Drafts (one per user per type) ────────────────────────────────────────────

function quickFormDoc(uid: string, type: string) {
  return doc(db, "quick-forms", `${uid}_${type}`);
}

export async function saveQuickForm(
  uid: string,
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  await setDoc(quickFormDoc(uid, type), { ...data, uid, savedAt: serverTimestamp() }, { merge: true });
}

export function subscribeToQuickForm(
  uid: string,
  type: string,
  callback: (data: Record<string, unknown> | null) => void
): Unsubscribe {
  return onSnapshot(quickFormDoc(uid, type), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// ── Named saved forms ─────────────────────────────────────────────────────────

export type SavedFormEntry = {
  id: string;
  uid: string;
  type: "bus-check" | "gimel";
  name: string;
  savedAt: Timestamp | null;
};

export async function saveNamedForm(
  uid: string,
  type: string,
  name: string,
  data: Record<string, unknown>
): Promise<string> {
  const id = crypto.randomUUID();
  await setDoc(doc(db, "quick-saved", id), {
    ...data, uid, type, name, savedAt: serverTimestamp(),
  });
  return id;
}

export async function updateNamedForm(
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  await setDoc(doc(db, "quick-saved", id), { ...data, savedAt: serverTimestamp() }, { merge: true });
}

export function subscribeToNamedForm(
  id: string,
  callback: (data: Record<string, unknown> | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "quick-saved", id), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export function listSavedForms(
  uid: string,
  callback: (forms: SavedFormEntry[]) => void
): Unsubscribe {
  const q = query(collection(db, "quick-saved"), where("uid", "==", uid));
  return onSnapshot(q, (snap) => {
    const forms = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedFormEntry));
    forms.sort((a, b) => {
      const at = a.savedAt?.seconds ?? 0;
      const bt = b.savedAt?.seconds ?? 0;
      return bt - at;
    });
    callback(forms);
  });
}

export async function deleteSavedForm(id: string): Promise<void> {
  await deleteDoc(doc(db, "quick-saved", id));
}

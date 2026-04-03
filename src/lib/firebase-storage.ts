import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Upload a File to Firebase Storage under trips/{tripId}/{folder}/{filename}.
 * Reports progress via onProgress (0–100).
 * Returns the public download URL.
 */
export async function uploadFile(
  tripId: string,
  folder: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const path = `trips/${tripId}/${folder}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress?.(pct);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

/**
 * Delete a file from Firebase Storage by its download URL.
 * Silently ignores errors (file may already be gone).
 */
export async function deleteFileByUrl(url: string): Promise<void> {
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch {
    // ignore — file may not exist
  }
}

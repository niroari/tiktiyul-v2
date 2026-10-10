import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminApp: App | undefined;
let adminDb: Firestore | undefined;

export function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tik-tiyul";

  if (serviceAccountJson && serviceAccountJson.trim() !== "") {
    try {
      let raw = serviceAccountJson.trim();
      // Handle cases where Vercel or user wrapped the JSON in surrounding quotes
      if (
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
      ) {
        raw = raw.slice(1, -1);
      }

      const parsed = JSON.parse(
        raw.startsWith("{")
          ? raw
          : Buffer.from(raw, "base64").toString("utf-8")
      );

      // Handle PEM newline escapes in private_key
      if (parsed.private_key && typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }

      adminApp = initializeApp({
        credential: cert(parsed),
        projectId: parsed.project_id || projectId,
      });
      return adminApp;
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }

  // Fallback for environments with application default credentials or project ID only
  adminApp = initializeApp({
    projectId,
  });
  return adminApp;
}

export function getAdminDb(): Firestore {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  adminDb = getFirestore(app);
  return adminDb;
}

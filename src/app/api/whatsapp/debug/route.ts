import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db
      .collection("webhook_debug_logs")
      .orderBy("receivedAt", "desc")
      .limit(10)
      .get();

    const logs = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ count: logs.length, logs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

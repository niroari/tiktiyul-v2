import { NextRequest, NextResponse } from "next/server";
import { processDueReminders, runAutonomousTripAlerts } from "@/lib/server/reminders";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Verify Cron Secret if set (Vercel automatically sends this header)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Check if query param ?key= is provided for manual triggers
    const key = req.nextUrl.searchParams.get("key");
    if (key !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const [remindersRes, alertsRes] = await Promise.all([
      processDueReminders(),
      runAutonomousTripAlerts(),
    ]);

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      reminders: remindersRes,
      alerts: alertsRes,
    });
  } catch (err: unknown) {
    console.error("Cron reminders error:", err);
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

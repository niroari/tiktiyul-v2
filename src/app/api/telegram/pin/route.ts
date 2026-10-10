import { NextRequest, NextResponse } from "next/server";
import { generateTripPin } from "@/lib/server/session-manager";

export async function POST(req: NextRequest) {
  try {
    const { tripId } = await req.json();
    if (!tripId) {
      return NextResponse.json({ error: "tripId is required" }, { status: 400 });
    }

    const pin = await generateTripPin(tripId);
    return NextResponse.json({ pin });
  } catch (err: unknown) {
    console.error("Error generating trip PIN:", err);
    const message = err instanceof Error ? err.message : "Failed to generate PIN";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

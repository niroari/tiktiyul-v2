"use client";

import { useParams } from "next/navigation";
import { useTrip } from "@/hooks/use-trip";
import { TripShell } from "@/components/trip-shell";

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip } = useTrip(tripId);

  return (
    <TripShell
      tripId={tripId}
      tripName={trip?.name ?? ""}
      schoolName={trip?.schoolName ?? ""}
      inviteToken={trip?.inviteToken}
    >
      {children}
    </TripShell>
  );
}

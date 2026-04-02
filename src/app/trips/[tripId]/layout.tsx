import { TripShell } from "@/components/trip-shell";
import { getTrip } from "@/lib/firestore/trips";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);

  return (
    <TripShell
      tripId={tripId}
      tripName={trip?.name ?? "טיול"}
      schoolName={trip?.schoolName ?? ""}
    >
      {children}
    </TripShell>
  );
}

import { TripShell } from "@/components/trip-shell";

// Temporary mock — will come from Firestore in step 2.5
async function getTrip(tripId: string) {
  return {
    id: tripId,
    name: "טיול שנתי — כיתות ט׳",
    schoolName: "בי״ס בן גוריון, הרצליה",
  };
}

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
    <TripShell tripId={tripId} tripName={trip.name} schoolName={trip.schoolName}>
      {children}
    </TripShell>
  );
}

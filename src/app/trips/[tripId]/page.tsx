import { redirect } from "next/navigation";

export default function TripRoot({ params }: { params: Promise<{ tripId: string }> }) {
  return params.then(({ tripId }) => redirect(`/trips/${tripId}/dashboard`));
}

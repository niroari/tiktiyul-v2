"use client";

import { useEffect, useState } from "react";
import { subscribeToTrip } from "@/lib/firestore/trips";
import { Trip } from "@/lib/types";

export function useTrip(tripId: string) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToTrip(tripId, (data) => {
      setTrip(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId]);

  return { trip, loading };
}

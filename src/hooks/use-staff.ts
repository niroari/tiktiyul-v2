"use client";

import { useEffect, useState } from "react";
import { subscribeToStaff } from "@/lib/firestore/staff";
import { StaffMember } from "@/lib/types";

export function useStaff(tripId: string) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToStaff(tripId, (data) => {
      setStaff(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId]);

  return { staff, loading };
}

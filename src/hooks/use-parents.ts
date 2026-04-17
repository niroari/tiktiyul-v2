"use client";

import { useEffect, useState } from "react";
import { subscribeToParents } from "@/lib/firestore/parents";
import { Parent } from "@/lib/types";

export function useParents(tripId: string) {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToParents(tripId, (data) => {
      setParents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId]);

  return { parents, loading };
}

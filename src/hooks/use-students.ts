"use client";

import { useEffect, useState } from "react";
import { subscribeToStudents } from "@/lib/firestore/students";
import { Student } from "@/lib/types";

export function useStudents(tripId: string) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToStudents(tripId, (data) => {
      setStudents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId]);

  return { students, loading };
}

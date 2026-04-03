"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { joinTripByToken } from "@/lib/firestore/trips";

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "joining" | "not_found" | "done" | "error">("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Save the join token so we can redirect back after login
      sessionStorage.setItem("joinToken", token);
      router.replace("/login");
      return;
    }
    setState("joining");
    joinTripByToken(token, user.uid)
      .then((tripId) => {
        if (!tripId) { setState("not_found"); return; }
        router.replace(`/trips/${tripId}`);
      })
      .catch(() => setState("error"));
  }, [loading, user, token, router]);

  // After login, check if there's a pending join token
  useEffect(() => {
    if (!user) return;
    const pending = sessionStorage.getItem("joinToken");
    if (pending && pending === token) {
      sessionStorage.removeItem("joinToken");
    }
  }, [user, token]);

  const msg: Record<typeof state, string> = {
    loading:   "טוען...",
    joining:   "מצטרף לטיול...",
    not_found: "קישור ההצטרפות אינו תקף או פג תוקפו.",
    done:      "מועבר...",
    error:     "שגיאה בהצטרפות. נסה שוב.",
  };

  return (
    <div className="min-h-screen bg-[#f6faf8] flex items-center justify-center px-4" dir="rtl">
      <div className="bg-white rounded-2xl border border-border shadow-sm p-8 text-center max-w-sm w-full space-y-3">
        {state === "not_found" ? (
          <>
            <div className="text-3xl">⚠️</div>
            <p className="font-medium">{msg[state]}</p>
            <p className="text-sm text-muted-foreground">בקש קישור חדש מבעל הטיול.</p>
          </>
        ) : state === "error" ? (
          <>
            <div className="text-3xl">❌</div>
            <p className="font-medium">{msg[state]}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{msg[state]}</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export default function TripsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-sm">טוען...</span>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

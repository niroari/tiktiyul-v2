"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trip } from "@/lib/types";
import { subscribeToUserTrips, createTrip, deleteTrip } from "@/lib/firestore/trips";

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

function daysUntil(iso: string) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function TripsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserTrips(user.uid, (data) => {
      setTrips(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-muted">
      <header className="sticky top-0 z-10 bg-white border-b border-border h-14 flex items-center justify-between px-6 shadow-[var(--shadow-card)]">
        <span className="font-bold text-lg text-primary tracking-tight">תיק טיול</span>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            טיול חדש
          </Button>
          <UserAvatar user={user} onSignOut={handleSignOut} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">הטיולים שלי</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "טוען..." : `${trips.length} טיולים`}
          </p>
        </div>

        {!loading && trips.length === 0 ? (
          <EmptyState onNew={() => setDialogOpen(true)} />
        ) : (
          <div className="grid gap-4">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                isOwner={trip.ownerUid === user?.uid}
                onOpen={() => router.push(`/trips/${trip.id}`)}
                onDelete={async () => {
                  if (!confirm(`למחוק את "${trip.name}"?`)) return;
                  await deleteTrip(trip.id);
                }}
              />
            ))}
          </div>
        )}
      </main>

      <NewTripDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={(id) => router.push(`/trips/${id}/settings`)}
        uid={user?.uid ?? ""}
      />
    </div>
  );
}

// ─── User Avatar ──────────────────────────────────────────────────────────────

function UserAvatar({ user, onSignOut }: { user: ReturnType<typeof useAuth>["user"]; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const initial = user?.displayName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-[#1b4332] text-white text-sm font-semibold flex items-center justify-center overflow-hidden flex-shrink-0"
      >
        {user?.photoURL
          ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
          : initial}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-20 bg-white border border-border rounded-xl shadow-lg p-3 w-52 space-y-2 text-sm">
            <p className="text-xs text-muted-foreground truncate px-1">{user?.displayName ?? user?.email}</p>
            <hr className="border-border" />
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full text-right px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-destructive"
            >
              יציאה
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Trip Card ───────────────────────────────────────────────────────────────

function TripCard({
  trip,
  isOwner,
  onOpen,
  onDelete,
}: {
  trip: Trip;
  isOwner: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const days = daysUntil(trip.startDate);
  const totalStudents = trip.classes?.reduce((sum, c) => sum + c.studentCount, 0) ?? 0;

  return (
    <Card className="p-5 hover:shadow-md transition-shadow border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="font-semibold text-foreground text-base">{trip.name}</h2>
            {days !== null && days > 0 && days <= 60 && (
              <Badge variant="secondary" className="text-xs">עוד {days} ימים</Badge>
            )}
            {!isOwner && (
              <Badge variant="outline" className="text-xs text-muted-foreground">משותף</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">{trip.schoolName}</p>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {trip.startDate && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(trip.startDate)}–{formatDate(trip.endDate)}
              </span>
            )}
            {totalStudents > 0 && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                {totalStudents} תלמידים
              </span>
            )}
            {trip.classes?.length > 0 && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {trip.classes.map((c) => c.name).join(" · ")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={onOpen}>פתח</Button>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            מחק
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <Card className="p-12 flex flex-col items-center justify-center text-center border-dashed border-2 border-border bg-transparent shadow-none">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
      <h3 className="font-semibold text-foreground mb-1">אין טיולים עדיין</h3>
      <p className="text-sm text-muted-foreground mb-4">צור את הטיול הראשון שלך כדי להתחיל</p>
      <Button onClick={onNew}>
        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        צור טיול חדש
      </Button>
    </Card>
  );
}

// ─── New Trip Dialog ──────────────────────────────────────────────────────────

function NewTripDialog({
  open,
  onClose,
  onCreate,
  uid,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (tripId: string) => void;
  uid: string;
}) {
  const [name, setName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !uid) return;
    setSaving(true);
    try {
      const id = await createTrip({
        name: name.trim(),
        schoolName: schoolName.trim(),
        startDate: "",
        endDate: "",
        classes: [],
        accommodation: "",
        transport: "",
        ownerUid: uid,
        collaborators: [],
      });
      setName("");
      setSchoolName("");
      onCreate(id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>טיול חדש</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>שם הטיול</Label>
            <Input
              placeholder="לדוגמה: טיול שנתי — כיתות ט׳"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>שם בית הספר</Label>
            <Input
              placeholder="לדוגמה: בי״ס בן גוריון, הרצליה"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "יוצר..." : "צור טיול"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Trip } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock data — will be replaced with Firestore in step 2.5
const MOCK_TRIPS: Trip[] = [
  {
    id: "1",
    name: "טיול שנתי — כיתות ט׳",
    schoolName: "בי״ס בן גוריון, הרצליה",
    startDate: "2026-05-15",
    endDate: "2026-05-17",
    classes: [
      { name: "ט׳1", studentCount: 30 },
      { name: "ט׳2", studentCount: 28 },
      { name: "ט׳3", studentCount: 29 },
    ],
    accommodation: "אכסניית נוער",
    transport: "אוטובוסים",
    ownerUid: "mock",
    collaborators: [],
    createdAt: "2026-03-01",
    updatedAt: "2026-04-01",
  },
  {
    id: "2",
    name: "טיול סיום — כיתות י״ב",
    schoolName: "בי״ס בן גוריון, הרצליה",
    startDate: "2026-06-10",
    endDate: "2026-06-12",
    classes: [
      { name: "י״ב1", studentCount: 32 },
      { name: "י״ב2", studentCount: 31 },
    ],
    accommodation: "מלון",
    transport: "אוטובוסים",
    ownerUid: "mock",
    collaborators: [],
    createdAt: "2026-03-15",
    updatedAt: "2026-03-20",
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function TripsPage() {
  return (
    <div className="min-h-screen bg-muted">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-border h-14 flex items-center justify-between px-6 shadow-[var(--shadow-card)]">
        <span className="font-bold text-lg text-primary tracking-tight">תיק טיול</span>
        <Button size="sm">
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          טיול חדש
        </Button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">הטיולים שלי</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{MOCK_TRIPS.length} טיולים פעילים</p>
        </div>

        {MOCK_TRIPS.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4">
            {MOCK_TRIPS.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const days = daysUntil(trip.startDate);
  const totalStudents = trip.classes.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="font-semibold text-foreground text-base">{trip.name}</h2>
            {days > 0 && days <= 60 && (
              <Badge variant="secondary" className="text-xs">
                עוד {days} ימים
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">{trip.schoolName}</p>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(trip.startDate)}–{formatDate(trip.endDate)}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {totalStudents} תלמידים
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {trip.classes.map((c) => c.name).join(" · ")}
            </span>
          </div>
        </div>

        {/* Progress ring placeholder */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full border-4 border-muted flex items-center justify-center">
            <span className="text-xs font-bold text-muted-foreground">35%</span>
          </div>
          <span className="text-xs text-muted-foreground">הושלם</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm">פתח</Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground">שתף</Button>
        </div>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">מחק</Button>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="p-12 flex flex-col items-center justify-center text-center border-dashed border-2 border-border bg-transparent shadow-none">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
      <h3 className="font-semibold text-foreground mb-1">אין טיולים עדיין</h3>
      <p className="text-sm text-muted-foreground mb-4">צור את הטיול הראשון שלך כדי להתחיל</p>
      <Button>
        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        צור טיול חדש
      </Button>
    </Card>
  );
}

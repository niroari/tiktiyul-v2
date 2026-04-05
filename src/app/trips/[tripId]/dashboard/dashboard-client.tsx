"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTrip } from "@/hooks/use-trip";
import { useStudents } from "@/hooks/use-students";
import { useStaff } from "@/hooks/use-staff";
import { subscribeToAllAppendices } from "@/lib/firestore/appendix";
import { PrintTripButton } from "./print-trip-button";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(iso: string) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

// ─── Appendix nav config ──────────────────────────────────────────────────────

const APPENDICES = [
  { letter: "א", label: "בדיקה לפני יציאה", slug: "alef" },
  { letter: "ב", label: "אישור מנהל ורכז",  slug: "bet" },
  { letter: "ג", label: "כתב מינוי",         slug: "gimel" },
  { letter: "ד", label: "לוח זמנים",         slug: "dalet" },
  { letter: "ה", label: "טלפונים חיוניים",   slug: "hey" },
  { letter: "ו", label: "טבלת שליטה",        slug: "vav" },
  { letter: "ז", label: "רשימת תלמידים",     slug: "zayin" },
  { letter: "ח", label: "אישור הורים",       slug: "chet" },
  { letter: "ט", label: "ציוד חובה",         slug: "tet" },
  { letter: "י", label: "מגבלות רפואיות",    slug: "yod" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip, loading: tripLoading } = useTrip(tripId);
  const { students, loading: studentsLoading } = useStudents(tripId);
  const { staff } = useStaff(tripId);
  const [appendixMap, setAppendixMap] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    return subscribeToAllAppendices(tripId, setAppendixMap);
  }, [tripId]);

  const loading = tripLoading || studentsLoading;

  // Derived stats
  const going = students.filter((s) => s.isGoing);
  const notGoing = students.length - going.length;
  const boys  = going.filter((s) => s.gender === "male").length;
  const girls = going.filter((s) => s.gender === "female").length;
  const days = trip?.startDate ? daysUntil(trip.startDate) : null;

  // Class breakdown
  const byClass = going.reduce<Record<string, number>>((acc, s) => {
    acc[s.class] = (acc[s.class] ?? 0) + 1;
    return acc;
  }, {});

  // Food prefs
  const vegetarian = going.filter((s) => s.dietaryFlags?.vegetarian).length;
  const vegan      = going.filter((s) => s.dietaryFlags?.vegan).length;
  const glutenFree = going.filter((s) => s.dietaryFlags?.glutenFree).length;

  // Alerts
  const alerts: { type: "danger" | "warn" | "info"; text: string }[] = [];

  // Trip basics
  if (!trip?.startDate) alerts.push({ type: "warn", text: "תאריך טיול לא הוגדר — עדכן בפרטי הטיול" });
  if (students.length === 0) alerts.push({ type: "warn", text: "טרם יובאו תלמידים — ייבא רשימת תלמידים" });
  if (staff.length === 0) alerts.push({ type: "info", text: "צוות הטיול ריק — הוסף אנשי צוות" });

  // Buses
  const vavBuses = (appendixMap["vav"]?.buses as unknown[]) ?? [];
  if (students.length > 0 && vavBuses.length === 0)
    alerts.push({ type: "warn", text: "לא הוגדרו אוטובוסים בטבלת השליטה" });

  // Security approval
  if (!(appendixMap["security"]?.fileUrl as string))
    alerts.push({ type: "warn", text: "אישור ביטחוני לא הועלה" });

  // Key appendices not started
  if (!appendixMap["bet"])
    alerts.push({ type: "warn", text: "נספח ב׳ (אישור מנהל ורכז) לא הושלם" });
  if (!appendixMap["gimel"])
    alerts.push({ type: "warn", text: "נספח ג׳ (כתב מינוי) לא הושלם" });

  // Medical restrictions — remind if students loaded but yod is empty
  const yodRows = (appendixMap["yod"]?.rows as unknown[]) ?? [];
  if (going.length > 0 && yodRows.length === 0)
    alerts.push({ type: "info", text: "נספח י׳ ריק — ודא שאין תלמידים עם מגבלות רפואיות" });

  // Dietary flags — remind if no going student has any flag set
  const anyDietary = going.some(
    (s) => s.dietaryFlags?.vegetarian || s.dietaryFlags?.vegan || s.dietaryFlags?.glutenFree
  );
  if (going.length > 0 && !anyDietary)
    alerts.push({ type: "info", text: "אין תלמידים עם מגבלות מזון מוגדרות — ודא שהמידע עודכן" });

  // Upcoming trip with incomplete appendices
  const APPENDIX_SLUGS = ["alef","bet","gimel","dalet","hey","vav","zayin","chet","tet","yod"];
  const missingCount = APPENDIX_SLUGS.filter((slug) =>
    slug === "zayin" ? going.length === 0 : !appendixMap[slug]
  ).length;
  if (days !== null && days <= 14 && days > 0 && missingCount > 0)
    alerts.push({ type: "danger", text: `הטיול בעוד ${days} ימים — נותרו ${missingCount} נספחים שלא הושלמו` });

  if (loading) {
    return <div className="text-sm text-muted-foreground p-4">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">דשבורד</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {trip?.name ?? "טיול"} · {trip?.schoolName ?? ""}
          </p>
        </div>
        <PrintTripButton tripId={tripId} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="תלמידים יוצאים"
          value={going.length}
          sub={notGoing > 0 ? `${notGoing} לא יוצאים` : "כולם יוצאים"}
          subColor={notGoing > 0 ? "muted" : "success"}
        />
        <StatCard label="בנים" value={boys} sub={going.length > 0 ? `${Math.round(boys / going.length * 100)}%` : ""} />
        <StatCard label="בנות" value={girls} sub={going.length > 0 ? `${Math.round(girls / going.length * 100)}%` : ""} />
        <StatCard
          label="אנשי צוות"
          value={staff.length}
          sub={staff.length > 0 ? staff.map((s) => s.role).slice(0, 2).join(" · ") : "אין עדיין"}
        />
        <StatCard
          label="כיתות"
          value={Object.keys(byClass).length || trip?.classes?.length || 0}
          sub={Object.keys(byClass).join(" · ") || "—"}
        />
        <StatCard
          label="ימים לטיול"
          value={days !== null ? (days > 0 ? days : "היום!") : "—"}
          sub={trip?.startDate ? `${formatDate(trip.startDate)}–${formatDate(trip.endDate)}` : "תאריך לא הוגדר"}
          subColor={days !== null && days <= 14 ? "warn" : "muted"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Appendix status */}
        <div className="lg:col-span-2 bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">נספחים</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {APPENDICES.map((a) => {
              const saved = a.slug === "zayin" ? students.length > 0 : !!appendixMap[a.slug];
              return (
                <Link
                  key={a.slug}
                  href={`/trips/${tripId}/appendix/${a.slug}`}
                  className="rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3 text-center hover:border-primary/40 hover:bg-[var(--brand-light)] transition-colors group"
                >
                  <div className="text-base font-bold text-muted-foreground group-hover:text-primary">{a.letter}׳</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-tight line-clamp-2">{a.label}</div>
                  <div className={`mt-1.5 w-2 h-2 rounded-full mx-auto transition-colors ${saved ? "bg-[var(--success)]" : "bg-border"}`} />
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-[var(--success)]" /> הושלם
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-border" /> טרם התחיל
            </div>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-4">

          {/* Food prefs */}
          <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">העדפות מזון</h2>
            {going.length === 0 ? (
              <p className="text-xs text-muted-foreground">אין תלמידים עדיין</p>
            ) : (
              <ul className="space-y-2">
                <FoodRow label="צמחוני" count={vegetarian} total={going.length} />
                <FoodRow label="טבעוני" count={vegan} total={going.length} />
                <FoodRow label="ללא גלוטן" count={glutenFree} total={going.length} />
              </ul>
            )}
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">פעולות נדרשות</h2>
            {alerts.length === 0 ? (
              <p className="text-xs text-[var(--success)] font-medium">הכל תקין ✓</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a, i) => (
                  <li key={i} className={`text-xs p-2 rounded-[var(--radius-sm)] border flex gap-2 items-start
                    ${a.type === "danger" ? "bg-[var(--danger-light)] border-red-200 text-red-700" :
                      a.type === "warn"   ? "bg-[var(--warn-light)] border-amber-200 text-amber-700" :
                                            "bg-muted border-border text-muted-foreground"}`}>
                    <span className="mt-0.5 flex-shrink-0">
                      {a.type === "danger" ? "⛔" : a.type === "warn" ? "⚠️" : "ℹ️"}
                    </span>
                    {a.text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Class breakdown */}
          {Object.keys(byClass).length > 0 && (
            <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">פילוח כיתות</h2>
              <ul className="space-y-1.5">
                {Object.entries(byClass)
                  .sort(([a], [b]) => a.localeCompare(b, "he"))
                  .map(([cls, count]) => (
                    <li key={cls} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{cls}</span>
                      <span className="text-muted-foreground">{count} תלמידים</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  subColor = "muted",
}: {
  label: string;
  value: string | number;
  sub: string;
  subColor?: "muted" | "success" | "warn";
}) {
  const subCls =
    subColor === "success" ? "text-[var(--success)]" :
    subColor === "warn"    ? "text-[var(--warn)]" :
                             "text-muted-foreground";
  return (
    <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className={`text-xs mt-1 truncate ${subCls}`}>{sub}</p>
    </div>
  );
}

function FoodRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-left flex-shrink-0">{count}</span>
    </li>
  );
}

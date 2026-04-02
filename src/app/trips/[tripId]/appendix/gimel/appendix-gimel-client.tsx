"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTrip } from "@/hooks/use-trip";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormData = {
  date: string;
  leaderName: string;
  principalName: string;
  area: string;
};

const INITIAL: FormData = { date: "", leaderName: "", principalName: "", area: "" };

function formatDateHe(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

export function AppendixGimelClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip } = useTrip(tripId);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "gimel", (raw) => {
      if (raw) setForm({
        date:          String(raw.date ?? ""),
        leaderName:    String(raw.leaderName ?? ""),
        principalName: String(raw.principalName ?? ""),
        area:          String(raw.area ?? ""),
      });
    });
    return () => unsub();
  }, [tripId]);

  function setField(key: keyof FormData, value: string) {
    const updated = { ...form, [key]: value };
    setForm(updated);
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "gimel", updated as unknown as Record<string, unknown>);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  const classes = trip?.classes?.map((c) => c.name).join(", ") ?? "—";
  const dateRange = trip?.startDate && trip?.endDate
    ? `${formatDateHe(trip.startDate)} עד ${formatDateHe(trip.endDate)}`
    : "—";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ג׳ — כתב מינוי לאחראי/ת טיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">בחתימת מנהל/ת ביה"ס</p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {/* Fields */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>תאריך הכתב</Label>
            <Input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>שם בית הספר</Label>
            <div className="px-3 py-2 text-sm bg-muted/40 border border-border rounded-[var(--radius-sm)] text-muted-foreground">
              {trip?.schoolName ?? "—"}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>שם האחראי/ת על הטיול</Label>
            <Input value={form.leaderName} onChange={(e) => setField("leaderName", e.target.value)} placeholder="שם מלא" />
          </div>
          <div className="space-y-1.5">
            <Label>שם מנהל/ת ביה"ס</Label>
            <Input value={form.principalName} onChange={(e) => setField("principalName", e.target.value)} placeholder="שם מלא" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>אזור / יעד הטיול</Label>
            <Input value={form.area} onChange={(e) => setField("area", e.target.value)} placeholder="לדוגמה: גליל עליון, מצדה..." />
          </div>
        </div>
      </div>

      {/* Letter preview */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">נוסח כתב המינוי</h2>
        <div className="bg-muted/30 border border-border rounded-[var(--radius-sm)] p-6 text-sm leading-loose space-y-4">
          <p>
            <span className="text-muted-foreground">תאריך: </span>
            <strong>{form.date ? formatDateHe(form.date) : "—"}</strong>
          </p>
          <p>
            <span className="text-muted-foreground">אל: </span>
            <strong>{form.leaderName || "—"}</strong>
          </p>
          <p>
            הריני ממנה אותך לאחראי/ת טיול לתלמידי כית/ות{" "}
            <strong>{classes}</strong>{" "}
            שיתקיים בתאריכים{" "}
            <strong>{dateRange}</strong>{" "}
            במקום/באזור{" "}
            <strong>{form.area || "—"}</strong>.
          </p>
          <div className="pt-4 border-t border-border">
            <p className="text-muted-foreground text-xs mb-1">בכבוד רב,</p>
            <p className="font-semibold">{form.principalName || "—"}</p>
            <p className="text-xs text-muted-foreground">מנהל/ת ביה"ס</p>
          </div>
        </div>
      </div>

      {/* Signature placeholder */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">חתימת מנהל/ת ביה"ס</h2>
        <div className="border border-dashed border-border rounded-[var(--radius-sm)] p-6 text-center">
          <span className="text-xs text-muted-foreground">חתימות — שלב 5</span>
        </div>
      </div>
    </div>
  );
}

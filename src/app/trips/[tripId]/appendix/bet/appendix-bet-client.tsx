"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTrip } from "@/hooks/use-trip";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { AppendixActions } from "@/components/appendix-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleRow = {
  id: string;
  date: string;
  fromTime: string;
  toTime: string;
  activity: string;
  notes: string;
};

type FormData = {
  weapons: string;
  parents: string;
  leaderName: string;
  leaderPhone: string;
  leaderNotes: string;
  principalNotes: string;
  schedule: ScheduleRow[];
};

const EMPTY_ROW = (): ScheduleRow => ({
  id: crypto.randomUUID(),
  date: "",
  fromTime: "",
  toTime: "",
  activity: "",
  notes: "",
});

const INITIAL: FormData = {
  weapons: "",
  parents: "",
  leaderName: "",
  leaderPhone: "",
  leaderNotes: "",
  principalNotes: "",
  schedule: [EMPTY_ROW()],
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AppendixBetClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip } = useTrip(tripId);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load from Firestore
  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "bet", (raw) => {
      if (raw) {
        setForm({
          weapons:        String(raw.weapons ?? ""),
          parents:        String(raw.parents ?? ""),
          leaderName:     String(raw.leaderName ?? ""),
          leaderPhone:    String(raw.leaderPhone ?? ""),
          leaderNotes:    String(raw.leaderNotes ?? ""),
          principalNotes: String(raw.principalNotes ?? ""),
          schedule:       (raw.schedule as ScheduleRow[]) ?? [EMPTY_ROW()],
        });
      }
    });
    return () => unsub();
  }, [tripId]);

  function scheduleAutoSave(updated: FormData) {
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "bet", updated as unknown as Record<string, unknown>);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function setField(key: keyof Omit<FormData, "schedule">, value: string) {
    const updated = { ...form, [key]: value };
    setForm(updated);
    scheduleAutoSave(updated);
  }

  function setRow(id: string, field: keyof ScheduleRow, value: string) {
    const schedule = form.schedule.map((r) => r.id === id ? { ...r, [field]: value } : r);
    const updated = { ...form, schedule };
    setForm(updated);
    scheduleAutoSave(updated);
  }

  function addRow() {
    const updated = { ...form, schedule: [...form.schedule, EMPTY_ROW()] };
    setForm(updated);
    scheduleAutoSave(updated);
  }

  function removeRow(id: string) {
    if (form.schedule.length <= 1) return;
    const updated = { ...form, schedule: form.schedule.filter((r) => r.id !== id) };
    setForm(updated);
    scheduleAutoSave(updated);
  }

  function getHTML() {
    const classes = trip?.classes?.map((c) => c.name).join(", ") ?? "";
    const schedRows = form.schedule.map((r) => `
      <tr>
        <td>${r.date}</td>
        <td style="text-align:center">${r.fromTime}</td>
        <td style="text-align:center">${r.toTime}</td>
        <td>${r.activity}</td>
        <td>${r.notes}</td>
      </tr>`).join("");
    return `
      <div class="header">
        <div class="ministry">משרד החינוך — מינהל חברה ונוער</div>
        <div class="title">נספח ב׳ — אישור תוכנית הטיול</div>
      </div>
      <div class="meta">
        <span>כיתות: <strong>${classes}</strong></span>
        <span>מקום לינה: <strong>${trip?.accommodation ?? ""}</strong></span>
        <span>הסעה: <strong>${trip?.transport ?? ""}</strong></span>
      </div>
      <div class="meta">
        <span>אחראי/ת טיול: <strong>${form.leaderName}</strong></span>
        <span>טלפון: <strong>${form.leaderPhone}</strong></span>
        <span>הורים מלווים: <strong>${form.parents}</strong></span>
        <span>נושאי נשק: <strong>${form.weapons}</strong></span>
      </div>
      <div class="section-title">מסלול הטיול — לוח זמנים</div>
      <table>
        <thead><tr>
          <th style="width:90px">תאריך</th>
          <th style="width:60px">משעה</th>
          <th style="width:60px">עד שעה</th>
          <th>פירוט הפעילות והמקום</th>
          <th style="width:110px">הערות</th>
        </tr></thead>
        <tbody>${schedRows}</tbody>
      </table>
      ${form.leaderNotes ? `<div class="section-title">הערות אחראי/ת טיול</div><p style="font-size:10px;line-height:1.6">${form.leaderNotes}</p>` : ""}
      ${form.principalNotes ? `<div class="section-title">הערות מנהל/ת</div><p style="font-size:10px;line-height:1.6">${form.principalNotes}</p>` : ""}
      <div class="section-title">חתימות</div>
      <table style="margin-top:8px">
        <tr>
          <th>מורה אחראי/ת</th><th>רכז/ת טיולים</th><th>מנהל/ת ביה"ס</th>
        </tr>
        <tr><td style="height:40px"></td><td></td><td></td></tr>
      </table>
    `;
  }

  // Auto-fill from trip metadata
  const classes = trip?.classes?.map((c) => c.name).join(", ") ?? "—";
  const accommodation = trip?.accommodation ?? "—";
  const transport = trip?.transport ?? "—";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ב׳ — אישור תוכנית הטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ימולא ע"י האחראי/ת על הטיול ויועבר לאישור מנהל/ת ביה"ס ורכז/ת הטיולים
          </p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {/* Trip details — auto-filled */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">פרטי הטיול</h2>

        <div className="grid grid-cols-2 gap-4">
          <ReadonlyField label="כיתות" value={classes} />
          <ReadonlyField label="מקום לינה" value={accommodation} />
          <ReadonlyField label="חברת הסעה" value={transport} />
          <ReadonlyField label="שם בית הספר" value={trip?.schoolName ?? "—"} />
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>שם האחראי/ת על הטיול</Label>
            <Input
              value={form.leaderName}
              onChange={(e) => setField("leaderName", e.target.value)}
              placeholder="שם מלא"
            />
          </div>
          <div className="space-y-1.5">
            <Label>טלפון סלולרי — אחראי/ת הטיול</Label>
            <Input
              value={form.leaderPhone}
              onChange={(e) => setField("leaderPhone", e.target.value)}
              placeholder="050-0000000"
              type="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label>מס׳ מלווים נושאי נשק</Label>
            <Input
              value={form.weapons}
              onChange={(e) => setField("weapons", e.target.value)}
              placeholder="0"
              type="number"
              min="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>הורים מלווים</Label>
            <Input
              value={form.parents}
              onChange={(e) => setField("parents", e.target.value)}
              placeholder="0"
              type="number"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Schedule table */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">מסלול הטיול — לוח זמנים ופירוט פעילויות</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-32">תאריך</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">משעה</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">עד שעה</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">פירוט הפעילות והמקום</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-36">הערות</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {form.schedule.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => setRow(row.id, "date", e.target.value)}
                      className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="time"
                      value={row.fromTime}
                      onChange={(e) => setRow(row.id, "fromTime", e.target.value)}
                      className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="time"
                      value={row.toTime}
                      onChange={(e) => setRow(row.id, "toTime", e.target.value)}
                      className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.activity}
                      onChange={(e) => setRow(row.id, "activity", e.target.value)}
                      placeholder="תיאור הפעילות והמקום..."
                      className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => setRow(row.id, "notes", e.target.value)}
                      placeholder="הערה..."
                      className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50"
                    />
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      disabled={form.schedule.length <= 1}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="ghost" size="sm" onClick={addRow} className="mt-3 text-primary">
          <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          הוסף שורה
        </Button>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">הערות ודגשים</h2>
        <div className="space-y-1.5">
          <Label>הערות ודגשים — אחראי/ת טיול</Label>
          <textarea
            value={form.leaderNotes}
            onChange={(e) => setField("leaderNotes", e.target.value)}
            rows={3}
            placeholder="הערות, דגשים מיוחדים..."
            className="w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2 focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground/50 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <Label>הערות מנהל/ת ביה"ס</Label>
          <textarea
            value={form.principalNotes}
            onChange={(e) => setField("principalNotes", e.target.value)}
            rows={3}
            placeholder="הערות מנהל/ת..."
            className="w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2 focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground/50 transition-colors"
          />
        </div>
      </div>

      <AppendixActions title="נספח ב׳ — אישור תוכנית הטיול" filename="נספח-ב" getHTML={getHTML} />

      {/* Signatures placeholder */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">חתימות</h2>
        <div className="grid grid-cols-3 gap-4">
          {["מורה אחראי/ת", "רכז/ת טיולים", "מנהל/ת ביה\"ס"].map((role) => (
            <div key={role} className="border border-dashed border-border rounded-[var(--radius-sm)] p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground mb-2">{role}</p>
              <div className="h-16 bg-muted/40 rounded flex items-center justify-center">
                <span className="text-xs text-muted-foreground">חתימות — שלב 5</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="px-3 py-2 text-sm bg-muted/40 border border-border rounded-[var(--radius-sm)] text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

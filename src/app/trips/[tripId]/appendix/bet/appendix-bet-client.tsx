"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTrip } from "@/hooks/use-trip";
import { getAppendix, saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { sigDocId, subscribeToSignature } from "@/lib/firestore/signatures";
import { AppendixActions, esc, safeSigUrl } from "@/components/appendix-actions";
import { SignatureCanvas, type SignatureCanvasHandle } from "@/components/signature-canvas";
import { RemoteSignature } from "@/components/remote-signature";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowDownToLine, ExternalLink, Check, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleRow = {
  id: string;
  date: string;
  fromTime: string;
  toTime: string;
  activity: string;
  notes: string;
};

type ItineraryRow = {
  id: string;
  day: string;
  time: string;
  activity: string;
  notes: string;
};

// ─── Schedule Import Helpers ──────────────────────────────────────────────────

function parseDateFromDay(
  dayStr: string,
  tripStartDate?: string,
  lastDate?: string
): string {
  const s = String(dayStr ?? "").trim();
  if (!s) {
    return lastDate || tripStartDate || "";
  }

  // 1. Direct ISO match: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Base year from tripStartDate or current year
  let baseYear = new Date().getFullYear();
  if (tripStartDate && /^\d{4}-\d{2}-\d{2}$/.test(tripStartDate)) {
    baseYear = parseInt(tripStartDate.substring(0, 4), 10);
  }

  // 2. Full date: DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  const fullDateMatch = s.match(/(\b\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (fullDateMatch) {
    const day = parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10);
    let year = parseInt(fullDateMatch[3], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 3. Short date: DD/MM or DD.MM (e.g. "15.5" in "יום א׳ / 15.5")
  const shortDateMatch = s.match(/(\b\d{1,2})[./](\d{1,2})\b/);
  if (shortDateMatch) {
    const day = parseInt(shortDateMatch[1], 10);
    const month = parseInt(shortDateMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${baseYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 4. Day number: "יום 1", "יום 2", "יום 3"
  const dayNumMatch = s.match(/יום\s*(\d+)/);
  if (dayNumMatch && tripStartDate) {
    const dayIndex = parseInt(dayNumMatch[1], 10);
    if (dayIndex >= 1) {
      const [y, m, d] = tripStartDate.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() + (dayIndex - 1));
      return dt.toISOString().split("T")[0];
    }
  }

  // 5. Hebrew letter: "יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳"
  const hebrewDayLetterOrder: Record<string, number> = {
    "א": 0, "א׳": 0, "א'": 0,
    "ב": 1, "ב׳": 1, "ב'": 1,
    "ג": 2, "ג׳": 2, "ג'": 2,
    "ד": 3, "ד׳": 3, "ד'": 3,
    "ה": 4, "ה׳": 4, "ה'": 4,
    "ו": 5, "ו׳": 5, "ו'": 5,
  };

  for (const [letter, dayIdx] of Object.entries(hebrewDayLetterOrder)) {
    if (s.includes(`יום ${letter}`) || s === letter) {
      if (tripStartDate) {
        const [y, m, d] = tripStartDate.split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCDate(dt.getUTCDate() + dayIdx);
        return dt.toISOString().split("T")[0];
      }
      break;
    }
  }

  return lastDate || tripStartDate || "";
}

function parseTime(timeStr: string): { fromTime: string; toTime: string } {
  const s = String(timeStr ?? "").trim();
  const rangeMatch = s.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (rangeMatch) {
    return {
      fromTime: rangeMatch[1].padStart(5, "0"),
      toTime: rangeMatch[2].padStart(5, "0"),
    };
  }
  const singleMatch = s.match(/(\d{1,2}:\d{2})/);
  if (singleMatch) {
    return {
      fromTime: singleMatch[1].padStart(5, "0"),
      toTime: "",
    };
  }
  return { fromTime: "", toTime: "" };
}

function convertDaletRowsToBet(
  daletRows: ItineraryRow[],
  tripStartDate?: string,
  autoFillEndTime: boolean = false
): ScheduleRow[] {
  let lastDate = "";
  const valid = daletRows.filter(
    (r) => r.day?.trim() || r.time?.trim() || r.activity?.trim() || r.notes?.trim()
  );

  const mapped: ScheduleRow[] = valid.map((r) => {
    const parsedDate = parseDateFromDay(r.day, tripStartDate, lastDate);
    if (parsedDate) {
      lastDate = parsedDate;
    }
    const { fromTime, toTime } = parseTime(r.time);
    return {
      id: crypto.randomUUID(),
      date: parsedDate,
      fromTime,
      toTime,
      activity: r.activity?.trim() ?? "",
      notes: r.notes?.trim() ?? "",
    };
  });

  if (autoFillEndTime) {
    for (let i = 0; i < mapped.length - 1; i++) {
      if (
        !mapped[i].toTime &&
        mapped[i].fromTime &&
        mapped[i + 1].fromTime &&
        mapped[i].date === mapped[i + 1].date &&
        mapped[i + 1].fromTime > mapped[i].fromTime
      ) {
        mapped[i].toTime = mapped[i + 1].fromTime;
      }
    }
  }

  return mapped;
}

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
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leaderSigRef = useRef<SignatureCanvasHandle>(null);

  // Leader sig — saved to appendix
  const [leaderSig, setLeaderSig] = useState<string | null>(null);
  // Remote sigs — subscribed from signatures collection
  const [coordinatorSig, setCoordinatorSig] = useState<string | null>(null);
  const [principalSig, setPrincipalSig]     = useState<string | null>(null);

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
        if (raw.leaderSig) setLeaderSig(raw.leaderSig as string);
      }
    });
    return () => unsub();
  }, [tripId]);

  // Subscribe to remote sigs so they appear in the print export
  useEffect(() => {
    const unsubC = subscribeToSignature(sigDocId(tripId, "b_coordinator"), (doc) => {
      setCoordinatorSig(doc?.status === "signed" ? (doc.signature ?? null) : null);
    });
    const unsubP = subscribeToSignature(sigDocId(tripId, "b_principal"), (doc) => {
      setPrincipalSig(doc?.status === "signed" ? (doc.signature ?? null) : null);
    });
    return () => { unsubC(); unsubP(); };
  }, [tripId]);

  function saveLeaderSig() {
    const sig = leaderSigRef.current;
    if (!sig || sig.isEmpty()) return;
    const dataUrl = sig.toDataURL();
    setLeaderSig(dataUrl);
    saveAppendix(tripId, "bet", { ...form, leaderSig: dataUrl } as unknown as Record<string, unknown>);
  }

  function clearLeaderSig() {
    leaderSigRef.current?.clear();
    setLeaderSig(null);
    saveAppendix(tripId, "bet", { ...form, leaderSig: null } as unknown as Record<string, unknown>);
  }

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

  // ─── Import from Appendix Dalet ─────────────────────────────────────────────
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [daletRows, setDaletRows] = useState<ItineraryRow[] | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [autoFillEndTime, setAutoFillEndTime] = useState(true);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const hasExistingData = form.schedule.some(
    (r) => r.date.trim() || r.fromTime.trim() || r.toTime.trim() || r.activity.trim() || r.notes.trim()
  );

  async function handleOpenImport() {
    setImportLoading(true);
    setImportDialogOpen(true);
    try {
      const raw = await getAppendix(tripId, "dalet");
      const rows = (raw?.rows as ItineraryRow[]) ?? [];
      setDaletRows(rows);
      setImportMode("replace");
    } catch {
      setDaletRows([]);
    } finally {
      setImportLoading(false);
    }
  }

  const previewRows = useMemo(() => {
    if (!daletRows) return [];
    return convertDaletRowsToBet(daletRows, trip?.startDate, autoFillEndTime);
  }, [daletRows, trip?.startDate, autoFillEndTime]);

  function handleConfirmImport() {
    if (previewRows.length === 0) return;

    let newSchedule: ScheduleRow[];
    if (importMode === "append") {
      const existingClean = form.schedule.filter(
        (r) => r.date.trim() || r.fromTime.trim() || r.toTime.trim() || r.activity.trim() || r.notes.trim()
      );
      newSchedule = existingClean.length > 0 ? [...existingClean, ...previewRows] : previewRows;
    } else {
      newSchedule = previewRows;
    }

    const updated = { ...form, schedule: newSchedule };
    setForm(updated);
    scheduleAutoSave(updated);
    setImportDialogOpen(false);
    setImportNotice(`יובאו ${previewRows.length} שורות מנספח ד׳ בהצלחה ✓`);
    setTimeout(() => setImportNotice(null), 4000);
  }

  function getHTML() {
    const classes = trip?.classes?.map((c) => c.name).join(", ") ?? "";
    const schedRows = form.schedule.map((r) => `
      <tr>
        <td>${esc(r.date)}</td>
        <td style="text-align:center">${esc(r.fromTime)}</td>
        <td style="text-align:center">${esc(r.toTime)}</td>
        <td>${esc(r.activity)}</td>
        <td>${esc(r.notes)}</td>
      </tr>`).join("");
    return `
      <div class="header">
        <div class="title">נספח ב׳ — אישור תוכנית הטיול</div>
      </div>
      <div class="meta">
        <span>כיתות: <strong>${classes}</strong></span>
        <span>מקום לינה: <strong>${trip?.accommodation ?? ""}</strong></span>
        <span>הסעה: <strong>${trip?.transport ?? ""}</strong></span>
      </div>
      <div class="meta">
        <span>אחראי/ת טיול: <strong>${esc(form.leaderName)}</strong></span>
        <span>טלפון: <strong>${esc(form.leaderPhone)}</strong></span>
        <span>הורים מלווים: <strong>${esc(form.parents)}</strong></span>
        <span>נושאי נשק: <strong>${esc(form.weapons)}</strong></span>
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
      ${form.leaderNotes ? `<div class="section-title">הערות אחראי/ת טיול</div><p style="font-size:10px;line-height:1.6">${esc(form.leaderNotes)}</p>` : ""}
      ${form.principalNotes ? `<div class="section-title">הערות מנהל/ת</div><p style="font-size:10px;line-height:1.6">${esc(form.principalNotes)}</p>` : ""}
      <div class="section-title">חתימות</div>
      <table style="margin-top:8px">
        <tr>
          <th>מורה אחראי/ת</th><th>רכז/ת טיולים</th><th>מנהל/ת ביה"ס</th>
        </tr>
        <tr>
          <td style="height:70px;text-align:center;vertical-align:middle">
            ${safeSigUrl(leaderSig) ? `<img src="${safeSigUrl(leaderSig)}" style="max-height:60px;max-width:100%;object-fit:contain">` : ""}
          </td>
          <td style="text-align:center;vertical-align:middle">
            ${safeSigUrl(coordinatorSig) ? `<img src="${safeSigUrl(coordinatorSig)}" style="max-height:60px;max-width:100%;object-fit:contain">` : ""}
          </td>
          <td style="text-align:center;vertical-align:middle">
            ${safeSigUrl(principalSig) ? `<img src="${safeSigUrl(principalSig)}" style="max-height:60px;max-width:100%;object-fit:contain">` : ""}
          </td>
        </tr>
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
            {'ימולא ע"י האחראי/ת על הטיול ויועבר לאישור מנהל/ת ביה"ס ורכז/ת הטיולים'}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">מסלול הטיול — לוח זמנים ופירוט פעילויות</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              לוח הזמנים של הפעילויות לאורך ימי הטיול
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenImport}
            className="text-xs h-8 text-primary border-primary/30 hover:bg-primary/5 hover:border-primary gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            ייבוא מנספח ד׳ (לו״ז)
          </Button>
        </div>

        {importNotice && (
          <div className="flex items-center gap-2 p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-[var(--radius-sm)] text-xs mb-3">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{importNotice}</span>
          </div>
        )}
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
          <Label>{'הערות מנהל/ת ביה"ס'}</Label>
          <textarea
            value={form.principalNotes}
            onChange={(e) => setField("principalNotes", e.target.value)}
            rows={3}
            placeholder="הערות מנהל/ת..."
            className="w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2 focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground/50 transition-colors"
          />
        </div>
      </div>

      <AppendixActions title="נספח ב׳ — אישור תוכנית הטיול" getHTML={getHTML} />

      {/* Signatures */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-5">
        <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">חתימות</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          {/* Leader — local canvas */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">מורה אחראי/ת</p>
            {leaderSig ? (
              <div className="space-y-2">
                <img src={leaderSig} alt="חתימה" className="w-full h-[90px] object-contain border border-border rounded bg-white p-1" />
                <button onClick={clearLeaderSig} className="text-xs text-destructive hover:text-destructive/80 transition-colors">מחק חתימה</button>
              </div>
            ) : (
              <div className="space-y-2">
                <SignatureCanvas ref={leaderSigRef} onEnd={saveLeaderSig} />
                <button onClick={() => leaderSigRef.current?.clear()} className="text-xs text-muted-foreground hover:text-foreground transition-colors">נקה</button>
              </div>
            )}
          </div>

          {/* Coordinator — remote */}
          <RemoteSignature
            tripId={tripId}
            role="b_coordinator"
            roleName="רכז/ת טיולים"
            label="רכז/ת טיולים"
            tripName={trip?.name ?? ""}
            schoolName={trip?.schoolName ?? ""}
            leaderName={form.leaderName || trip?.name || ""}
            getPreviewHTML={getHTML}
          />

          {/* Principal — remote */}
          <RemoteSignature
            tripId={tripId}
            role="b_principal"
            roleName='מנהל/ת ביה"ס'
            label='מנהל/ת ביה"ס'
            tripName={trip?.name ?? ""}
            schoolName={trip?.schoolName ?? ""}
            leaderName={form.leaderName || trip?.name || ""}
            getPreviewHTML={getHTML}
          />
        </div>
      </div>

      {/* Import from Appendix Dalet Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>ייבוא לוח זמנים מנספח ד׳</DialogTitle>
            <DialogDescription>
              ייבוא הפעילויות ולוח הזמנים שהוגדרו בנספח ד׳ (לוח זמנים) אל טבלת מסלול הטיול.
            </DialogDescription>
          </DialogHeader>

          {importLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              טוען נתונים מנספח ד׳...
            </div>
          ) : previewRows.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center border border-amber-200">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">לא נמצאו שורות פעילות בנספח ד׳</p>
                <p className="text-xs text-muted-foreground">
                  כדי לייבא לוח זמנים, יש למלא תחילה את הפעילויות בנספח ד׳ (לוח זמנים).
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <Link href={`/trips/${tripId}/appendix/dalet`}>
                  <Button variant="default" size="sm" className="text-xs gap-1.5 cursor-pointer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    מעבר לנספח ד׳
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(false)} className="text-xs cursor-pointer">
                  סגור
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto py-1">
              {/* Options & Settings */}
              <div className="bg-muted/40 p-3.5 rounded-[var(--radius-sm)] border border-border space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    נמצאו <strong className="text-foreground font-semibold">{previewRows.length}</strong> פעילויות לייבוא
                  </span>
                  <Link
                    href={`/trips/${tripId}/appendix/dalet`}
                    target="_blank"
                    className="text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>פתיחת נספח ד׳ בלשונית חדשה</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {hasExistingData && (
                  <div className="pt-2.5 border-t border-border">
                    <span className="font-medium text-foreground block mb-1.5">אופן הייבוא:</span>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === "replace"}
                          onChange={() => setImportMode("replace")}
                          className="text-primary focus:ring-primary"
                        />
                        <span>החלף את הטבלה הקיימת ({form.schedule.length} שורות)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          value="append"
                          checked={importMode === "append"}
                          onChange={() => setImportMode("append")}
                          className="text-primary focus:ring-primary"
                        />
                        <span>הוסף לשורות הקיימות</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="pt-2.5 border-t border-border">
                  <label className="flex items-center gap-2 cursor-pointer text-foreground select-none">
                    <input
                      type="checkbox"
                      checked={autoFillEndTime}
                      onChange={(e) => setAutoFillEndTime(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>השלם שעת סיום (&quot;עד שעה&quot;) לפי תחילת הפעילות הבאה באותו יום</span>
                  </label>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-border rounded-[var(--radius-sm)] overflow-hidden">
                <div className="bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
                  תצוגה מקדימה של השורות לייבוא ({previewRows.length} שורות):
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground sticky top-0">
                      <tr>
                        <th className="text-right p-2 font-medium w-24">תאריך</th>
                        <th className="text-right p-2 font-medium w-16">משעה</th>
                        <th className="text-right p-2 font-medium w-16">עד שעה</th>
                        <th className="text-right p-2 font-medium">פעילות ומקום</th>
                        <th className="text-right p-2 font-medium w-28">הערות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewRows.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="p-2 font-mono whitespace-nowrap">{row.date || "—"}</td>
                          <td className="p-2 font-mono whitespace-nowrap">{row.fromTime || "—"}</td>
                          <td className="p-2 font-mono whitespace-nowrap">{row.toTime || "—"}</td>
                          <td className="p-2">{row.activity || "—"}</td>
                          <td className="p-2 text-muted-foreground">{row.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {previewRows.length > 0 && !importLoading && (
            <DialogFooter className="gap-2 sm:justify-between flex-row">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(false)}
                className="cursor-pointer"
              >
                ביטול
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                className="gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                ייבא {previewRows.length} שורות
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
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

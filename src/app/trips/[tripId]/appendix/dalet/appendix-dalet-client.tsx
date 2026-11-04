"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppendixActions, esc } from "@/components/appendix-actions";
import type { ItineraryRow, TripSchedule } from "@/lib/types";
import {
  parseDaletData,
  createSchedule,
  createEmptyItineraryRow,
  DEFAULT_SCHEDULE_NAME,
} from "@/lib/dalet";

const PRESET_NAMES = [
  "תוכנית חלופית — גשם",
  "תוכנית חלופית — עומס חום",
  "תוכנית חלופית — שיטפונות",
  "תוכנית חלופית — שבת",
];

export function AppendixDaletClient() {
  const { tripId } = useParams<{ tripId: string }>();

  // Dalet schedules state
  const [schedules, setSchedules] = useState<TripSchedule[]>([createSchedule()]);
  const [activeScheduleId, setActiveScheduleId] = useState<string>("");
  const [viewingScheduleId, setViewingScheduleId] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Dialogs state
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [cloneFromCurrent, setCloneFromCurrent] = useState(true);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending = useRef(false);

  // Subscribe to Dalet appendix
  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "dalet", (raw) => {
      if (isPending.current) return;
      const parsed = parseDaletData(raw);
      setSchedules(parsed.schedules);
      setActiveScheduleId(parsed.activeScheduleId);
      setViewingScheduleId((prev) => {
        // Keep viewing current tab if still valid, otherwise default to active
        const exists = parsed.schedules.some((s) => s.id === prev);
        return exists ? prev : parsed.activeScheduleId;
      });
    });
    return () => unsub();
  }, [tripId]);

  // Persist to Firestore: saves schedules array, activeScheduleId, and syncs rows with active schedule
  function persist(
    nextSchedules: TripSchedule[] = schedules,
    nextActiveId: string = activeScheduleId,
    delay = 1200
  ) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      const activeSched =
        nextSchedules.find((s) => s.id === nextActiveId) || nextSchedules[0];

      await saveAppendix(tripId, "dalet", {
        activeScheduleId: nextActiveId,
        schedules: nextSchedules,
        rows: activeSched.rows,
      });

      isPending.current = false;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, delay);
  }

  // Active & viewing schedule objects
  const activeSchedule =
    schedules.find((s) => s.id === activeScheduleId) || schedules[0];
  const viewingSchedule =
    schedules.find((s) => s.id === viewingScheduleId) || activeSchedule;
  const isViewingActive = viewingSchedule.id === activeSchedule.id;

  // ── Row edits on viewing schedule ──────────────────────────────────────────

  function setRow(rowId: string, field: keyof ItineraryRow, value: string) {
    const updatedSchedules = schedules.map((sched: TripSchedule) => {
      if (sched.id !== viewingSchedule.id) return sched;
      return {
        ...sched,
        rows: sched.rows.map((r: ItineraryRow) =>
          r.id === rowId ? { ...r, [field]: value } : r
        ),
      };
    });
    setSchedules(updatedSchedules);
    persist(updatedSchedules, activeScheduleId);
  }

  function addRow() {
    const updatedSchedules = schedules.map((sched: TripSchedule) => {
      if (sched.id !== viewingSchedule.id) return sched;
      return {
        ...sched,
        rows: [...sched.rows, createEmptyItineraryRow()],
      };
    });
    setSchedules(updatedSchedules);
    persist(updatedSchedules, activeScheduleId);
  }

  function removeRow(rowId: string) {
    if (viewingSchedule.rows.length <= 1) return;
    const updatedSchedules = schedules.map((sched: TripSchedule) => {
      if (sched.id !== viewingSchedule.id) return sched;
      return {
        ...sched,
        rows: sched.rows.filter((r: ItineraryRow) => r.id !== rowId),
      };
    });
    setSchedules(updatedSchedules);
    persist(updatedSchedules, activeScheduleId);
  }

  // ── Schedule Management Actions ─────────────────────────────────────────────

  function handleSetActive(targetId: string) {
    setActiveScheduleId(targetId);
    persist(schedules, targetId, 0);
  }

  function openCreateDialog() {
    setNewScheduleName(`תוכנית חלופית ${schedules.length}`);
    setCloneFromCurrent(true);
    setNewDialogOpen(true);
  }

  function handleCreateSchedule() {
    const name = newScheduleName.trim() || `תוכנית חלופית ${schedules.length}`;
    const rowsToUse = cloneFromCurrent
      ? viewingSchedule.rows.map((r: ItineraryRow) => ({ ...r, id: crypto.randomUUID() }))
      : [createEmptyItineraryRow()];

    const newSched = createSchedule(name, rowsToUse);
    const updated = [...schedules, newSched];

    setSchedules(updated);
    setViewingScheduleId(newSched.id);
    setNewDialogOpen(false);
    persist(updated, activeScheduleId, 0);
  }

  function handleDuplicateSchedule(target: TripSchedule) {
    const clonedRows = target.rows.map((r: ItineraryRow) => ({ ...r, id: crypto.randomUUID() }));
    const newSched = createSchedule(`${target.name} (שכפול)`, clonedRows);
    const updated = [...schedules, newSched];

    setSchedules(updated);
    setViewingScheduleId(newSched.id);
    persist(updated, activeScheduleId, 0);
  }

  function openRenameDialog(target: TripSchedule) {
    setRenamingId(target.id);
    setRenamingName(target.name);
    setRenameDialogOpen(true);
  }

  function handleConfirmRename() {
    if (!renamingId) return;
    const trimmed = renamingName.trim() || DEFAULT_SCHEDULE_NAME;
    const updated = schedules.map((s) =>
      s.id === renamingId ? { ...s, name: trimmed } : s
    );
    setSchedules(updated);
    setRenameDialogOpen(false);
    persist(updated, activeScheduleId, 0);
  }

  function handleDeleteSchedule(target: TripSchedule) {
    if (schedules.length <= 1) {
      alert("לא ניתן למחוק את לוח הזמנים היחיד.");
      return;
    }

    if (!confirm(`האם למחוק את לוח הזמנים "${target.name}"?`)) return;

    const remaining = schedules.filter((s) => s.id !== target.id);
    let nextActiveId = activeScheduleId;

    // If deleting the active schedule, activate the first remaining
    if (target.id === activeScheduleId) {
      nextActiveId = remaining[0].id;
      setActiveScheduleId(nextActiveId);
    }

    // If deleting currently viewed schedule, switch view to active
    if (target.id === viewingScheduleId) {
      setViewingScheduleId(nextActiveId);
    }

    setSchedules(remaining);
    persist(remaining, nextActiveId, 0);
  }

  // ── HTML Print Builder ──────────────────────────────────────────────────────

  function getHTML() {
    function buildTableHTML(title: string, subtitle: string, rows: ItineraryRow[], isActiveBadge = false) {
      const tableRows = rows
        .map(
          (r) => `
        <tr>
          <td>${esc(r.day)}</td>
          <td style="text-align:center">${esc(r.time)}</td>
          <td>${esc(r.activity)}</td>
          <td>${esc(r.notes)}</td>
        </tr>`
        )
        .join("");

      return `
        <div style="margin-bottom: 24px; break-inside: avoid;">
          <div class="header">
            <div class="title">${esc(title)} ${isActiveBadge ? `<span style="font-size:12px; background:#d1fae5; color:#065f46; border:1px solid #a7f3d0; padding:2px 8px; border-radius:12px; margin-right:8px;">לוח זמנים פעיל</span>` : ""}</div>
            <div class="ministry">${esc(subtitle)}</div>
          </div>
          <table>
            <thead><tr>
              <th style="width:100px">יום הטיול</th>
              <th style="width:70px">שעה</th>
              <th>הפעולה והמקום</th>
              <th style="width:130px">הערות</th>
            </tr></thead>
            <tbody>${tableRows || `<tr><td colspan="4" style="text-align:center; color:#888;">אין פעילויות מוגדרות</td></tr>`}</tbody>
          </table>
        </div>
      `;
    }

    // 1. Primary Active Schedule
    const activeSection = buildTableHTML(
      `נספח ד׳ — תוכנית הטיול — ${activeSchedule.name}`,
      "לוח הזמנים הראשי והפעיל של הטיול",
      activeSchedule.rows,
      true
    );

    // 2. Alternative Contingency Schedules (if any exist)
    const alternatives = schedules.filter((s) => s.id !== activeSchedule.id);
    const alternativeSections =
      alternatives.length > 0
        ? `
          <div style="margin-top: 36px; border-top: 2px dashed #cbd5e1; padding-top: 24px; break-before: page;">
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #1e293b;">
              תוכניות חלופיות למזג אוויר ואירועים חריגים (${alternatives.length})
            </div>
            ${alternatives
              .map((alt) =>
                buildTableHTML(
                  `תוכנית חלופית: ${alt.name}`,
                  "תוכנית מגירה לשינוי תנאי שטח או מזג אוויר",
                  alt.rows,
                  false
                )
              )
              .join("")}
          </div>
        `
        : "";

    return `${activeSection}${alternativeSections}`;
  }

  return (
    <div className="max-w-4xl space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            נספח ד׳ — תוכנית הטיול — לוח זמנים
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ניהול לוח זמנים פעיל ותוכניות חלופיות למקרה של שינויי מזג אוויר ואירועים חריגים
          </p>
        </div>
        <span
          className={`text-xs flex-shrink-0 ${
            status === "saved" ? "text-green-600 font-medium" : "text-muted-foreground"
          }`}
        >
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {/* Schedules Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border">
        {schedules.map((sched) => {
          const isSelected = sched.id === viewingSchedule.id;
          const isActive = sched.id === activeScheduleId;

          return (
            <button
              key={sched.id}
              type="button"
              onClick={() => setViewingScheduleId(sched.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-t-[var(--radius-sm)] text-xs sm:text-sm font-medium border-t border-x transition-colors whitespace-nowrap cursor-pointer ${
                isSelected
                  ? "bg-white border-border text-foreground border-b-2 border-b-primary shadow-xs -mb-[1px]"
                  : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{sched.name}</span>
              {isActive && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-emerald-200">
                  פעיל ✓
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={openCreateDialog}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary hover:text-primary/80 font-medium border border-dashed border-primary/40 hover:border-primary rounded-[var(--radius-sm)] transition-colors whitespace-nowrap cursor-pointer mr-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>לוח זמנים חלופי</span>
        </button>
      </div>

      {/* Active State & Schedule Controls Banner */}
      <div
        className={`rounded-[var(--radius)] border p-4 flex flex-wrap items-center justify-between gap-3 ${
          isViewingActive
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
            : "bg-amber-50/70 border-amber-200 text-amber-950"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              isViewingActive
                ? "bg-emerald-600 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {isViewingActive ? "✓" : "!"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{viewingSchedule.name}</span>
              {isViewingActive ? (
                <span className="bg-emerald-200/80 text-emerald-900 text-[11px] font-medium px-2 py-0.5 rounded-full">
                  מוגדר כפעיל
                </span>
              ) : (
                <span className="bg-amber-200/80 text-amber-900 text-[11px] font-medium px-2 py-0.5 rounded-full">
                  תוכנית חלופית (לא פעיל)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isViewingActive
                ? "לוח זמנים זה מוגדר כפעיל — אישור מנהל (נספח ב׳), הדפסת תיק טיול וסוכן הבינה המלאכותית נסמכים עליו."
                : "זהו לוח זמנים חלופי. שאר המערכת נסמכת כרגע על הלוח הפעיל."}
            </p>
          </div>
        </div>

        {/* Schedule Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isViewingActive && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleSetActive(viewingSchedule.id)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 cursor-pointer font-medium shadow-xs"
            >
              <span>⚡ הגדר כלוח זמנים פעיל</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDuplicateSchedule(viewingSchedule)}
            className="text-xs gap-1 bg-white cursor-pointer"
            title="שכפל לוח זמנים זה לתוכנית חלופית חדשה"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            <span>שכפל</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openRenameDialog(viewingSchedule)}
            className="text-xs gap-1 bg-white cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>שנה שם</span>
          </Button>

          {schedules.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDeleteSchedule(viewingSchedule)}
              className="text-xs gap-1 bg-white text-destructive hover:text-destructive cursor-pointer"
              title="מחק לוח זמנים זה"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>מחק</span>
            </Button>
          )}
        </div>
      </div>

      {/* Rows Table */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-32">יום הטיול</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">שעה</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">הפעולה והמקום</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-40">הערות</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {viewingSchedule.rows.map((row: ItineraryRow) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.day}
                      onChange={(e) => setRow(row.id, "day", e.target.value)}
                      placeholder="יום א׳ / 15.5"
                      className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="time"
                      value={row.time}
                      onChange={(e) => setRow(row.id, "time", e.target.value)}
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
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={viewingSchedule.rows.length <= 1}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors cursor-pointer"
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
        <Button variant="ghost" size="sm" onClick={addRow} className="mt-3 text-primary cursor-pointer" type="button">
          <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          הוסף שורה
        </Button>
      </div>

      <AppendixActions title="נספח ד׳ — תוכנית הטיול — לוח זמנים" getHTML={getHTML} />

      {/* Dialog: Create Alternative Schedule */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת לוח זמנים חלופי</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sched-name">שם לוח הזמנים</Label>
              <Input
                id="sched-name"
                value={newScheduleName}
                onChange={(e) => setNewScheduleName(e.target.value)}
                placeholder="למשל: תוכנית חלופית — גשם"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_NAMES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNewScheduleName(preset)}
                    className="text-[11px] px-2 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <input
                type="checkbox"
                id="clone-current"
                checked={cloneFromCurrent}
                onChange={(e) => setCloneFromCurrent(e.target.checked)}
                className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
              />
              <Label htmlFor="clone-current" className="text-xs cursor-pointer">
                העתק שורות מתוך &quot;{viewingSchedule.name}&quot; (מומלץ)
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleCreateSchedule} disabled={!newScheduleName.trim()}>
              צור לוח זמנים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rename Schedule */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>שינוי שם לוח זמנים</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rename-name">שם חדש</Label>
            <Input
              id="rename-name"
              value={renamingName}
              onChange={(e) => setRenamingName(e.target.value)}
              placeholder="שם לוח הזמנים"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleConfirmRename} disabled={!renamingName.trim()}>
              שמור שם
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

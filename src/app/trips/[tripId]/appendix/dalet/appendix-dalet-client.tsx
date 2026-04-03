"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { Button } from "@/components/ui/button";
import { AppendixActions, esc } from "@/components/appendix-actions";

type ItineraryRow = {
  id: string;
  day: string;
  time: string;
  activity: string;
  notes: string;
};

const EMPTY_ROW = (): ItineraryRow => ({
  id: crypto.randomUUID(),
  day: "",
  time: "",
  activity: "",
  notes: "",
});

export function AppendixDaletClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const [rows, setRows] = useState<ItineraryRow[]>([EMPTY_ROW()]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "dalet", (raw) => {
      if (raw?.rows) setRows(raw.rows as ItineraryRow[]);
    });
    return () => unsub();
  }, [tripId]);

  function scheduleAutoSave(updated: ItineraryRow[]) {
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "dalet", { rows: updated });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function setRow(id: string, field: keyof ItineraryRow, value: string) {
    const updated = rows.map((r) => r.id === id ? { ...r, [field]: value } : r);
    setRows(updated);
    scheduleAutoSave(updated);
  }

  function getHTML() {
    const tableRows = rows.map((r) => `
      <tr>
        <td>${esc(r.day)}</td>
        <td style="text-align:center">${esc(r.time)}</td>
        <td>${esc(r.activity)}</td>
        <td>${esc(r.notes)}</td>
      </tr>`).join("");
    return `
      <div class="header">
        <div class="title">נספח ד׳ — תוכנית הטיול — לוח זמנים</div>
        <div class="ministry">פירוט ימי ושעות הפעילות</div>
      </div>
      <table>
        <thead><tr>
          <th style="width:100px">יום הטיול</th>
          <th style="width:70px">שעה</th>
          <th>הפעולה והמקום</th>
          <th style="width:130px">הערות</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
  }

  function addRow() {
    const updated = [...rows, EMPTY_ROW()];
    setRows(updated);
    scheduleAutoSave(updated);
  }

  function removeRow(id: string) {
    if (rows.length <= 1) return;
    const updated = rows.filter((r) => r.id !== id);
    setRows(updated);
    scheduleAutoSave(updated);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ד׳ — תוכנית הטיול — לוח זמנים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">פירוט ימי ושעות הפעילות</p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

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
              {rows.map((row) => (
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
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length <= 1}
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
        <Button variant="ghost" size="sm" onClick={addRow} className="mt-3 text-primary" type="button">
          <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          הוסף שורה
        </Button>
      </div>
      <AppendixActions title="נספח ד׳ — תוכנית הטיול — לוח זמנים" filename="נספח-ד" getHTML={getHTML} />
    </div>
  );
}

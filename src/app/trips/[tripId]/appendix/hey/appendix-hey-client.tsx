"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { Button } from "@/components/ui/button";
import { AppendixActions } from "@/components/appendix-actions";

type ContactRow = {
  id: string;
  role: string;
  name: string;
  phone: string;
  notes: string;
};

const SEED_ROWS: Omit<ContactRow, "id">[] = [
  { role: "משטרה", name: "", phone: "100", notes: "" },
  { role: 'מד"א', name: "", phone: "101", notes: "" },
  { role: "כיבוי אש", name: "", phone: "102", notes: "" },
  { role: "מרכז רעלים", name: "", phone: "04-7771900", notes: "" },
  { role: "חדר מצב ארצי", name: "", phone: "02-6222211", notes: "" },
  { role: "מוקד עירוני", name: "", phone: "106", notes: "" },
  { role: "אחראי/ת הטיול", name: "", phone: "", notes: "" },
  { role: 'מנהל/ת בי"ס', name: "", phone: "", notes: "" },
  { role: "רכז/ת שכבה", name: "", phone: "", notes: "" },
  { role: "נהג אוטובוס 1", name: "", phone: "", notes: "" },
  { role: "מדריך/ה", name: "", phone: "", notes: "" },
  { role: "מאבטח", name: "", phone: "", notes: "" },
];

function makeRow(seed?: Omit<ContactRow, "id">): ContactRow {
  return { id: crypto.randomUUID(), role: "", name: "", phone: "", notes: "", ...seed };
}

const DEFAULT_ROWS = () => SEED_ROWS.map(makeRow);

export function AppendixHeyClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const [rows, setRows] = useState<ContactRow[]>(DEFAULT_ROWS());
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "hey", (raw) => {
      if (raw?.rows) setRows(raw.rows as ContactRow[]);
    });
    return () => unsub();
  }, [tripId]);

  function scheduleAutoSave(updated: ContactRow[]) {
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "hey", { rows: updated });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function setCell(id: string, field: keyof ContactRow, value: string) {
    const updated = rows.map((r) => r.id === id ? { ...r, [field]: value } : r);
    setRows(updated);
    scheduleAutoSave(updated);
  }

  function addRow() {
    const updated = [...rows, makeRow()];
    setRows(updated);
    scheduleAutoSave(updated);
  }

  function removeRow(id: string) {
    if (rows.length <= 1) return;
    const updated = rows.filter((r) => r.id !== id);
    setRows(updated);
    scheduleAutoSave(updated);
  }

  function getHTML() {
    const tableRows = rows.map((r) => `
      <tr>
        <td>${r.role}</td>
        <td>${r.name}</td>
        <td style="text-align:center;direction:ltr">${r.phone}</td>
        <td>${r.notes}</td>
      </tr>`).join("");
    return `
      <div class="header">
        <div class="title">נספח ה׳ — טלפונים חיוניים בטיול</div>
        <div class="ministry">רשימת גורמי קשר לשעת חירום ולתיאום שוטף</div>
      </div>
      <table>
        <thead><tr>
          <th style="width:140px">תפקיד</th>
          <th style="width:130px">שם</th>
          <th style="width:100px">טלפון</th>
          <th>הערות</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="footer">יש לשמור עותק של טופס זה אצל כל מלווה בטיול</div>
    `;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ה׳ — טלפונים חיוניים בטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">רשימת גורמי קשר לשעת חירום ולתיאום שוטף</p>
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
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-36">תפקיד</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-32">שם</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">טלפון</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">הערות</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.role}
                      onChange={(e) => setCell(row.id, "role", e.target.value)}
                      placeholder="תפקיד..."
                      className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => setCell(row.id, "name", e.target.value)}
                      placeholder="שם מלא..."
                      className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="tel"
                      value={row.phone}
                      onChange={(e) => setCell(row.id, "phone", e.target.value)}
                      placeholder="050-0000000"
                      dir="ltr"
                      className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50 text-left"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => setCell(row.id, "notes", e.target.value)}
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

      <AppendixActions title="נספח ה׳ — טלפונים חיוניים בטיול" filename="נספח-ה" getHTML={getHTML} />
    </div>
  );
}

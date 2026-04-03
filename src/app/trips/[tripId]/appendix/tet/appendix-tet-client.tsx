"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { useTrip } from "@/hooks/use-trip";
import { AppendixActions } from "@/components/appendix-actions";
import { Button } from "@/components/ui/button";

type Item = { id: string; text: string };

const DEFAULTS: string[] = [
  "כובע",
  "3 ליטרים מים לפחות",
  "נעלי הליכה סגורות",
  "תיק גב עם כתפיות",
  "מכנסיים ארוכים",
  "חולצה עם שרוולים",
  "קרם הגנה",
  "ארוחת צהריים ומזון לדרך",
  "כסף קטן",
];

function makeItem(text = ""): Item {
  return { id: crypto.randomUUID(), text };
}

export function AppendixTetClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip } = useTrip(tripId);
  const [items, setItems]   = useState<Item[]>(DEFAULTS.map((t) => makeItem(t)));
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "tet", (raw) => {
      if (raw?.items) setItems(raw.items as Item[]);
    });
    return () => unsub();
  }, [tripId]);

  function scheduleAutoSave(updated: Item[]) {
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "tet", { items: updated });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function setItemText(id: string, text: string) {
    const updated = items.map((it) => it.id === id ? { ...it, text } : it);
    setItems(updated);
    scheduleAutoSave(updated);
  }

  function addItem() {
    const updated = [...items, makeItem()];
    setItems(updated);
    scheduleAutoSave(updated);
    // focus new input after render
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>("[data-tet-input]");
      inputs[inputs.length - 1]?.focus();
    }, 50);
  }

  function removeItem(id: string) {
    if (items.length <= 1) return;
    const updated = items.filter((it) => it.id !== id);
    setItems(updated);
    scheduleAutoSave(updated);
  }

  function getHTML() {
    const rows = items
      .filter((it) => it.text.trim())
      .map((it, i) => `
        <tr style="${i % 2 === 0 ? "" : "background:#f0f7f4"}">
          <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px;text-align:center;width:36px">${i + 1}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px">${it.text}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;width:50px;text-align:center"></td>
        </tr>`)
      .join("");

    return `
      <div class="header">
        <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
        <div class="title">נספח ט׳ — ציוד חובה לטיול</div>
        ${trip ? `<div class="ministry">${trip.name ?? ""} | ${trip.schoolName ?? ""}</div>` : ""}
      </div>
      <table>
        <thead><tr>
          <th style="width:36px;text-align:center">מס׳</th>
          <th style="text-align:right">פריט ציוד</th>
          <th style="width:50px;text-align:center">✓</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ט׳ — ציוד חובה לטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">רשימת הציוד שעל כל תלמיד/ה להביא</p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {/* List */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] divide-y divide-border">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors group">
            {/* Index */}
            <span className="text-xs text-muted-foreground/60 w-5 text-center shrink-0">{i + 1}</span>

            {/* Text input */}
            <input
              data-tet-input
              type="text"
              value={item.text}
              onChange={(e) => setItemText(item.id, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="פריט ציוד..."
              className="flex-1 text-sm bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5 transition-colors placeholder:text-muted-foreground/40"
            />

            {/* Remove */}
            <button
              onClick={() => removeItem(item.id)}
              disabled={items.length <= 1}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive disabled:opacity-20 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={addItem} className="text-primary" type="button">
        <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        הוסף פריט
      </Button>

      <AppendixActions title="נספח ט׳ — ציוד חובה לטיול" filename="נספח-ט" getHTML={getHTML} />
    </div>
  );
}

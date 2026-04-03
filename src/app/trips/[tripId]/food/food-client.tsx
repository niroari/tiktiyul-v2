"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { useStudents } from "@/hooks/use-students";
import { useTrip } from "@/hooks/use-trip";
import { AppendixActions } from "@/components/appendix-actions";

const FLAG_LABELS: Record<string, string> = {
  vegetarian: "צמחוני",
  vegan:      "טבעוני",
  glutenFree: "ללא גלוטן",
};

const FLAG_COLORS: Record<string, string> = {
  vegetarian: "bg-green-100 text-green-700 border-green-200",
  vegan:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  glutenFree: "bg-amber-100 text-amber-700 border-amber-200",
};

export function FoodClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { students } = useStudents(tripId);
  const { trip }    = useTrip(tripId);

  // notes[studentId] = free-text note (stored in Firestore)
  const [notes, setNotes]   = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showAll, setShowAll] = useState(false);

  const saveTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending  = useRef(false);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "food", (raw) => {
      if (isPending.current) return;
      if (raw?.notes) setNotes(raw.notes as Record<string, string>);
    });
    return () => unsub();
  }, [tripId]);

  function scheduleAutoSave(updated: Record<string, string>) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "food", { notes: updated });
      isPending.current = false;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function setNote(studentId: string, val: string) {
    const updated = { ...notes, [studentId]: val };
    setNotes(updated);
    scheduleAutoSave(updated);
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const going = students
    .filter((s) => s.isGoing)
    .sort((a, b) => {
      const c = a.class.localeCompare(b.class, "he");
      return c !== 0 ? c : a.lastName.localeCompare(b.lastName, "he");
    });

  function hasRestriction(s: typeof going[0]) {
    return (
      s.dietaryFlags?.vegetarian ||
      s.dietaryFlags?.vegan      ||
      s.dietaryFlags?.glutenFree ||
      !!(notes[s.id]?.trim())
    );
  }

  const displayed = showAll ? going : going.filter(hasRestriction);

  const vegetarianCount = going.filter((s) => s.dietaryFlags?.vegetarian).length;
  const veganCount      = going.filter((s) => s.dietaryFlags?.vegan).length;
  const glutenCount     = going.filter((s) => s.dietaryFlags?.glutenFree).length;
  const notesCount      = going.filter((s) => notes[s.id]?.trim()).length;

  // ── Print ─────────────────────────────────────────────────────────────────────

  function getHTML() {
    const restricted = going.filter(hasRestriction);

    const tableRows = restricted.map((s, i) => {
      const flags = (["vegetarian", "vegan", "glutenFree"] as const)
        .filter((f) => s.dietaryFlags?.[f])
        .map((f) => FLAG_LABELS[f])
        .join(", ");
      const note = notes[s.id]?.trim() ?? "";

      return `
        <tr style="${i % 2 === 0 ? "" : "background:#f0f7f4"}">
          <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px;text-align:center">${i + 1}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px">${s.lastName} ${s.firstName}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px;text-align:center">${s.class}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px">${flags}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px">${note}</td>
        </tr>`;
    }).join("");

    const summaryItems = [
      `צמחוני: ${vegetarianCount}`,
      `טבעוני: ${veganCount}`,
      `ללא גלוטן: ${glutenCount}`,
    ].join("&nbsp;&nbsp;|&nbsp;&nbsp;");

    return `
      <div class="header">
        <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
        <div class="title">העדפות מזון — תלמידים עם הגבלות תזונתיות</div>
        ${trip ? `<div class="ministry">${trip.name ?? ""} | ${trip.schoolName ?? ""}</div>` : ""}
      </div>
      <p style="font-size:10px;text-align:center;margin:6px 0 12px;color:#555">${summaryItems}</p>
      <table>
        <thead><tr>
          <th style="width:28px;text-align:center">מס׳</th>
          <th>שם התלמיד/ה</th>
          <th style="width:55px;text-align:center">כיתה</th>
          <th>סוג תזונה</th>
          <th>הערות נוספות</th>
        </tr></thead>
        <tbody>${tableRows || `<tr><td colspan="5" style="padding:12px;text-align:center;color:#aaa;font-size:10px">אין תלמידים עם הגבלות תזונתיות</td></tr>`}</tbody>
      </table>
    `;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">העדפות מזון</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            תלמידים עם הגבלות תזונתיות ומידע למטבח
          </p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "צמחוני",    count: vegetarianCount, color: "border-green-200 bg-green-50",   text: "text-green-700" },
          { label: "טבעוני",    count: veganCount,      color: "border-emerald-200 bg-emerald-50", text: "text-emerald-700" },
          { label: "ללא גלוטן", count: glutenCount,     color: "border-amber-200 bg-amber-50",   text: "text-amber-700" },
          { label: "הערות",     count: notesCount,      color: "border-blue-200 bg-blue-50",     text: "text-blue-700" },
        ].map((card) => (
          <div key={card.label} className={`rounded-[var(--radius)] border ${card.color} px-4 py-3`}>
            <div className={`text-2xl font-bold ${card.text}`}>{card.count}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Toggle filter */}
      {going.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAll(false)}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              !showAll
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            רק עם הגבלות ({going.filter(hasRestriction).length})
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              showAll
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            כל התלמידים ({going.length})
          </button>
        </div>
      )}

      {/* Empty states */}
      {students.length === 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center">
          <p className="text-muted-foreground text-sm">ייבא רשימת תלמידים כדי לראות העדפות מזון</p>
        </div>
      )}

      {students.length > 0 && displayed.length === 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center">
          <p className="text-muted-foreground text-sm">אין תלמידים עם הגבלות תזונתיות</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            סמן/י הגבלות בעמוד רשימת התלמידים או הצג את כל התלמידים להוספת הערות
          </p>
        </div>
      )}

      {/* Table */}
      {displayed.length > 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-8">#</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">שם התלמיד/ה</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-16">כיתה</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">הגבלות</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">הערות נוספות</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((s, i) => {
                  const activeFlags = (["vegetarian", "vegan", "glutenFree"] as const).filter(
                    (f) => s.dietaryFlags?.[f]
                  );
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                    >
                      <td className="px-4 py-2 text-muted-foreground text-xs text-center">{i + 1}</td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap">
                        {s.lastName} {s.firstName}
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{s.class}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {activeFlags.length === 0 ? (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          ) : (
                            activeFlags.map((f) => (
                              <span
                                key={f}
                                className={`text-xs px-2 py-0.5 rounded-full border ${FLAG_COLORS[f]}`}
                              >
                                {FLAG_LABELS[f]}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={notes[s.id] ?? ""}
                          onChange={(e) => setNote(s.id, e.target.value)}
                          placeholder="הערה..."
                          className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/40 min-w-[160px]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AppendixActions title="העדפות מזון" filename="העדפות-מזון" getHTML={getHTML} />
    </div>
  );
}

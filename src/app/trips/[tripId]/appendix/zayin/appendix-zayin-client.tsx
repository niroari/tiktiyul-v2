"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useStudents } from "@/hooks/use-students";
import { useTrip } from "@/hooks/use-trip";
import { updateStudent } from "@/lib/firestore/students";
import { printHTML } from "@/components/appendix-actions";
import { Button } from "@/components/ui/button";
import type { Student } from "@/lib/types";

type SortField = "class" | "lastName" | "firstName";

function sortStudents(students: Student[], field: SortField): Student[] {
  return [...students].sort((a, b) => {
    if (field === "class") {
      const c = a.class.localeCompare(b.class, "he");
      return c !== 0 ? c : a.lastName.localeCompare(b.lastName, "he");
    }
    if (field === "lastName")  return a.lastName.localeCompare(b.lastName, "he");
    if (field === "firstName") return a.firstName.localeCompare(b.firstName, "he");
    return 0;
  });
}

export function AppendixZayinClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { students, loading } = useStudents(tripId);
  const { trip } = useTrip(tripId);

  const [sortField, setSortField]       = useState<SortField>("class");
  const [classFilter, setClassFilter]   = useState("");
  const [showNotGoing, setShowNotGoing] = useState(false);

  // Derived
  const classes = [...new Set(students.map((s) => s.class))].sort((a, b) => a.localeCompare(b, "he"));
  const sorted  = sortStudents(students, sortField);
  const visible = sorted.filter((s) => {
    if (classFilter && s.class !== classFilter) return false;
    if (!showNotGoing && !s.isGoing) return false;
    return true;
  });

  const goingCount    = (classFilter ? students.filter((s) => s.class === classFilter) : students).filter((s) => s.isGoing).length;
  const notGoingCount = students.filter((s) => !s.isGoing).length;
  const pool          = classFilter ? students.filter((s) => s.class === classFilter) : students;

  async function toggleGoing(student: Student) {
    await updateStudent(tripId, student.id, { isGoing: !student.isGoing });
  }

  function getHTML(goingOnly = true) {
    const printStudents = sortStudents(
      goingOnly ? students.filter((s) => s.isGoing) : students,
      "class"
    );

    let rows = "";
    let lastClass = "";
    let rowInClass = 0;

    for (const s of printStudents) {
      if (s.class !== lastClass) {
        const count = printStudents.filter((x) => x.class === s.class).length;
        rows += `<tr class="cat-row"><td colspan="5" style="background:#1b4332;color:white;font-size:10px;font-weight:bold;padding:4px 8px">כיתה ${s.class} — ${count} תלמידים</td></tr>`;
        lastClass = s.class;
        rowInClass = 0;
      }
      const gender = s.gender === "male" ? "זכר" : s.gender === "female" ? "נקבה" : "";
      rows += `<tr style="${rowInClass % 2 === 0 ? "" : "background:#f0f7f4"}">
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px">${s.lastName}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px">${s.firstName}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;text-align:center">${s.class}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;text-align:center">${gender}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;direction:ltr">${s.phone ?? ""}</td>
      </tr>`;
      rowInClass++;
    }

    const going    = students.filter((s) => s.isGoing).length;
    const boys     = students.filter((s) => s.isGoing && s.gender === "male").length;
    const girls    = students.filter((s) => s.isGoing && s.gender === "female").length;

    return `
      <div class="header">
        <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
        <div class="title">נספח ז׳ — רשימת תלמידים${goingOnly ? " (יוצאים)" : ""}</div>
        <div class="ministry">${trip?.name ?? ""} | ${trip?.schoolName ?? ""}</div>
      </div>
      <div class="meta">
        <span>סה"כ יוצאים: <strong>${going}</strong></span>
        <span>בנים: <strong>${boys}</strong></span>
        <span>בנות: <strong>${girls}</strong></span>
      </div>
      <table>
        <thead><tr>
          <th>שם משפחה</th>
          <th>שם פרטי</th>
          <th style="width:60px;text-align:center">כיתה</th>
          <th style="width:55px;text-align:center">מין</th>
          <th style="width:90px">טלפון</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">רשימה זו מהווה 3 עותקים: אחראי הטיול / אחראי אוטובוס וכיתה / מזכירות ביה"ס</div>
    `;
  }

  if (loading) return <div className="text-sm text-muted-foreground p-4">טוען...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ז׳ — רשימת תלמידים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {goingCount} יוצאים
            {notGoingCount > 0 && ` · ${notGoingCount} לא יוצאים`}
            {classFilter && ` · סינון: כיתה ${classFilter}`}
          </p>
        </div>

        {/* Controls */}
        {students.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Class filter */}
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1.5 bg-white focus:outline-none focus:border-primary"
            >
              <option value="">כל הכיתות</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Sort */}
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1.5 bg-white focus:outline-none focus:border-primary"
            >
              <option value="class">מיון: כיתה</option>
              <option value="lastName">מיון: שם משפחה</option>
              <option value="firstName">מיון: שם פרטי</option>
            </select>

            {/* Not going toggle */}
            {notGoingCount > 0 && (
              <button
                onClick={() => setShowNotGoing((v) => !v)}
                className={`text-xs px-2.5 py-1.5 rounded-[var(--radius-sm)] border transition-colors ${showNotGoing ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {showNotGoing ? "הסתר" : "הצג"} לא יוצאים ({notGoingCount})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {students.length === 0 ? (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center">
          <p className="text-muted-foreground text-sm">טרם יובאו תלמידים</p>
          <p className="text-xs text-muted-foreground mt-1">ייבא רשימת תלמידים מדף רשימת התלמידים</p>
        </div>
      ) : (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
          {/* Summary bar */}
          <div className="flex items-center gap-6 px-5 py-2.5 bg-muted/40 border-b border-border text-xs text-muted-foreground">
            <span>מוצגים <strong className="text-foreground">{visible.length}</strong></span>
            <span>בנים <strong className="text-foreground">{pool.filter((s) => s.isGoing && s.gender === "male").length}</strong></span>
            <span>בנות <strong className="text-foreground">{pool.filter((s) => s.isGoing && s.gender === "female").length}</strong></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">שם משפחה</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">שם פרטי</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-16">כיתה</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-16">מין</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-28">טלפון</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-16">יוצא?</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s, i) => {
                  const isClassHeader = i === 0 || visible[i - 1].class !== s.class;
                  return (
                    <>
                      {isClassHeader && sortField === "class" && (
                        <tr key={`header-${s.class}`} className="bg-[var(--brand-light)]">
                          <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold text-primary">
                            כיתה {s.class} — {sorted.filter((x) => x.class === s.class && x.isGoing).length} יוצאים
                          </td>
                        </tr>
                      )}
                      <tr
                        key={s.id}
                        className={`border-b border-border last:border-0 transition-colors ${!s.isGoing ? "opacity-40" : "hover:bg-muted/20"}`}
                      >
                        <td className="px-4 py-2">{s.lastName}</td>
                        <td className="px-4 py-2">{s.firstName}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{s.class}</td>
                        <td className="px-3 py-2 text-center">
                          {s.gender === "male" ? (
                            <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">זכר</span>
                          ) : s.gender === "female" ? (
                            <span className="text-xs bg-pink-50 text-pink-700 rounded-full px-2 py-0.5">נקבה</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-xs font-mono text-muted-foreground" dir="ltr">{s.phone}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={s.isGoing}
                            onChange={() => toggleGoing(s)}
                            className="w-4 h-4 accent-[var(--brand)] cursor-pointer"
                          />
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      {students.length > 0 && (
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border flex-wrap">
          <Button variant="outline" size="sm" onClick={() => printHTML(getHTML(true), "נספח ז׳ — רשימת תלמידים יוצאים")}>
            <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            הדפס — יוצאים בלבד
          </Button>
          {notGoingCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => printHTML(getHTML(false), "נספח ז׳ — כל התלמידים")}>
              <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              הדפס — כולל לא יוצאים
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

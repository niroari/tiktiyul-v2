"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useStudents } from "@/hooks/use-students";
import { useTrip } from "@/hooks/use-trip";
import { updateStudent } from "@/lib/firestore/students";
import { printHTML, esc } from "@/components/appendix-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

  // Field sheet dialog state
  const [fieldSheetOpen, setFieldSheetOpen]         = useState(false);
  const [fsSplitByClass, setFsSplitByClass]         = useState(true);
  const [fsGoingOnly, setFsGoingOnly]               = useState(true);
  const [fsClass, setFsClass]                       = useState("");

  // Derived
  const tripDayCount = trip?.startDate && trip?.endDate
    ? Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000) + 1
    : 1;

  function dayLabel(s: Student): string {
    if (!s.participationDays?.length || s.participationDays.length >= tripDayCount) return "";
    return s.participationDays.map((d) => `יום ${d}`).join(", ");
  }

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
        const colspan = tripDayCount > 1 ? "7" : "6";
        rows += `<tr class="cat-row"><td colspan="${colspan}" style="background:#1b4332;color:white;font-size:10px;font-weight:bold;padding:4px 8px">כיתה ${esc(s.class)} — ${count} תלמידים</td></tr>`;
        lastClass = s.class;
        rowInClass = 0;
      }
      const gender  = s.gender === "male" ? "זכר" : s.gender === "female" ? "נקבה" : "";
      const days    = dayLabel(s);
      const daysCell = tripDayCount > 1
        ? `<td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;text-align:center${days ? ";color:#c2410c;font-weight:600" : ""}">${esc(days) || "—"}</td>`
        : "";
      rows += `<tr style="${rowInClass % 2 === 0 ? "" : "background:#f0f7f4"}">
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;direction:ltr;text-align:left">${esc(s.idNumber)}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px">${esc(s.lastName)}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px">${esc(s.firstName)}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;text-align:center">${esc(s.class)}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;text-align:center">${esc(gender)}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;direction:ltr">${esc(s.phone)}</td>
        ${daysCell}
      </tr>`;
      rowInClass++;
    }

    const going    = students.filter((s) => s.isGoing).length;
    const boys     = students.filter((s) => s.isGoing && s.gender === "male").length;
    const girls    = students.filter((s) => s.isGoing && s.gender === "female").length;

    return `
      <div class="header">
        <div class="ministry">משרד החינוך — מינהל חברה ונוער — של&quot;ח וידיעת הארץ</div>
        <div class="title">נספח ז׳ — רשימת תלמידים${goingOnly ? " (יוצאים)" : ""}</div>
        <div class="ministry">${esc(trip?.name)} | ${esc(trip?.schoolName)}</div>
      </div>
      <div class="meta">
        <span>סה&quot;כ יוצאים: <strong>${going}</strong></span>
        <span>בנים: <strong>${boys}</strong></span>
        <span>בנות: <strong>${girls}</strong></span>
      </div>
      <table>
        <thead><tr>
          <th style="width:80px">ת.ז</th>
          <th>שם משפחה</th>
          <th>שם פרטי</th>
          <th style="width:60px;text-align:center">כיתה</th>
          <th style="width:55px;text-align:center">מין</th>
          <th style="width:90px">טלפון</th>
          ${tripDayCount > 1 ? '<th style="width:60px;text-align:center">ימים</th>' : ""}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">רשימה זו מהווה 3 עותקים: אחראי הטיול / אחראי אוטובוס וכיתה / מזכירות ביה&quot;ס</div>
    `;
  }

  function getFieldSheetHTML(opts: {
    splitByClass: boolean;
    goingOnly: boolean;
    targetClass?: string;
  }) {
    const { splitByClass, goingOnly, targetClass } = opts;
    const MAX_PER_PAGE = 40;

    const baseStudents = students.filter((s) => {
      if (goingOnly && !s.isGoing) return false;
      if (targetClass && s.class !== targetClass) return false;
      return true;
    });

    const targetClasses = targetClass
      ? [targetClass]
      : [...new Set(baseStudents.map((s) => s.class))].sort((a, b) => a.localeCompare(b, "he"));

    type SheetPage = {
      className: string;
      metaSub: string;
      students: Student[];
      startNumber: number;
    };

    const pages: SheetPage[] = [];

    if (splitByClass) {
      for (const c of targetClasses) {
        const inClass = sortStudents(baseStudents.filter((s) => s.class === c), "lastName");
        if (inClass.length === 0) continue;

        for (let i = 0; i < inClass.length; i += MAX_PER_PAGE) {
          const slice = inClass.slice(i, i + MAX_PER_PAGE);
          const partNum = Math.floor(i / MAX_PER_PAGE) + 1;
          const totalParts = Math.ceil(inClass.length / MAX_PER_PAGE);
          pages.push({
            className: c,
            metaSub: totalParts > 1 ? ` (חלק ${partNum} מתוך ${totalParts})` : "",
            students: slice,
            startNumber: i + 1,
          });
        }
      }
    } else {
      const allSorted = sortStudents(baseStudents, "class");
      for (let i = 0; i < allSorted.length; i += MAX_PER_PAGE) {
        const slice = allSorted.slice(i, i + MAX_PER_PAGE);
        pages.push({
          className: targetClass ? targetClass : "כל הכיתות",
          metaSub: "",
          students: slice,
          startNumber: i + 1,
        });
      }
    }

    const totalPages = pages.length || 1;
    const printDate = new Date().toLocaleDateString("he-IL");

    let pagesHTML = "";
    let continuousLastClass = "";
    let continuousClassIndex = 0;

    pages.forEach((page, pIdx) => {
      const pageNum = pIdx + 1;
      let rowsHTML = "";
      let currentNumber = page.startNumber;

      page.students.forEach((s) => {
        if (!splitByClass) {
          if (s.class !== continuousLastClass) {
            continuousLastClass = s.class;
            continuousClassIndex = 0;
            rowsHTML += `
              <tr class="fs-cat-row">
                <td colspan="7" style="background:#000000;color:#ffffff;font-size:9px;font-weight:bold;padding:2px 6px;text-shadow:0 0 1px #000,0 0 2px #000">
                  כיתה ${esc(s.class)}
                </td>
              </tr>
            `;
          }
          continuousClassIndex++;
          currentNumber = continuousClassIndex;
        }

        const days = dayLabel(s);
        const daysBadge = days
          ? `<span style="font-size:8px;color:#000000;font-weight:bold;margin-right:3px">(${esc(days)})</span>`
          : "";
        const notGoingBadge = !s.isGoing
          ? `<span style="font-size:8px;color:#000000;font-weight:bold;margin-right:3px">[לא יוצא]</span>`
          : "";

        rowsHTML += `
          <tr>
            <td style="text-align:center;font-weight:bold;font-size:9px">${currentNumber}</td>
            <td style="text-align:center;direction:ltr;font-family:monospace,sans-serif;font-size:9px">${esc(s.idNumber) || "—"}</td>
            <td style="font-weight:bold;white-space:nowrap;overflow:hidden">${esc(s.lastName)}</td>
            <td style="white-space:nowrap;overflow:hidden">${esc(s.firstName)}${daysBadge}${notGoingBadge}</td>
            <td style="text-align:center"></td>
            <td></td>
            <td style="text-align:center;direction:ltr;font-family:monospace,sans-serif;font-size:9px">${esc(s.phone) || "—"}</td>
          </tr>
        `;
        if (splitByClass) {
          currentNumber++;
        }
      });

      pagesHTML += `
        <div class="fs-page">
          <div class="fs-header">
            <div class="title">נספח ז׳ — רשימת תלמידים (דף מורה בשטח)</div>
            <div class="sub">${esc(trip?.name)} | ${esc(trip?.schoolName)}</div>
            <div class="meta-bar">
              <span><strong>כיתה:</strong> ${esc(page.className)}${page.metaSub}</span>
              <span><strong>תלמידים בדף:</strong> ${page.students.length}</span>
              <span><strong>מורה מלווה:</strong> ____________________</span>
              <span><strong>יעד הטיול:</strong> ${trip?.accommodation ? esc(trip.accommodation) : "____________________"}</span>
            </div>
          </div>

          <table class="fs-table">
            <colgroup>
              <col style="width:26px" />
              <col style="width:72px" />
              <col style="width:95px" />
              <col style="width:95px" />
              <col style="width:52px" />
              <col style="width:auto" />
              <col style="width:84px" />
            </colgroup>
            <thead>
              <tr>
                <th style="text-align:center">מס׳</th>
                <th style="text-align:center">ת.ז</th>
                <th>שם משפחה</th>
                <th>שם פרטי</th>
                <th style="text-align:center">נוכחות</th>
                <th>הערות</th>
                <th style="text-align:center">טלפון</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>

          <div class="fs-footer">
            <span>דף מורה בשטח ${page.className ? `— כיתה ${esc(page.className)}` : ""}</span>
            <span>עמוד ${pageNum} מתוך ${totalPages}</span>
            <span>תאריך הפקה: ${printDate}</span>
          </div>
        </div>
      `;
    });

    return `
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm 15mm 15mm 15mm;
        }
        @media print {
          html, body {
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .fs-page {
          box-sizing: border-box;
          width: 100%;
          page-break-after: always;
          break-after: page;
          margin-bottom: 24px;
          background: #fff;
          color: #000;
        }
        .fs-page:last-child {
          page-break-after: auto;
          break-after: auto;
          margin-bottom: 0;
        }
        .fs-header {
          border-bottom: 2px solid #000000;
          padding-bottom: 4px;
          margin-bottom: 6px;
        }
        .fs-header .ministry {
          font-size: 8px;
          color: #222222;
          text-align: center;
          line-height: 1.2;
        }
        .fs-header .title {
          font-size: 14.5px;
          font-weight: bold;
          color: #000000;
          text-align: center;
          margin: 2px 0;
          line-height: 1.2;
        }
        .fs-header .sub {
          font-size: 9.5px;
          color: #111111;
          text-align: center;
          line-height: 1.2;
        }
        .fs-header .meta-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9.5px;
          font-weight: 500;
          background: #f2f2f2;
          border: 1px solid #000000;
          border-radius: 3px;
          padding: 3px 8px;
          margin-top: 5px;
          color: #000000;
        }
        .fs-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .fs-table th {
          background-color: #000000 !important;
          color: #ffffff !important;
          text-shadow: 0 0 1px #000000, 0 0 2px #000000;
          font-weight: bold;
          font-size: 9.5px;
          padding: 3.5px 4px;
          border: 1px solid #000000;
          text-align: right;
          line-height: 1.15;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .fs-table td {
          border: 1px solid #000000;
          padding: 2px 4px;
          font-size: 9px;
          line-height: 1.15;
          height: 20px;
          vertical-align: middle;
          box-sizing: border-box;
          color: #000000;
        }
        .fs-table tr:nth-child(even) td {
          background: #fafafa;
        }
        .fs-footer {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          color: #333333;
          margin-top: 5px;
          border-top: 1px solid #000000;
          padding-top: 3px;
        }
      </style>
      ${pagesHTML}
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
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-28">ת.ז</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">שם משפחה</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">שם פרטי</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-16">כיתה</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-16">מין</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-28">טלפון</th>
                  {tripDayCount > 1 && <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-20">ימים</th>}
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
                          <td colSpan={tripDayCount > 1 ? 9 : 8} className="px-4 py-1.5 text-xs font-semibold text-primary">
                            כיתה {s.class} — {sorted.filter((x) => x.class === s.class && x.isGoing).length} יוצאים
                          </td>
                        </tr>
                      )}
                      <tr
                        key={s.id}
                        className={`border-b border-border last:border-0 transition-colors ${!s.isGoing ? "opacity-40" : "hover:bg-muted/20"}`}
                      >
                        <td className="px-4 py-2 text-xs font-mono text-muted-foreground" dir="ltr">{s.idNumber || "—"}</td>
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
                        {tripDayCount > 1 && (
                          <td className="px-3 py-2 text-center text-xs font-medium">
                            {dayLabel(s)
                              ? <span className="text-orange-600">{dayLabel(s)}</span>
                              : <span className="text-muted-foreground/40">—</span>
                            }
                          </td>
                        )}
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
          <Button
            size="sm"
            onClick={() => {
              setFsClass(classFilter);
              setFieldSheetOpen(true);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            דף מורה בשטח (להדפסה)
          </Button>
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

      {/* Field Sheet Options Dialog */}
      <Dialog open={fieldSheetOpen} onOpenChange={setFieldSheetOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-base font-bold text-foreground">
              הדפסת דף מורה בשטח
            </DialogTitle>
            <DialogDescription className="text-right text-xs text-muted-foreground">
              רשימה מותאמת לשימוש פיסי על גבי קלסר בשטח (עד 40 תלמידים בעמוד A4), כולל טורים מוקטנים ומשבצות ריקות לסימון נוכחות והערות.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {/* Page division */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">חלוקת עמודים</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFsSplitByClass(true)}
                  className={`p-2.5 text-xs rounded-lg border text-right transition-colors ${
                    fsSplitByClass
                      ? "bg-primary/10 border-primary text-primary font-semibold"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="font-medium text-foreground">עמוד נפרד לכל כיתה</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">דף עצמאי לכל מחנך/ת</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFsSplitByClass(false)}
                  className={`p-2.5 text-xs rounded-lg border text-right transition-colors ${
                    !fsSplitByClass
                      ? "bg-primary/10 border-primary text-primary font-semibold"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="font-medium text-foreground">רשימה רציפה</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">חיסכון בדפים (40 בעמוד)</div>
                </button>
              </div>
            </div>

            {/* Students population */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">אוכלוסיית תלמידים</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFsGoingOnly(true)}
                  className={`p-2 text-xs rounded-lg border text-center transition-colors ${
                    fsGoingOnly
                      ? "bg-primary/10 border-primary text-primary font-semibold"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  יוצאים בלבד ({students.filter((s) => s.isGoing).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFsGoingOnly(false)}
                  className={`p-2 text-xs rounded-lg border text-center transition-colors ${
                    !fsGoingOnly
                      ? "bg-primary/10 border-primary text-primary font-semibold"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  כולל לא יוצאים ({students.length})
                </button>
              </div>
            </div>

            {/* Class filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">כיתה להדפסה</label>
              <select
                value={fsClass}
                onChange={(e) => setFsClass(e.target.value)}
                className="w-full text-xs border border-border rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-primary"
              >
                <option value="">כל הכיתות ({classes.length} כיתות)</option>
                {classes.map((c) => {
                  const count = (fsGoingOnly ? students.filter((s) => s.isGoing) : students).filter((s) => s.class === c).length;
                  return <option key={c} value={c}>כיתה {c} ({count} תלמידים)</option>;
                })}
              </select>
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setFieldSheetOpen(false)}>
              ביטול
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setFieldSheetOpen(false);
                printHTML(
                  getFieldSheetHTML({
                    splitByClass: fsSplitByClass,
                    goingOnly: fsGoingOnly,
                    targetClass: fsClass,
                  }),
                  `נספח ז׳ — רשימת תלמידים (דף מורה בשטח)${fsClass ? ` — כיתה ${fsClass}` : ""}`
                );
              }}
            >
              <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              הדפס עכשיו
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Student, Trip } from "@/lib/types";
import { printHTML, esc } from "@/components/appendix-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusFilter = "all" | "going" | "notGoing";
type SortOption = "byClass" | "alphabetical";
type SourceOption = "all" | "filtered";

interface PrintStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  filteredStudents: Student[];
  trip: Trip | null;
  tripDayCount: number;
}

function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate) return "";
  const s = new Date(startDate).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  if (!endDate || endDate === startDate) return s;
  const e = new Date(endDate).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  return `${s} – ${e}`;
}

export function PrintStudentsDialog({
  open,
  onOpenChange,
  students,
  filteredStudents,
  trip,
  tripDayCount,
}: PrintStudentsDialogProps) {
  const [source, setSource] = useState<SourceOption>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("byClass");
  const [includeIdNumber, setIncludeIdNumber] = useState<boolean>(() =>
    students.some((s) => !!s.idNumber?.trim())
  );
  const [includePhone, setIncludePhone] = useState<boolean>(true);
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);

  // Extract all distinct classes
  const classes = useMemo(() => {
    return [...new Set(students.map((s) => s.class).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "he")
    );
  }, [students]);

  const hasFilterActive = filteredStudents.length !== students.length;

  // Filter the students according to dialog options
  const targetStudents = useMemo(() => {
    const base = (source === "filtered" && hasFilterActive) ? filteredStudents : students;

    return base.filter((s) => {
      // Status filter
      if (statusFilter === "going" && !s.isGoing) return false;
      if (statusFilter === "notGoing" && s.isGoing) return false;

      // Class filter
      if (selectedClass !== "all" && s.class !== selectedClass) return false;

      return true;
    });
  }, [students, filteredStudents, source, hasFilterActive, statusFilter, selectedClass]);

  // Sort target students
  const sortedStudents = useMemo(() => {
    const copy = [...targetStudents];
    if (sortBy === "byClass") {
      copy.sort((a, b) => {
        const clsCompare = (a.class || "").localeCompare(b.class || "", "he");
        if (clsCompare !== 0) return clsCompare;
        const lastCompare = (a.lastName || "").localeCompare(b.lastName || "", "he");
        if (lastCompare !== 0) return lastCompare;
        return (a.firstName || "").localeCompare(b.firstName || "", "he");
      });
    } else {
      copy.sort((a, b) => {
        const lastCompare = (a.lastName || "").localeCompare(b.lastName || "", "he");
        if (lastCompare !== 0) return lastCompare;
        return (a.firstName || "").localeCompare(b.firstName || "", "he");
      });
    }
    return copy;
  }, [targetStudents, sortBy]);

  const totalGoing = targetStudents.filter((s) => s.isGoing).length;
  const totalNotGoing = targetStudents.length - totalGoing;

  function handlePrint() {
    if (sortedStudents.length === 0) return;

    const printDate = new Date().toLocaleDateString("he-IL", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
    const printTime = new Date().toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateRange = formatDateRange(trip?.startDate, trip?.endDate);

    let statusHeaderDesc = "כל התלמידים";
    if (statusFilter === "going") statusHeaderDesc = "תלמידים יוצאים בלבד";
    if (statusFilter === "notGoing") statusHeaderDesc = "תלמידים שאינם יוצאים בלבד";
    if (selectedClass !== "all") statusHeaderDesc += ` · כיתה ${selectedClass}`;

    // Col count calculation
    let colCount = 5; // index, lastName, firstName, class, gender
    if (includeIdNumber) colCount++;
    if (includePhone) colCount++;
    colCount++; // status column
    if (includeNotes) colCount++;

    let rowsHTML = "";
    let lastClass = "";
    let classCounter = 0;

    for (let i = 0; i < sortedStudents.length; i++) {
      const s = sortedStudents[i];
      const isGoing = s.isGoing;

      // Group header when grouping by class
      if (sortBy === "byClass" && s.class !== lastClass) {
        lastClass = s.class;
        classCounter = 0;
        const inThisClass = sortedStudents.filter((x) => x.class === s.class);
        const classGoing = inThisClass.filter((x) => x.isGoing).length;
        const classNotGoing = inThisClass.length - classGoing;

        rowsHTML += `
          <tr class="class-group-row">
            <td colspan="${colCount}" style="background:#1b4332;color:#ffffff;font-size:13.5px;font-weight:bold;padding:6px 10px;">
              כיתה ${esc(s.class || "ללא כיתה")} — ${inThisClass.length} תלמידים (${classGoing} יוצאים, ${classNotGoing} לא יוצאים)
            </td>
          </tr>
        `;
      }

      classCounter++;
      const rowNum = sortBy === "byClass" ? classCounter : i + 1;

      // Partial days label
      let daysLabel = "";
      if (isGoing && tripDayCount > 1 && s.participationDays?.length && s.participationDays.length < tripDayCount) {
        daysLabel = `ימים: ${s.participationDays.join(", ")}`;
      }

      // Status badge
      const statusBadge = isGoing
        ? `<span style="display:inline-block;padding:3px 8px;border-radius:10px;background:#dcfce7;color:#166534;font-weight:bold;border:1px solid #86efac;font-size:11.5px;white-space:nowrap;">✓ יוצא${daysLabel ? ` (${daysLabel})` : ""}</span>`
        : `<span style="display:inline-block;padding:3px 8px;border-radius:10px;background:#fee2e2;color:#991b1b;font-weight:bold;border:1px solid #fca5a5;font-size:11.5px;white-space:nowrap;">✗ לא יוצא</span>`;

      // Notes compilation
      let notesParts: string[] = [];
      if (includeNotes) {
        const dietary: string[] = [];
        if (s.dietaryFlags?.vegetarian) dietary.push("צמחוני");
        if (s.dietaryFlags?.vegan) dietary.push("טבעוני");
        if (s.dietaryFlags?.glutenFree) dietary.push("ללא גלוטן");
        if (dietary.length > 0) {
          notesParts.push(`<span style="color:#047857;font-weight:bold;">[${dietary.join(", ")}]</span>`);
        }
        if (s.medicalNotes?.trim()) {
          notesParts.push(`<span style="color:#b45309;font-weight:bold;">רפואי: ${esc(s.medicalNotes.trim())}</span>`);
        }
        if (s.notes?.trim()) {
          notesParts.push(`<span style="color:#374151;">${esc(s.notes.trim())}</span>`);
        }
      }
      const notesHTML = notesParts.length > 0 ? notesParts.join(" | ") : "—";

      const genderText = s.gender === "female" ? "בת" : s.gender === "male" ? "בן" : "—";
      const rowBg = !isGoing ? "background:#fff5f5;" : (rowNum % 2 === 0 ? "background:#fbfcfb;" : "background:#ffffff;");

      rowsHTML += `
        <tr style="${rowBg}">
          <td style="padding:5px 8px;border:1px solid #d1d5db;font-size:12px;text-align:center;color:#6b7280;">${rowNum}</td>
          <td style="padding:5px 8px;border:1px solid #d1d5db;font-size:13px;font-weight:bold;">${esc(s.lastName)}</td>
          <td style="padding:5px 8px;border:1px solid #d1d5db;font-size:13px;">${esc(s.firstName)}</td>
          <td style="padding:5px 8px;border:1px solid #d1d5db;font-size:13px;text-align:center;">${esc(s.class || "—")}</td>
          ${includeIdNumber ? `<td style="padding:5px 8px;border:1px solid #d1d5db;font-size:12.5px;direction:ltr;text-align:left;">${esc(s.idNumber || "—")}</td>` : ""}
          <td style="padding:5px 8px;border:1px solid #d1d5db;font-size:13px;text-align:center;">${genderText}</td>
          ${includePhone ? `<td style="padding:5px 8px;border:1px solid #d1d5db;font-size:12.5px;direction:ltr;text-align:left;">${esc(s.phone || "—")}</td>` : ""}
          <td style="padding:5px 8px;border:1px solid #d1d5db;font-size:12px;text-align:center;">${statusBadge}</td>
          ${includeNotes ? `<td style="padding:5px 8px;border:1px solid #d1d5db;font-size:12px;line-height:1.4;">${notesHTML}</td>` : ""}
        </tr>
      `;
    }

    const html = `
      <style>
        @page {
          size: A4 portrait;
          margin: 20mm 15mm 20mm 15mm;
        }
        @media print {
          html, body {
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .header {
          border-bottom: 2px solid #1b4332;
          padding-bottom: 8px;
          margin-bottom: 12px;
          text-align: right;
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .title {
          font-size: 18px;
          font-weight: bold;
          color: #111;
        }
        .subtitle {
          font-size: 12px;
          color: #4b5563;
          margin-top: 3px;
        }
        .stats-bar {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .stat-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 4px;
          font-size: 12px;
          border: 1px solid #d1d5db;
          background: #f9fafb;
        }
        .stat-item.going {
          background: #dcfce7;
          border-color: #86efac;
          color: #166534;
          font-weight: bold;
        }
        .stat-item.not-going {
          background: #fee2e2;
          border-color: #fca5a5;
          color: #991b1b;
          font-weight: bold;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        th {
          background: #1b4332;
          color: #ffffff;
          border: 1px solid #143527;
          padding: 6px 8px;
          text-align: right;
          font-size: 13px;
          font-weight: bold;
        }
        .footer {
          margin-top: 12px;
          border-top: 1px solid #e5e7eb;
          padding-top: 6px;
          font-size: 10px;
          color: #6b7280;
          display: flex;
          justify-content: space-between;
        }
      </style>

      <div class="header">
        <div class="header-top">
          <div>
            <div class="title">רשימת תלמידים — ${esc(trip?.name || "טיול")}</div>
            <div class="subtitle">
              ${esc(trip?.schoolName || "בית ספר")}
              ${dateRange ? ` | תאריכים: ${esc(dateRange)}` : ""}
              | חתך: ${esc(statusHeaderDesc)}
            </div>
          </div>
          <div style="font-size:8.5px;color:#6b7280;text-align:left;direction:ltr;">
            הופק: ${printDate} ${printTime}
          </div>
        </div>

        <div class="stats-bar">
          <span class="stat-item">
            סה"כ ברשימה: <strong>${targetStudents.length}</strong>
          </span>
          <span class="stat-item going">
            יוצאים לטיול: <strong>${totalGoing}</strong>
          </span>
          <span class="stat-item not-going">
            לא יוצאים: <strong>${totalNotGoing}</strong>
          </span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:30px;text-align:center;">#</th>
            <th>שם משפחה</th>
            <th>שם פרטי</th>
            <th style="width:55px;text-align:center;">כיתה</th>
            ${includeIdNumber ? '<th style="width:75px;text-align:left;">ת.ז</th>' : ""}
            <th style="width:40px;text-align:center;">מין</th>
            ${includePhone ? '<th style="width:85px;text-align:left;">טלפון</th>' : ""}
            <th style="width:90px;text-align:center;">סטטוס יציאה</th>
            ${includeNotes ? '<th>הערות ומגבלות</th>' : ""}
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>

      <div class="footer">
        <span>רשימת תלמידים מתוך מערכת תיק טיול</span>
        <span>עמוד 1 מתוך 1</span>
      </div>
    `;

    printHTML(html, `רשימת תלמידים — ${trip?.name || "טיול"}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            הדפסת רשימת תלמידים
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Source selection if screen is filtered */}
          {hasFilterActive && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">מקור תלמידים</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSource("all")}
                  className={`text-xs px-3 py-2 rounded-lg border text-right transition-colors ${
                    source === "all"
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  כל התלמידים ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSource("filtered")}
                  className={`text-xs px-3 py-2 rounded-lg border text-right transition-colors ${
                    source === "filtered"
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  לפי הסינון במסך ({filteredStudents.length})
                </button>
              </div>
            </div>
          )}

          {/* Attendance status filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">אינדיקציית יציאה</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`text-xs px-2.5 py-2 rounded-lg border text-center transition-colors ${
                  statusFilter === "all"
                    ? "border-primary bg-primary/5 text-primary font-semibold"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                כולם (יוצאים ולא יוצאים)
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("going")}
                className={`text-xs px-2.5 py-2 rounded-lg border text-center transition-colors ${
                  statusFilter === "going"
                    ? "border-green-600 bg-green-50 text-green-700 font-semibold"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                יוצאים בלבד
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("notGoing")}
                className={`text-xs px-2.5 py-2 rounded-lg border text-center transition-colors ${
                  statusFilter === "notGoing"
                    ? "border-red-600 bg-red-50 text-red-700 font-semibold"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                לא יוצאים בלבד
              </button>
            </div>
          </div>

          {/* Class selection & sorting */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">כיתה</Label>
              <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v || "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedClass === "all" ? "כל השכבה" : `כיתה ${selectedClass}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל השכבה</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      כיתה {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">סדר והצגה</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {sortBy === "byClass" ? "חלוקה לפי כיתות" : "רשימה רציפה (א-ב)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="byClass">חלוקה לפי כיתות</SelectItem>
                  <SelectItem value="alphabetical">רשימה רציפה (א-ב)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Optional columns */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">עמודות להצגה בהדפסה</Label>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={includeIdNumber}
                  onChange={(e) => setIncludeIdNumber(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                תעודת זהות
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={includePhone}
                  onChange={(e) => setIncludePhone(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                טלפון
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                הערות ומגבלות רפואיות
              </label>
            </div>
          </div>

          {/* Live preview banner */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <div className="font-medium text-foreground mb-1">סיכום להדפסה:</div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>סה"כ: <strong className="text-foreground">{targetStudents.length}</strong> תלמידים</span>
              <span>·</span>
              <span className="text-green-700 font-medium">✓ {totalGoing} יוצאים</span>
              <span>·</span>
              <span className="text-red-700 font-medium">✗ {totalNotGoing} לא יוצאים</span>
            </div>
            {targetStudents.length === 0 && (
              <p className="text-destructive mt-1.5 font-medium">לא נמצאו תלמידים התואמים את הגדרות הסינון.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handlePrint} disabled={targetStudents.length === 0}>
            <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            הדפס רשימה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

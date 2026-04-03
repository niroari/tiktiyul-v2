"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { uploadFile, deleteFileByUrl } from "@/lib/firebase-storage";
import { useStudents } from "@/hooks/use-students";
import { useTrip } from "@/hooks/use-trip";
import { AppendixActions, esc } from "@/components/appendix-actions";

type MedRow = {
  id: string;
  studentId: string;
  lastName: string;
  firstName: string;
  class: string;
  issue: string;
  notes: string;
  certUrl: string;
  certName: string;
};

export function AppendixYodClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { students } = useStudents(tripId);
  const { trip } = useTrip(tripId);

  const [rows, setRows]     = useState<MedRow[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [selector, setSelector] = useState("");
  const [selectorError, setSelectorError] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadPct, setUploadPct]     = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending = useRef(false);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "yod", (raw) => {
      if (isPending.current) return;
      if (raw?.rows) setRows(raw.rows as MedRow[]);
    });
    return () => unsub();
  }, [tripId]);

  function scheduleAutoSave(updated: MedRow[]) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "yod", { rows: updated });
      isPending.current = false;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function update(updated: MedRow[]) {
    setRows(updated);
    scheduleAutoSave(updated);
  }

  // ── Student selector ────────────────────────────────────────────────────────

  const goingStudents = students
    .filter((s) => s.isGoing)
    .sort((a, b) => {
      const c = a.class.localeCompare(b.class, "he");
      return c !== 0 ? c : a.lastName.localeCompare(b.lastName, "he");
    });

  function addStudent() {
    const val = selector.trim();
    if (!val) return;
    const s = goingStudents.find(
      (s) => `${s.lastName} ${s.firstName} (${s.class})` === val
    );
    if (!s) { setSelectorError("לא נמצא תלמיד/ה — יש לבחור מהרשימה"); return; }
    if (rows.find((r) => r.studentId === s.id)) { setSelectorError("תלמיד/ה זה כבר ברשימה"); return; }
    setSelectorError("");
    setSelector("");
    update([...rows, {
      id: crypto.randomUUID(),
      studentId: s.id,
      lastName: s.lastName,
      firstName: s.firstName,
      class: s.class,
      issue: s.medicalNotes ?? "",  // pre-fill from student record if exists
      notes: "",
      certUrl: "",
      certName: "",
    }]);
  }

  function removeRow(id: string) {
    update(rows.filter((r) => r.id !== id));
  }

  function setField(id: string, field: "issue" | "notes", val: string) {
    update(rows.map((r) => r.id === id ? { ...r, [field]: val } : r));
  }

  // ── Certificate upload ──────────────────────────────────────────────────────

  async function uploadCert(rowId: string, file: File) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
    if (!ALLOWED_TYPES.includes(file.type)) return;

    // Delete old cert if exists
    if (row.certUrl) await deleteFileByUrl(row.certUrl);

    setUploadingId(rowId);
    setUploadPct(0);
    try {
      const url = await uploadFile(
        tripId,
        `med-certs/${row.studentId}`,
        file,
        setUploadPct
      );
      update(rows.map((r) => r.id === rowId ? { ...r, certUrl: url, certName: file.name } : r));
    } catch (e) {
      console.error("cert upload failed", e);
    } finally {
      setUploadingId(null);
    }
  }

  async function removeCert(rowId: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    if (row.certUrl) await deleteFileByUrl(row.certUrl);
    update(rows.map((r) => r.id === rowId ? { ...r, certUrl: "", certName: "" } : r));
  }

  // ── Print HTML ──────────────────────────────────────────────────────────────

  function getHTML() {
    const tableRows = rows.map((r, i) => `
      <tr style="${i % 2 === 0 ? "" : "background:#f0f7f4"}">
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px;text-align:center">${i + 1}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px">${esc(r.lastName)} ${esc(r.firstName)}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px;text-align:center">${esc(r.class)}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px">${esc(r.issue)}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px">${esc(r.notes)}</td>
      </tr>`).join("");

    return `
      <div class="header">
        <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
        <div class="title">נספח י׳ — תלמידים בעלי מגבלות רפואיות</div>
        ${trip ? `<div class="ministry">${esc(trip.name)} | ${esc(trip.schoolName)}</div>` : ""}
      </div>
      <table>
        <thead><tr>
          <th style="width:28px;text-align:center">מס׳</th>
          <th>שם התלמיד/ה</th>
          <th style="width:55px;text-align:center">כיתה</th>
          <th>הבעיה הרפואית</th>
          <th>דגשים להשגחה</th>
        </tr></thead>
        <tbody>${tableRows || `<tr><td colspan="5" style="padding:12px;text-align:center;color:#aaa;font-size:10px">אין תלמידים ברשימה</td></tr>`}</tbody>
      </table>
      <div class="footer">מסמך זה הינו סודי — לעיון אחראי הטיול והצוות הרפואי בלבד</div>
    `;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח י׳ — מגבלות רפואיות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            תלמידים בעלי מגבלות רפואיות הדורשות תשומת לב מיוחדת
          </p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {/* Student selector */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">ייבא רשימת תלמידים בנספח ז׳ כדי להוסיף תלמידים</p>
        ) : (
          <div className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <input
                type="text"
                list="yod-students"
                value={selector}
                onChange={(e) => { setSelector(e.target.value); setSelectorError(""); }}
                onKeyDown={(e) => e.key === "Enter" && addStudent()}
                placeholder="הקלד שם תלמיד/ה לחיפוש..."
                className="w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2 focus:outline-none focus:border-primary"
              />
              <datalist id="yod-students">
                {goingStudents
                  .filter((s) => !rows.find((r) => r.studentId === s.id))
                  .map((s) => (
                    <option key={s.id} value={`${s.lastName} ${s.firstName} (${s.class})`} />
                  ))}
              </datalist>
              {selectorError && <p className="text-xs text-destructive">{selectorError}</p>}
            </div>
            <button
              onClick={addStudent}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors shrink-0"
            >
              הוסף
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-8">#</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">שם התלמיד/ה</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-16">כיתה</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">הבעיה הרפואית</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">דגשים להשגחה</th>
                  <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-32">אישור רפואי</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-2 text-muted-foreground text-xs text-center">{i + 1}</td>
                    <td className="px-4 py-2 font-medium whitespace-nowrap">
                      {row.lastName} {row.firstName}
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{row.class}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.issue}
                        onChange={(e) => setField(row.id, "issue", e.target.value)}
                        placeholder="תיאור הבעיה..."
                        className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50 min-w-[140px]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => setField(row.id, "notes", e.target.value)}
                        placeholder="דגשים..."
                        className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50 min-w-[160px]"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {uploadingId === row.id ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{uploadPct}%</span>
                        </div>
                      ) : row.certUrl ? (
                        <div className="flex items-center justify-center gap-1">
                          <a
                            href={row.certUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline truncate max-w-[70px]"
                            title={row.certName}
                          >
                            ✓ {row.certName.length > 10 ? row.certName.slice(0, 10) + "…" : row.certName}
                          </a>
                          <button
                            onClick={() => removeCert(row.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer text-xs text-primary/70 border border-primary/30 rounded px-2 py-0.5 hover:bg-primary/5 transition-colors">
                          📎 העלה
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadCert(row.id, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
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
        </div>
      )}

      {rows.length === 0 && students.length > 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center">
          <p className="text-muted-foreground text-sm">טרם נוספו תלמידים לרשימה</p>
          <p className="text-xs text-muted-foreground/70 mt-1">חפש/י תלמיד/ה בשדה למעלה והוסף/י לרשימה</p>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-[var(--radius-sm)] px-4 py-2.5">
        מסמך זה הינו סודי — לעיון אחראי הטיול והצוות הרפואי בלבד
      </div>

      <AppendixActions title="נספח י׳ — מגבלות רפואיות" filename="נספח-י" getHTML={getHTML} />
    </div>
  );
}

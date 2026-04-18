"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Student, Gender } from "@/lib/types";

type ParsedStudent = Omit<Student, "id">;

// ─── Parse Excel rows into student objects ────────────────────────────────────
// Supports Ministry of Education formats. Column positions are detected from
// the header row (containing "ת.ז") so extra columns (e.g. "שם כיתה") don't
// shift gender/phone offsets.
//
// Known formats:
//   Old:     [ת.ז, שם משפחה, שם פרטי, כיתה, מקבילה, טלפון]
//   New:     [מספר, ת.ז, שם משפחה, שם פרטי, כיתה, מקבילה, מין, טלפון]
//   New+:    [מספר, ת.ז, שם משפחה, שם פרטי, כיתה, מקבילה, שם כיתה, מין]

function cv(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return String(row[idx] ?? "").trim();
}

function parseRows(rows: unknown[][]): ParsedStudent[] {
  // Find the header row (first row containing "ת.ז")
  let colMap: Record<string, number> | null = null;
  let dataStart = 0;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const cells = rows[i].map((c) => String(c ?? "").trim());
    if (cells.includes("ת.ז")) {
      colMap = Object.fromEntries(cells.map((h, idx) => [h, idx]));
      dataStart = i + 1;
      break;
    }
  }

  const students: ParsedStudent[] = [];

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    let last = "", first = "", grade = "", kita = "", genderRaw = "", phone = "", idNumber = "";

    if (colMap) {
      // Header-guided: column positions come from the detected header row
      const tzVal = cv(row, colMap["ת.ז"]);
      if (!/^\d{7,9}$/.test(tzVal)) continue;
      idNumber  = tzVal;
      last      = cv(row, colMap["שם משפחה"]);
      first     = cv(row, colMap["שם פרטי"]);
      grade     = cv(row, colMap["כיתה"]);
      kita      = cv(row, colMap["מקבילה"]);
      genderRaw = cv(row, colMap["מין"]);
      phone     = cv(row, colMap["טלפון נייד"] ?? colMap["טלפון"]);
    } else {
      // Fallback: positional detection for headerless files
      const col0 = String(row[0] ?? "").trim();
      const col1 = String(row[1] ?? "").trim();
      if (/^\d{7,9}$/.test(col1)) {
        idNumber = col1;
        last = cv(row, 2); first = cv(row, 3); grade = cv(row, 4);
        kita = cv(row, 5); genderRaw = cv(row, 6); phone = cv(row, 7);
      } else if (/^\d{7,9}$/.test(col0)) {
        idNumber = col0;
        last = cv(row, 1); first = cv(row, 2); grade = cv(row, 3);
        kita = cv(row, 4); phone = cv(row, 5);
      } else {
        continue;
      }
    }

    if (!first && !last) continue;

    const className = grade && kita ? `${grade}׳${kita}` : grade || kita;
    const gender: Gender = genderRaw === "נ" ? "female" : genderRaw === "ז" ? "male" : "female";

    students.push({
      firstName: first,
      lastName: last,
      class: className,
      gender,
      phone,
      idNumber,
      isGoing: true,
      dietaryFlags: { vegetarian: false, vegan: false, glutenFree: false },
    });
  }

  return students;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  onImport: (students: ParsedStudent[]) => Promise<void>;
};

export function ExcelImport({ onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function handleFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
        const parsed = parseRows(rows);
        if (parsed.length === 0) {
          setError("לא נמצאו תלמידים בקובץ. בדוק שהפורמט תואם.");
          return;
        }
        setPreview(parsed);
      } catch {
        setError("שגיאה בקריאת הקובץ. ודא שהקובץ תקין.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleConfirm() {
    if (!preview) return;
    setImporting(true);
    try {
      await onImport(preview);
      setPreview(null);
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
      >
        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        ייבוא מ-Excel
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>אישור ייבוא תלמידים</DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="flex-1 overflow-hidden flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                נמצאו <span className="font-semibold text-foreground">{preview.length}</span> תלמידים.
                תצוגה מקדימה (10 ראשונים):
              </p>

              <div className="overflow-auto border border-border rounded-[var(--radius-sm)]">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b border-border sticky top-0">
                    <tr>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">שם משפחה</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">שם פרטי</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">כיתה</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">מגדר</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">טלפון</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((s, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="px-3 py-2">{s.lastName}</td>
                        <td className="px-3 py-2">{s.firstName}</td>
                        <td className="px-3 py-2">{s.class}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                            ${s.gender === "female" ? "bg-pink-50 text-pink-700" : "bg-blue-50 text-blue-700"}`}>
                            {s.gender === "female" ? "בת" : "בן"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{s.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  ועוד {preview.length - 10} תלמידים נוספים...
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setPreview(null)}>ביטול</Button>
            <Button onClick={handleConfirm} disabled={importing}>
              {importing ? "מייבא..." : `ייבא ${preview?.length ?? 0} תלמידים`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

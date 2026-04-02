"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { AppendixActions } from "@/components/appendix-actions";
import { useTrip } from "@/hooks/use-trip";

// ─── Checklist data ───────────────────────────────────────────────────────────

type ChecklistItem = { d: string; r?: string };
type ChecklistCategory = { n: number; s: string; sub?: string; items: ChecklistItem[] };

const CHECKLIST: ChecklistCategory[] = [
  { n: 1, s: "תיק אחראי טיול", sub: "אישורים + רשימות", items: [
    { d: 'כתב מינוי לאחראי/ת טיול בחתימת מנהל/ת ביה"ס', r: "נספח ב׳" },
    { d: "אישור מנהל/ת ביה\"ס ליציאה לטיול", r: "נספח ג׳" },
    { d: "אישור ביטחוני מהלשכה לתיאום טיולים — תואם לתוכנית הטיול" },
    { d: "אישור מנהל/ת ביה\"ס לפעילות חריגה בטיול + הנוהל הרלוונטי מחוזר מנכ\"ל", r: "נספח ד׳" },
    { d: "אישור הורים על השתתפות בנם / בתם והצהרת בריאות", r: "נספח ה׳" },
    { d: "רשימת תלמידים משתתפים — 3 עותקים: אחראי הטיול / אחראי אוטובוס וכיתה / מזכירות ביה\"ס" },
    { d: "רשימת תלמידים עם מגבלות רפואיות", r: "נספח ו׳" },
    { d: "טופס הפניה לטיפול רפואי לתלמיד שנפגע במהלך טיול", r: "נספח ז׳" },
    { d: "רשימת תלמידים שנפגעו במהלך טיול", r: "נספח ח׳" },
    { d: "טופס ביטוח למתנדב", r: "נספח ט׳" },
    { d: "רשימת מלווים וטלפונים חיוניים בטיול", r: "נספח י׳" },
    { d: 'הוראות פתיחה באש למאבטחים', r: 'נספח י"א' },
    { d: "הנחיות למורה אחראי/ת באוטובוס", r: 'נספח י"ב' },
    { d: "הנחיות למורה אחראי/ת כיתה", r: 'נספח י"ג' },
    { d: "עדכון מזג אויר והתאמתו לטיול" },
    { d: "ביצוע תיאום טלפוני כנדרש באישור הטיול" },
    { d: "המצאות מפת אזור הטיול כולל מפת סימון שבילים 1:50,000" },
    { d: "ביצוע סיור הכנה מקדים ע\"י אחראי/ת טיול" },
    { d: "ביצוע ניהול סיכונים עם חברת הטיולים לפני היציאה — הדגשת המסקנות לפני המסלול" },
    { d: "המצאות פנקס כיס לטיול", r: "מומלץ" },
  ]},
  { n: 2, s: "אוטובוס", items: [
    { d: "אישור קצין בטיחות לאוטובוס" },
    { d: "אישור הסעת תלמידים — לנהג" },
    { d: 'המצאות אלונקה, תיק ע"ר, ערכת חילוץ, מים וקשר' },
    { d: "גיל האוטובוס עד 10 שנים" },
    { d: "חגורות בטיחות" },
    { d: "סריקת האוטובוס טרם עליית התלמידים" },
  ]},
  { n: 3, s: "ציוד", items: [
    { d: "בדיקת מנשאים ומיכלי מים רזרביים" },
    { d: "בדיקת ציוד חיוני אצל תלמידים: מים, כובע ונעליים מתאימות" },
    { d: 'המצאות ובדיקה של תיק עזרה ראשונה — תקניים ובכמות כנדרש בחוזר מנכ"ל' },
    { d: "אחר — עפ\"י אופי הטיול" },
  ]},
  { n: 4, s: "תדריך", items: [
    { d: "לתלמידים: כללי בטיחות בנסיעה ובהליכה ודגשים מיוחדים" },
    { d: "למאבטחים: הוראות פתיחה באש, מקומם במהלך הטיול + המצאות תיעוד נדרש", r: "איסור שימוש בעוזי" },
    { d: "לנהגים: תוכנית הטיול ולו\"ז, ציר נסיעה, מהירות נסיעה — בטיחות" },
    { d: 'למדריכים: לו"ז מסלול + תעודות תו תקן' },
    { d: "למלווים: תפקידם ואחריותם" },
  ]},
  { n: 5, s: "דיווחים", items: [
    { d: "טרם היציאה — למוקד עירוני טל׳ 106" },
    { d: "במקרה של אירוע חריג: לחדר מצב 02-6222211 | למנהלת ביה\"ס | למוקד 106" },
  ]},
];

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemState = { w: boolean; m: boolean; note: string };
type ChecklistData = Record<string, ItemState>;

function itemKey(catN: number, i: number) { return `${catN}_${i}`; }

function countChecked(data: ChecklistData) {
  const total = CHECKLIST.reduce((sum, cat) => sum + cat.items.length, 0) * 2;
  const checked = Object.values(data).reduce((sum, s) => sum + (s.w ? 1 : 0) + (s.m ? 1 : 0), 0);
  return { checked, total };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AppendixAlefClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const [data, setData] = useState<ChecklistData>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const { trip } = useTrip(tripId);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load from Firestore
  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "alef", (raw) => {
      if (raw?.items) setData(raw.items as ChecklistData);
    });
    return () => unsub();
  }, [tripId]);

  // Auto-save with debounce
  function scheduleAutoSave(updated: ChecklistData) {
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "alef", { items: updated });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function toggle(key: string, field: "w" | "m") {
    const current = data[key] ?? { w: false, m: false, note: "" };
    const updated = { ...data, [key]: { ...current, [field]: !current[field] } };
    setData(updated);
    scheduleAutoSave(updated);
  }

  function setNote(key: string, note: string) {
    const current = data[key] ?? { w: false, m: false, note: "" };
    const updated = { ...data, [key]: { ...current, note } };
    setData(updated);
    scheduleAutoSave(updated);
  }

  const { checked, total } = countChecked(data);
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  function getHTML() {
    const classes = trip?.classes?.map((c) => c.name).join(", ") ?? "";
    let rows = "";
    CHECKLIST.forEach((cat) => {
      rows += `<tr class="cat-row">
        <td style="text-align:center">${cat.n}</td>
        <td colspan="4">${cat.s}${cat.sub ? ` — ${cat.sub}` : ""}</td>
        <td></td>
      </tr>`;
      cat.items.forEach((item, i) => {
        const s = data[itemKey(cat.n, i)] ?? { w: false, m: false, note: "" };
        rows += `<tr>
          <td style="text-align:center;font-size:9px"></td>
          <td style="font-size:9.5px;line-height:1.4">${item.d}</td>
          <td style="text-align:center;font-size:14px">${s.w ? "✓" : ""}</td>
          <td style="text-align:center;font-size:14px">${s.m ? "✓" : ""}</td>
          <td style="font-size:9px;color:#555">${item.r ?? ""}</td>
          <td style="font-size:9px">${s.note}</td>
        </tr>`;
      });
    });
    return `
      <div class="header">
        <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
        <div class="title">נספח א׳ — טופס ביקורת יציאה לטיול</div>
      </div>
      <table>
        <thead><tr>
          <th style="width:28px">מס"ד</th>
          <th>פירוט הנושא</th>
          <th style="width:50px;text-align:center">שבוע<br>לפני</th>
          <th style="width:50px;text-align:center">בוקר<br>הטיול</th>
          <th style="width:55px">הפניה</th>
          <th>הערות</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="meta">
        <span>טיול / סיור כיתות: <strong>${classes}</strong></span>
        <span>חתימה: _______________________</span>
      </div>
      <div class="footer">עותק של טופס זה יועבר חתום בבוקר הטיול ע"י אחראי/ת הטיול למנהל/ת ביה"ס</div>
    `;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח א׳ — טופס ביקורת לפני יציאה לטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ממלאים שבוע לפני ובבוקר הטיול · עותק חתום מועבר למנהל/ת בבוקר הטיול
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{checked}/{total}</span>
          </div>
          {/* Status */}
          <span className={`text-xs ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
            {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-8">מס׳</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">פירוט הנושא</th>
              <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-20">שבוע<br />לפני</th>
              <th className="px-3 py-2.5 font-medium text-muted-foreground text-center w-20">בוקר<br />הטיול</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-40">הערות</th>
            </tr>
          </thead>
          <tbody>
            {CHECKLIST.map((cat) => (
              <>
                {/* Category header */}
                <tr key={`cat-${cat.n}`} className="bg-[var(--brand-light)] border-y border-border">
                  <td className="px-4 py-2 text-center font-bold text-primary">{cat.n}</td>
                  <td colSpan={4} className="px-4 py-2">
                    <span className="font-semibold text-primary">{cat.s}</span>
                    {cat.sub && <span className="text-xs text-muted-foreground mr-2">{cat.sub}</span>}
                  </td>
                </tr>
                {/* Items */}
                {cat.items.map((item, i) => {
                  const k = itemKey(cat.n, i);
                  const s = data[k] ?? { w: false, m: false, note: "" };
                  return (
                    <tr key={k} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground text-center text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <span className={s.w && s.m ? "text-muted-foreground line-through" : ""}>{item.d}</span>
                        {item.r && (
                          <span className="mr-2 text-xs text-primary/70 bg-[var(--brand-light)] px-1.5 py-0.5 rounded">{item.r}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={s.w}
                          onChange={() => toggle(k, "w")}
                          className="w-4 h-4 accent-[var(--brand)] cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={s.m}
                          onChange={() => toggle(k, "m")}
                          className="w-4 h-4 accent-[var(--brand)] cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={s.note}
                          onChange={(e) => setNote(k, e.target.value)}
                          placeholder="הערה..."
                          className="w-full text-xs bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5 transition-colors placeholder:text-muted-foreground/50"
                        />
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        עותק של טופס זה יועבר חתום בבוקר הטיול ע"י אחראי/ת הטיול למנהל/ת ביה"ס
      </p>
      <AppendixActions title="נספח א׳ — טופס ביקורת לפני יציאה" filename="נספח-א" getHTML={getHTML} />
    </div>
  );
}

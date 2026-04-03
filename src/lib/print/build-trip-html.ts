import { Trip, Student } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeSig(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/^data:image\/(png|jpeg);base64,/.test(url)) return null;
  if (url.length > 300_000) return null;
  return url;
}

function sigImg(url: string | null | undefined): string {
  const safe = safeSig(url);
  return safe
    ? `<img src="${safe}" style="max-height:60px;max-width:180px;object-fit:contain">`
    : `<div style="border-bottom:1px solid #555;width:160px;height:40px"></div>`;
}

function pageBreak(): string {
  return `<div style="page-break-after:always"></div>`;
}

// ─── Appendix א ──────────────────────────────────────────────────────────────

type ItemState = { w: boolean; m: boolean; note: string };
type ChecklistData = Record<string, ItemState>;

type ChecklistItem = { d: string; r?: string };
type ChecklistCategory = { n: number; s: string; sub?: string; items: ChecklistItem[] };

const CHECKLIST: ChecklistCategory[] = [
  { n: 1, s: "תיק אחראי טיול", sub: "אישורים + רשימות", items: [
    { d: 'כתב מינוי לאחראי/ת טיול בחתימת מנהל/ת ביה"ס', r: "נספח ב׳" },
    { d: 'אישור מנהל/ת ביה"ס ליציאה לטיול', r: "נספח ג׳" },
    { d: "אישור ביטחוני מהלשכה לתיאום טיולים — תואם לתוכנית הטיול" },
    { d: 'אישור מנהל/ת ביה"ס לפעילות חריגה בטיול + הנוהל הרלוונטי מחוזר מנכ"ל', r: "נספח ד׳" },
    { d: "אישור הורים על השתתפות בנם / בתם והצהרת בריאות", r: "נספח ה׳" },
    { d: 'רשימת תלמידים משתתפים — 3 עותקים: אחראי הטיול / אחראי אוטובוס וכיתה / מזכירות ביה"ס' },
    { d: "רשימת תלמידים עם מגבלות רפואיות", r: "נספח ו׳" },
    { d: "טופס הפניה לטיפול רפואי לתלמיד שנפגע במהלך טיול", r: "נספח ז׳" },
    { d: "רשימת תלמידים שנפגעו במהלך טיול", r: "נספח ח׳" },
    { d: "טופס ביטוח למתנדב", r: "נספח ט׳" },
    { d: "רשימת מלווים וטלפונים חיוניים בטיול", r: "נספח י׳" },
    { d: "הוראות פתיחה באש למאבטחים", r: 'נספח י"א' },
    { d: "הנחיות למורה אחראי/ת באוטובוס", r: 'נספח י"ב' },
    { d: "הנחיות למורה אחראי/ת כיתה", r: 'נספח י"ג' },
    { d: "עדכון מזג אויר והתאמתו לטיול" },
    { d: "ביצוע תיאום טלפוני כנדרש באישור הטיול" },
    { d: "המצאות מפת אזור הטיול כולל מפת סימון שבילים 1:50,000" },
    { d: 'ביצוע סיור הכנה מקדים ע"י אחראי/ת טיול' },
    { d: 'ביצוע ניהול סיכונים עם חברת הטיולים לפני היציאה — הדגשת המסקנות לפני המסלול' },
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
    { d: 'אחר — עפ"י אופי הטיול' },
  ]},
  { n: 4, s: "תדריך", items: [
    { d: "לתלמידים: כללי בטיחות בנסיעה ובהליכה ודגשים מיוחדים" },
    { d: "למאבטחים: הוראות פתיחה באש, מקומם במהלך הטיול + המצאות תיעוד נדרש", r: "איסור שימוש בעוזי" },
    { d: 'לנהגים: תוכנית הטיול ולו"ז, ציר נסיעה, מהירות נסיעה — בטיחות' },
    { d: 'למדריכים: לו"ז מסלול + תעודות תו תקן' },
    { d: "למלווים: תפקידם ואחריותם" },
  ]},
  { n: 5, s: "דיווחים", items: [
    { d: "טרם היציאה — למוקד עירוני טל׳ 106" },
    { d: "במקרה של אירוע חריג: לחדר מצב 02-6222211 | למנהלת ביה\"ס | למוקד 106" },
  ]},
];

function itemKey(catN: number, i: number) { return `${catN}_${i}`; }

export function buildAlef(data: ChecklistData, trip: Trip | null): string {
  const classes = trip?.classes?.map((c) => c.name).join(", ") ?? "";
  let rows = "";
  CHECKLIST.forEach((cat) => {
    rows += `<tr class="cat-row">
      <td style="text-align:center">${cat.n}</td>
      <td colspan="4">${esc(cat.s)}${cat.sub ? ` — ${esc(cat.sub)}` : ""}</td>
      <td></td>
    </tr>`;
    cat.items.forEach((item, i) => {
      const s = data[itemKey(cat.n, i)] ?? { w: false, m: false, note: "" };
      rows += `<tr>
        <td style="text-align:center;font-size:9px"></td>
        <td style="font-size:9.5px;line-height:1.4">${esc(item.d)}</td>
        <td style="text-align:center;font-size:14px">${s.w ? "✓" : ""}</td>
        <td style="text-align:center;font-size:14px">${s.m ? "✓" : ""}</td>
        <td style="font-size:9px;color:#555">${esc(item.r ?? "")}</td>
        <td style="font-size:9px">${esc(s.note)}</td>
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
      <span>טיול / סיור כיתות: <strong>${esc(classes)}</strong></span>
      <span>חתימה: _______________________</span>
    </div>
    <div class="footer">עותק של טופס זה יועבר חתום בבוקר הטיול ע"י אחראי/ת הטיול למנהל/ת ביה"ס</div>`;
}

// ─── Appendix ב ──────────────────────────────────────────────────────────────

type BetScheduleRow = { id: string; date: string; fromTime: string; toTime: string; activity: string; notes: string };
type BetData = { leaderName: string; leaderPhone: string; parents: string; weapons: string; leaderNotes: string; principalNotes: string; schedule: BetScheduleRow[] };

export function buildBet(
  data: BetData,
  trip: Trip | null,
  sigs: { leader: string | null; coordinator: string | null; principal: string | null }
): string {
  const classes = trip?.classes?.map((c) => c.name).join(", ") ?? "";
  const schedRows = data.schedule.map((r) => `
    <tr>
      <td>${esc(r.date)}</td>
      <td style="text-align:center">${esc(r.fromTime)}</td>
      <td style="text-align:center">${esc(r.toTime)}</td>
      <td>${esc(r.activity)}</td>
      <td>${esc(r.notes)}</td>
    </tr>`).join("");
  return `
    <div class="header">
      <div class="ministry">משרד החינוך — מינהל חברה ונוער</div>
      <div class="title">נספח ב׳ — אישור תוכנית הטיול</div>
    </div>
    <div class="meta">
      <span>כיתות: <strong>${esc(classes)}</strong></span>
      <span>מקום לינה: <strong>${esc(trip?.accommodation ?? "")}</strong></span>
      <span>הסעה: <strong>${esc(trip?.transport ?? "")}</strong></span>
    </div>
    <div class="meta">
      <span>אחראי/ת טיול: <strong>${esc(data.leaderName)}</strong></span>
      <span>טלפון: <strong>${esc(data.leaderPhone)}</strong></span>
      <span>הורים מלווים: <strong>${esc(data.parents)}</strong></span>
      <span>נושאי נשק: <strong>${esc(data.weapons)}</strong></span>
    </div>
    <div class="section-title">מסלול הטיול — לוח זמנים</div>
    <table>
      <thead><tr>
        <th style="width:90px">תאריך</th>
        <th style="width:60px">משעה</th>
        <th style="width:60px">עד שעה</th>
        <th>פירוט הפעילות והמקום</th>
        <th style="width:110px">הערות</th>
      </tr></thead>
      <tbody>${schedRows}</tbody>
    </table>
    ${data.leaderNotes ? `<div class="section-title">הערות אחראי/ת טיול</div><p style="font-size:10px;line-height:1.6">${esc(data.leaderNotes)}</p>` : ""}
    ${data.principalNotes ? `<div class="section-title">הערות מנהל/ת</div><p style="font-size:10px;line-height:1.6">${esc(data.principalNotes)}</p>` : ""}
    <div class="section-title">חתימות</div>
    <table style="margin-top:8px">
      <tr><th>מורה אחראי/ת</th><th>רכז/ת טיולים</th><th>מנהל/ת ביה"ס</th></tr>
      <tr>
        <td style="height:70px;text-align:center;vertical-align:middle">${sigImg(sigs.leader)}</td>
        <td style="text-align:center;vertical-align:middle">${sigImg(sigs.coordinator)}</td>
        <td style="text-align:center;vertical-align:middle">${sigImg(sigs.principal)}</td>
      </tr>
    </table>`;
}

// ─── Appendix ג ──────────────────────────────────────────────────────────────

type GimelData = { date: string; leaderName: string; principalName: string; area: string };

function formatDateHe(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

export function buildGimel(data: GimelData, trip: Trip | null, principalSig: string | null): string {
  const cls = trip?.classes?.map((c) => c.name).join(", ") ?? "";
  const dr = trip?.startDate && trip?.endDate
    ? `${formatDateHe(trip.startDate)} עד ${formatDateHe(trip.endDate)}` : "";
  return `
    <div class="header">
      <div class="title">נספח ג׳ — כתב מינוי לאחראי/ת טיול</div>
      <div class="ministry">בחתימת מנהל/ת ביה"ס</div>
    </div>
    <div class="meta"><span>תאריך: <strong>${data.date ? formatDateHe(data.date) : "—"}</strong></span></div>
    <div class="letter-body">
      <p>אל: <strong>${esc(data.leaderName)}</strong></p>
      <br/>
      <p>הריני ממנה אותך לאחראי/ת טיול לתלמידי כית/ות <strong>${esc(cls)}</strong>
      שיתקיים בתאריכים <strong>${esc(dr)}</strong>
      במקום/באזור <strong>${esc(data.area)}</strong>.</p>
      <br/>
      <p>בכבוד רב,</p>
      <p><strong>${esc(data.principalName)}</strong></p>
      <p>מנהל/ת ביה"ס — ${esc(trip?.schoolName ?? "")}</p>
      <br/>
      <p>חתימה:</p>
      ${sigImg(principalSig)}
    </div>`;
}

// ─── Appendix ד ──────────────────────────────────────────────────────────────

type DaletRow = { id: string; day: string; time: string; activity: string; notes: string };

export function buildDalet(rows: DaletRow[]): string {
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
    </table>`;
}

// ─── Appendix ה ──────────────────────────────────────────────────────────────

type HeyRow = { id: string; role: string; name: string; phone: string; notes: string };

export function buildHey(rows: HeyRow[]): string {
  const tableRows = rows.map((r) => `
    <tr>
      <td>${esc(r.role)}</td>
      <td>${esc(r.name)}</td>
      <td style="text-align:center;direction:ltr">${esc(r.phone)}</td>
      <td>${esc(r.notes)}</td>
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
    <div class="footer">יש לשמור עותק של טופס זה אצל כל מלווה בטיול</div>`;
}

// ─── Appendix ו ──────────────────────────────────────────────────────────────

const CREW_ROLES = ["מורה אחראי/ת", "מורה נוסף", "נהג", "מאבטח/חובש", "מדריך"];
const DRIVER_IDX = CREW_ROLES.indexOf("נהג");
const PART_LABELS = ["חלק א׳", "חלק ב׳", "חלק ג׳"];

function isSplitSel(sel: string) { return sel.includes("|"); }
function parseSplit(sel: string): [string, number] {
  const idx = sel.lastIndexOf("|");
  return [sel.slice(0, idx), parseInt(sel.slice(idx + 1))];
}
function splitLabel(cls: string, part: number) { return `${cls} — ${PART_LABELS[part]}`; }

type CrewMember = { name: string; phone: string };
type ExtraTeacher = { role: string; name: string; phone: string };
type VavBus = { id: string; classSelections: string[]; crew: CrewMember[]; extraTeachers: ExtraTeacher[] };
type VavData = { buses: VavBus[]; actual: Record<string, string>; splits: Record<string, string[]> };

function calcEscorts(bus: VavBus): number {
  return bus.crew.filter((c, i) => i !== DRIVER_IDX && c.name.trim()).length
    + bus.extraTeachers.filter((e) => e.name.trim()).length;
}

export function buildVav(data: VavData, students: Student[], trip: Trip | null): string {
  const plannedByClass: Record<string, number> = {};
  students.filter((s) => s.isGoing).forEach((s) => {
    plannedByClass[s.class] = (plannedByClass[s.class] ?? 0) + 1;
  });
  const classNames = Object.keys(plannedByClass).sort((a, b) => a.localeCompare(b, "he"));

  function busStudentCount(bus: VavBus): number {
    return bus.classSelections.filter(Boolean).reduce((sum, sel) => {
      if (isSplitSel(sel)) {
        const [cls, part] = parseSplit(sel);
        return sum + (parseInt(data.splits[cls]?.[part]) || 0);
      }
      return sum + (plannedByClass[sel] ?? 0);
    }, 0);
  }

  const n = data.buses.length;
  const busHeaders = data.buses.map((b, bi) => {
    const labels = b.classSelections.filter(Boolean).map((sel) =>
      isSplitSel(sel) ? splitLabel(...parseSplit(sel)) : sel).join(", ");
    const sc = busStudentCount(b);
    return `<th style="padding:5px 6px;border:1px solid #999;font-size:9px;font-weight:bold;background:#1b4332;color:white;text-align:center;min-width:110px">
      אוטובוס ${bi + 1}${labels ? `<br><span style="font-weight:normal">${esc(labels)}</span>` : ""}${sc ? `<br><span style="font-weight:normal;font-size:8px">${sc} תלמידים</span>` : ""}
    </th>`;
  }).join("");

  const crewRows = CREW_ROLES.map((role, ri) => `
    <tr style="background:#d4edda">
      <td colspan="${n + 1}" style="padding:3px 6px;border:1px solid #bbb;font-size:9px;font-weight:bold;color:#1b4332">${role}</td>
    </tr>
    <tr>
      <td style="padding:3px 6px;border:1px solid #ccc;font-size:8px;color:#555;background:#f9f9f9">שם</td>
      ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center">${esc(b.crew[ri]?.name)}</td>`).join("")}
    </tr>
    <tr>
      <td style="padding:3px 6px;border:1px solid #ccc;font-size:8px;color:#555;background:#f9f9f9">טלפון</td>
      ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center;direction:ltr">${esc(b.crew[ri]?.phone)}</td>`).join("")}
    </tr>`).join("");

  const maxExtra = Math.max(0, ...data.buses.map((b) => b.extraTeachers.length));
  const extraRows = Array.from({ length: maxExtra }, (_, ei) => `
    <tr style="background:#d4edda">
      <td colspan="${n + 1}" style="padding:3px 6px;border:1px solid #bbb;font-size:9px;font-weight:bold;color:#1b4332">מלווה נוסף ${ei + 1}</td>
    </tr>
    <tr>
      <td style="padding:3px 6px;border:1px solid #ccc;font-size:8px;color:#555;background:#f9f9f9">תפקיד / שם</td>
      ${data.buses.map((b) => { const e = b.extraTeachers[ei]; return `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center">${e ? `${esc(e.role)} — ${esc(e.name)}` : ""}</td>`; }).join("")}
    </tr>
    <tr>
      <td style="padding:3px 6px;border:1px solid #ccc;font-size:8px;color:#555;background:#f9f9f9">טלפון</td>
      ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center;direction:ltr">${esc(b.extraTeachers[ei]?.phone)}</td>`).join("")}
    </tr>`).join("");

  const classRows = classNames.flatMap((cls) => {
    const parts = data.splits[cls];
    if (parts && parts.length >= 2) {
      const splitSum = parts.reduce((s, v) => s + (parseInt(v) || 0), 0);
      return [
        `<tr style="background:#fff8e1"><td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;font-weight:bold">${esc(cls)}</td><td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;text-align:center;font-weight:bold">${esc(String(plannedByClass[cls]))}</td><td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;text-align:center">${esc(data.actual[cls])}</td></tr>`,
        ...parts.map((count, pi) => `<tr style="background:#fffde7"><td style="padding:2px 6px 2px 16px;border:1px solid #ddd;font-size:8.5px;color:#666">${PART_LABELS[pi]}</td><td style="padding:2px 6px;border:1px solid #ddd;font-size:8.5px;text-align:center">${count || "—"}</td><td style="border:1px solid #ddd"></td></tr>`),
        splitSum > 0 && splitSum !== plannedByClass[cls]
          ? `<tr style="background:#fff3cd"><td colspan="3" style="padding:2px 8px;font-size:8px;color:#856404;border:1px solid #ddd">סה״כ חלקים: ${splitSum} ${splitSum > plannedByClass[cls] ? "⚠ חורג" : ""}</td></tr>`
          : "",
      ].filter(Boolean) as string[];
    }
    return [`<tr><td style="padding:3px 6px;border:1px solid #ddd;font-size:9px">${esc(cls)}</td><td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;text-align:center;font-weight:bold">${esc(String(plannedByClass[cls]))}</td><td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;text-align:center">${esc(data.actual[cls])}</td></tr>`];
  }).join("") || `<tr><td colspan="3" style="padding:6px;color:#aaa;text-align:center;font-size:9px">אין נתוני תלמידים</td></tr>`;

  const totalStudents = data.buses.reduce((s, b) => s + busStudentCount(b), 0);
  const totalEscorts  = data.buses.reduce((s, b) => s + calcEscorts(b), 0);
  const summaryRows = [
    ["תלמידים", String(totalStudents || "")],
    ["מורים ומלווים", String(totalEscorts || "")],
    ['סה"כ נוכחים', String(totalStudents + totalEscorts || "")],
  ].map(([label, val], i) => `<tr style="${i === 2 ? "font-weight:bold;background:#d4edda" : ""}"><td style="padding:3px 8px;border:1px solid #ccc;font-size:9px">${label}</td><td style="padding:3px 8px;border:1px solid #ccc;font-size:9px;text-align:center;width:50px">${val}</td></tr>`).join("");

  return `
    <div class="header">
      <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
      <div class="title">נספח ו׳ — טבלת שליטה בטיול</div>
      ${trip ? `<div class="ministry">${esc(trip.name)} | ${esc(trip.schoolName)}</div>` : ""}
    </div>
    ${n === 0 ? `<p style="color:#aaa;font-size:10px;text-align:center">לא הוזנו אוטובוסים</p>` : `
    <table>
      <thead><tr>
        <th style="padding:5px 6px;border:1px solid #999;font-size:9px;background:#1b4332;color:white;min-width:90px"></th>
        ${busHeaders}
      </tr></thead>
      <tbody>
        <tr style="background:#e8f5e9">
          <td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;font-weight:bold">כיתות</td>
          ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center">${b.classSelections.filter(Boolean).map((sel) => isSplitSel(sel) ? splitLabel(...parseSplit(sel)) : sel).join(", ")}</td>`).join("")}
        </tr>
        ${crewRows}${extraRows}
        <tr style="background:#e8f5e9">
          <td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;font-weight:bold">מספר תלמידים</td>
          ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center;font-weight:bold">${busStudentCount(b) || ""}</td>`).join("")}
        </tr>
        <tr>
          <td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;font-weight:bold">מספר מלווים</td>
          ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center">${calcEscorts(b) || ""}</td>`).join("")}
        </tr>
        <tr style="background:#d4edda;font-weight:bold">
          <td style="padding:4px 6px;border:1px solid #ccc;font-size:9px">סה"כ באוטובוס</td>
          ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center;font-weight:bold">${(busStudentCount(b) + calcEscorts(b)) || ""}</td>`).join("")}
        </tr>
      </tbody>
    </table>`}
    <div style="display:flex;gap:20px;margin-top:12px;align-items:flex-start">
      <div>
        <div class="section-title">סיכום לפי כיתה</div>
        <table style="width:auto">
          <thead><tr><th style="width:110px">כיתה</th><th style="width:65px;text-align:center">מתוכנן</th><th style="width:65px;text-align:center">בפועל</th></tr></thead>
          <tbody>${classRows}</tbody>
        </table>
      </div>
      <div>
        <div class="section-title">סיכום כללי</div>
        <table style="width:auto">
          <thead><tr><th>קטגוריה</th><th style="width:60px;text-align:center">מספר</th></tr></thead>
          <tbody>${summaryRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ─── Appendix ז ──────────────────────────────────────────────────────────────

export function buildZayin(students: Student[], trip: Trip | null): string {
  const going = students.filter((s) => s.isGoing);
  const boys  = going.filter((s) => s.gender === "male").length;
  const girls = going.filter((s) => s.gender === "female").length;
  let rows = "";
  let lastClass = "";
  let rowInClass = 0;
  for (const s of going) {
    if (s.class !== lastClass) {
      const count = going.filter((x) => x.class === s.class).length;
      rows += `<tr class="cat-row"><td colspan="5" style="background:#1b4332;color:white;font-size:10px;font-weight:bold;padding:4px 8px">כיתה ${esc(s.class)} — ${count} תלמידים</td></tr>`;
      lastClass = s.class;
      rowInClass = 0;
    }
    const gender = s.gender === "male" ? "זכר" : s.gender === "female" ? "נקבה" : "";
    rows += `<tr style="${rowInClass % 2 === 0 ? "" : "background:#f0f7f4"}">
      <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px">${esc(s.lastName)}</td>
      <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px">${esc(s.firstName)}</td>
      <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;text-align:center">${esc(s.class)}</td>
      <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;text-align:center">${esc(gender)}</td>
      <td style="padding:3px 6px;border:1px solid #ddd;font-size:10px;direction:ltr">${esc(s.phone)}</td>
    </tr>`;
    rowInClass++;
  }
  return `
    <div class="header">
      <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
      <div class="title">נספח ז׳ — רשימת תלמידים (יוצאים)</div>
      <div class="ministry">${esc(trip?.name ?? "")} | ${esc(trip?.schoolName ?? "")}</div>
    </div>
    <div class="meta">
      <span>סה"כ יוצאים: <strong>${going.length}</strong></span>
      <span>בנים: <strong>${boys}</strong></span>
      <span>בנות: <strong>${girls}</strong></span>
    </div>
    <table>
      <thead><tr>
        <th>שם משפחה</th><th>שם פרטי</th>
        <th style="width:60px;text-align:center">כיתה</th>
        <th style="width:55px;text-align:center">מין</th>
        <th style="width:90px">טלפון</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">רשימה זו מהווה 3 עותקים: אחראי הטיול / אחראי אוטובוס וכיתה / מזכירות ביה"ס</div>`;
}

// ─── Appendix ח ──────────────────────────────────────────────────────────────

type ChetData = { mode: string; text: string; url: string; fileUrl: string };

export function buildChet(data: ChetData): string | null {
  if (data.mode === "text" && data.text.trim()) {
    return `
      <div class="header">
        <div class="title">נספח ח׳ — אישור הורים על השתתפות והצהרת בריאות</div>
      </div>
      <div class="letter-body" style="white-space:pre-wrap">${esc(data.text)}</div>`;
  }
  return null; // file/url mode — can't embed in HTML
}

// ─── Appendix ט ──────────────────────────────────────────────────────────────

type TetItem = { id: string; text: string };

export function buildTet(items: TetItem[], trip: Trip | null): string {
  const rows = items.filter((it) => it.text.trim()).map((it, i) => `
    <tr style="${i % 2 === 0 ? "" : "background:#f0f7f4"}">
      <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px;text-align:center;width:36px">${i + 1}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;font-size:11px">${esc(it.text)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;width:50px;text-align:center"></td>
    </tr>`).join("");
  return `
    <div class="header">
      <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
      <div class="title">נספח ט׳ — ציוד חובה לטיול</div>
      ${trip ? `<div class="ministry">${esc(trip.name)} | ${esc(trip.schoolName)}</div>` : ""}
    </div>
    <table>
      <thead><tr>
        <th style="width:36px;text-align:center">מס׳</th>
        <th style="text-align:right">פריט ציוד</th>
        <th style="width:50px;text-align:center">✓</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── Appendix י ──────────────────────────────────────────────────────────────

type YodRow = { id: string; lastName: string; firstName: string; class: string; issue: string; notes: string };

export function buildYod(rows: YodRow[], trip: Trip | null): string {
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
    <div class="footer">מסמך זה הינו סודי — לעיון אחראי הטיול והצוות הרפואי בלבד</div>`;
}

// ─── Combined print ───────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Frank Ruhl Libre', 'Times New Roman', serif; direction: rtl; text-align: right;
         padding: 20px; font-size: 11px; color: #111; background: #fff; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: right; font-size: 10px; }
  th { background: #1b4332; color: white; font-weight: 600; }
  .cat-row td { background: #d4edda; font-weight: bold; font-size: 10.5px; }
  .header { text-align: center; border-bottom: 2px solid #1b4332; padding-bottom: 8px; margin-bottom: 12px; }
  .header .ministry { font-size: 8px; color: #555; }
  .header .title { font-size: 15px; font-weight: bold; margin-top: 4px; }
  .footer { font-size: 8px; color: #888; margin-top: 8px; border-top: 1px solid #ccc; padding-top: 6px; }
  .meta { display: flex; gap: 24px; font-size: 9.5px; margin-bottom: 8px; }
  .section-title { font-weight: bold; font-size: 12px; margin: 14px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  .letter-body { border: 1px solid #ddd; border-radius: 6px; padding: 16px 20px; line-height: 2.2; font-size: 12px; margin: 10px 0; }
  .appendix-section { page-break-after: always; padding-bottom: 16px; }
  .appendix-section:last-child { page-break-after: auto; }
  @media print { body { padding: 10px; } @page { margin: 10mm; } }
`;

export function openTripPrintWindow(sections: string[], title: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const body = sections.map((s) => `<div class="appendix-section">${s}</div>`).join("");
  win.document.write(`<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"/><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 800);
}

export { pageBreak };

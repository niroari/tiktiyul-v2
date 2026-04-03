"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { useStudents } from "@/hooks/use-students";
import { useTrip } from "@/hooks/use-trip";

// ── Types ────────────────────────────────────────────────────────────────────

type ScheduleRow = {
  day: string; date: string; startTime: string; from: string;
  route: string; endTime: string; evac1: string; evac2: string;
  stay: string; evening: string;
};

type RoleRow = { name: string; id: string; phone: string; cert: string };

type MasaData = {
  date: string; district: string; principal: string;
  departDate: string; departTime: string; classes: string;
  returnDate: string; area: string;
  totalStudents: string; males: string; females: string;
  gatherPlace: string; gatherTime: string;
  dispersal: "a" | "b" | "c" | "d"; dispersalOther: string;
  leader: string; guideCount: string; guideCompany: string;
  briefingDate: string;
  contentLine1: string; contentLine2: string;
  adminLine1: string; adminLine2: string;
  busCount: string; busCompany: string; busTel: string; busAttached: string;
  securityDate: string;
  scheduleRows: ScheduleRow[];
  alternatives: string;
  roles: RoleRow[];
};

function emptyScheduleRow(): ScheduleRow {
  return { day: "", date: "", startTime: "", from: "", route: "", endTime: "", evac1: "", evac2: "", stay: "", evening: "" };
}
function emptyRole(): RoleRow {
  return { name: "", id: "", phone: "", cert: "" };
}
function defaultMasa(): MasaData {
  return {
    date: "", district: "", principal: "",
    departDate: "", departTime: "", classes: "",
    returnDate: "", area: "",
    totalStudents: "", males: "", females: "",
    gatherPlace: "", gatherTime: "",
    dispersal: "a", dispersalOther: "",
    leader: "", guideCount: "", guideCompany: "",
    briefingDate: "",
    contentLine1: "", contentLine2: "",
    adminLine1: "", adminLine2: "",
    busCount: "", busCompany: "", busTel: "", busAttached: "",
    securityDate: "",
    scheduleRows: Array(7).fill(null).map(emptyScheduleRow),
    alternatives: "",
    roles: Array(6).fill(null).map(emptyRole),
  };
}

function formatDateDDMMYY(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1].slice(2)}`;
  return iso;
}

// ── Page builders (same coordinate system as original — 842×596px) ───────────

function esc(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function cell(x0:number,y0:number,x1:number,y1:number,val:string,align="right",fs=9,dir="rtl") {
  if (!val && val !== "0") return "";
  return `<div style="position:absolute;left:${x0}px;top:${y0}px;width:${x1-x0}px;height:${y1-y0}px;background:white;font-family:Arial,sans-serif;font-size:${fs}px;direction:${dir};text-align:${align};display:flex;align-items:center;padding:0 2px;overflow:hidden;white-space:nowrap;color:#111">${esc(val)}</div>`;
}

function buildPage1(d: MasaData) {
  const DISP: Record<string,[number,number,number,number]> = {
    a:[795,369,807,382], b:[647,369,660,382], c:[790,383,802,396], d:[688,383,700,396],
  };
  const dp = DISP[d.dispersal] ?? DISP.a;
  const mark = `<div style="position:absolute;left:${dp[0]}px;top:${dp[1]}px;width:${dp[2]-dp[0]}px;height:${dp[3]-dp[1]}px;border:2px solid #1b4332;border-radius:2px;background:rgba(45,106,79,0.2)"></div>`;

  return `<div style="width:842px;height:596px;position:relative;overflow:hidden;background:#fff;flex-shrink:0">
    <img src="/masa-p1.jpg" style="position:absolute;left:0;top:0;width:842px;height:596px" crossOrigin="anonymous">
    ${cell(36,130,91,141,d.date)}
    ${cell(611,147,683,158,d.district)}
    ${cell(616,164,705,175,d.principal)}
    ${cell(719,297,775,308,d.departDate)}
    ${cell(658,297,693,308,d.departTime,"center")}
    ${cell(554,297,599,308,d.classes,"center")}
    ${cell(691,311,736,322,d.returnDate)}
    ${cell(463,311,651,322,d.area)}
    ${cell(672,334,727,345,d.totalStudents,"center")}
    ${cell(581,334,648,345,d.males,"center")}
    ${cell(748,334,800,345,d.females,"center")}
    ${cell(581,356,697,367,d.gatherPlace)}
    ${cell(464,356,553,367,d.gatherTime,"center")}
    ${mark}
    ${d.dispersal==="d" ? cell(466,384,643,395,d.dispersalOther) : ""}
    ${cell(467,407,566,418,d.leader)}
    ${cell(465,429,554,440,d.guideCount,"center")}
    ${cell(567,443,728,454,d.guideCompany)}
    ${cell(72,324,116,335,d.briefingDate,"center",8)}
    ${cell(54,392,343,403,d.contentLine1,"right",8)}
    ${cell(54,406,343,417,d.contentLine2,"right",8)}
    ${cell(57,428,334,439,d.adminLine1,"right",8)}
    ${cell(56,442,333,453,d.adminLine2,"right",8)}
    ${cell(295,465,339,476,d.busCount,"center")}
    ${cell(155,465,210,476,d.busCompany,"right",8)}
    ${cell(59,465,150,476,d.busTel,"center",8)}
    ${cell(286,479,352,490,d.busAttached,"center")}
    ${cell(251,515,340,526,d.securityDate,"center",8)}
  </div>`;
}

function buildPage2(d: MasaData) {
  const sY: [number,number][] = [[115,131],[131,148],[148,164],[164,180],[180,196],[196,212],[212,228]];
  let sch = "";
  d.scheduleRows.forEach((r, i) => {
    if (i >= 7) return;
    const [y0,y1] = sY[i];
    sch += cell(777,y0,805,y1,r.day,"center",7)
          +cell(728,y0,777,y1,r.date,"center",7)
          +cell(679,y0,728,y1,r.startTime,"center",7)
          +cell(628,y0,679,y1,r.from,"center",7)
          +cell(397,y0,628,y1,r.route,"right",7)
          +cell(327,y0,397,y1,r.endTime,"center",7)
          +cell(287,y0,327,y1,r.evac1,"center",6)
          +cell(246,y0,287,y1,r.evac2,"center",6)
          +cell(156,y0,246,y1,r.stay,"center",6)
          +cell(35,y0,156,y1,r.evening,"right",6);
  });

  const alt = d.alternatives
    ? `<div style="position:absolute;left:35px;top:252px;width:768px;height:86px;background:white;font-family:Arial,sans-serif;font-size:8px;direction:rtl;text-align:right;padding:4px 6px;overflow:hidden;color:#111;line-height:1.6;white-space:pre-wrap">${esc(d.alternatives)}</div>`
    : "";

  const rY: [number,number][] = [[399,416],[416,432],[432,448],[448,464],[464,480],[480,496]];
  let roles = "";
  d.roles.forEach((r, i) => {
    const [y0,y1] = rY[i];
    roles += cell(628,y0,728,y1,r.name,"right",8)
            +cell(456,y0,628,y1,r.id,"center",8,"ltr")
            +cell(336,y0,456,y1,r.phone,"center",8,"ltr")
            +(i>=2 ? cell(35,y0,336,y1,r.cert,"right",8) : "");
  });

  return `<div style="width:842px;height:596px;position:relative;overflow:hidden;background:#fff;flex-shrink:0">
    <img src="/masa-p2.jpg" style="position:absolute;left:0;top:0;width:842px;height:596px" crossOrigin="anonymous">
    ${sch}
    ${alt}
    ${roles}
    ${cell(637,511,764,523,d.date,"center",9)}
    ${cell(303,511,430,523,d.leader,"right",8)}
    ${cell(60,511,187,523,d.principal,"right",8)}
  </div>`;
}

// ── Component ────────────────────────────────────────────────────────────────

const DISPERSAL_OPTIONS = [
  { value: "a" as const, label: "א. בבית הספר" },
  { value: "b" as const, label: "ב. בתוך היישוב" },
  { value: "c" as const, label: "ג. פיזור למושבים" },
  { value: "d" as const, label: "ד. אחר" },
];

const ROLE_TITLES = ["אחראי", "סגן", "חובש", "מדריך עזר", "מדריך עזר", "מדריך עזר"];

export function MasaClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { students } = useStudents(tripId);
  const { trip }     = useTrip(tripId);

  const [data, setData]     = useState<MasaData>(defaultMasa());
  const [status, setStatus] = useState<"idle"|"saving"|"saved">("idle");
  const [printing, setPrinting] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const isPending = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "masa", (raw) => {
      if (isPending.current) return;
      if (raw?.masa) {
        const saved = raw.masa as Partial<MasaData>;
        setData((prev) => ({
          ...prev,
          ...saved,
          scheduleRows: (saved.scheduleRows ?? prev.scheduleRows),
          roles:        (saved.roles        ?? prev.roles),
        }));
      }
    });
    return () => unsub();
  }, [tripId]);

  // Pre-fill from trip + students when they load
  useEffect(() => {
    if (!trip && students.length === 0) return;
    setData((prev) => {
      const going  = students.filter((s) => s.isGoing);
      const boys   = going.filter((s) => s.gender === "male").length;
      const girls  = going.filter((s) => s.gender === "female").length;
      const today  = new Date();
      const todayStr = `${String(today.getDate()).padStart(2,"0")}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getFullYear()).slice(2)}`;
      const classes  = [...new Set(going.map((s) => s.class).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"he")).join(", ");

      return {
        ...prev,
        date:          prev.date          || todayStr,
        principal:     prev.principal     || trip?.schoolName || "",
        departDate:    prev.departDate    || (trip?.startDate ? formatDateDDMMYY(trip.startDate) : ""),
        returnDate:    prev.returnDate    || (trip?.endDate   ? formatDateDDMMYY(trip.endDate)   : ""),
        area:          prev.area          || trip?.accommodation || "",
        classes:       prev.classes       || classes,
        totalStudents: prev.totalStudents || String(going.length  || ""),
        males:         prev.males         || String(boys  || ""),
        females:       prev.females       || String(girls || ""),
      };
    });
  }, [trip, students]);

  // ── Save ────────────────────────────────────────────────────────────────────

  function scheduleAutoSave(updated: MasaData) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "masa", { masa: updated });
      isPending.current = false;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function update(patch: Partial<MasaData>) {
    setData((prev) => {
      const updated = { ...prev, ...patch };
      scheduleAutoSave(updated);
      return updated;
    });
  }

  function updateScheduleRow(i: number, patch: Partial<ScheduleRow>) {
    const rows = data.scheduleRows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    update({ scheduleRows: rows });
  }

  function updateRole(i: number, patch: Partial<RoleRow>) {
    const roles = data.roles.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    update({ roles });
  }

  // ── Print ───────────────────────────────────────────────────────────────────

  async function handlePrint() {
    setPrinting(true);
    // Small delay so React can render the preview div
    await new Promise((r) => setTimeout(r, 100));

    try {
      const h2c = (await import("html2canvas-pro")).default;
      const container = previewRef.current;
      if (!container) return;

      const pages = Array.from(container.children) as HTMLElement[];
      const canvases = await Promise.all(
        pages.map((el) => h2c(el, { scale: 2, useCORS: true, backgroundColor: "#fff" }))
      );

      const win = window.open("", "_blank");
      if (!win) return;

      const imgs = canvases.map((c) => `<img src="${c.toDataURL("image/jpeg",0.95)}" style="display:block;width:297mm;height:210mm;page-break-after:always">`).join("");
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>הודעת מסע</title>
        <style>@page{size:A4 landscape;margin:0}body{margin:0}img{display:block}</style>
        </head><body>${imgs}</body></html>`);
      win.document.close();
      win.onload = () => { win.print(); };
    } catch (e) {
      console.error("print failed", e);
    } finally {
      setPrinting(false);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const inputCls = "w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2 focus:outline-none focus:border-primary";
  const labelCls = "text-xs font-medium text-muted-foreground";

  function Field({ label, value, onChange, placeholder, dir }: {
    label: string; value: string; onChange: (v:string)=>void; placeholder?: string; dir?: string;
  }) {
    return (
      <div className="space-y-1">
        <label className={labelCls}>{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir}
          className={inputCls}
        />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">הודעת מסע של"ח</h1>
          <p className="text-sm text-muted-foreground mt-0.5">טופס הודעה רשמי למינהל חברה ונוער</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
            {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
          </span>
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {printing ? "מכין..." : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                הדפס / PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Section 1: Header ─────────────────────────────────────────────── */}
      <Section title="פרטי הכותרת">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="תאריך" value={data.date} onChange={(v) => update({ date: v })} placeholder="DD.MM.YY" />
          <Field label='אל תחום של"ח – מחוז' value={data.district} onChange={(v) => update({ district: v })} />
          <Field label="מאת (שם בית הספר)" value={data.principal} onChange={(v) => update({ principal: v })} />
        </div>
      </Section>

      {/* ── Section 2: Trip details ───────────────────────────────────────── */}
      <Section title="פרטי הטיול">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="תאריך יציאה" value={data.departDate} onChange={(v) => update({ departDate: v })} placeholder="DD.MM.YY" />
          <Field label="שעת יציאה" value={data.departTime} onChange={(v) => update({ departTime: v })} placeholder="06:30" />
          <Field label="כיתות" value={data.classes} onChange={(v) => update({ classes: v })} />
          <Field label="תאריך חזרה" value={data.returnDate} onChange={(v) => update({ returnDate: v })} placeholder="DD.MM.YY" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Field label="אזור" value={data.area} onChange={(v) => update({ area: v })} />
        </div>
      </Section>

      {/* ── Section 3: Students & gathering ──────────────────────────────── */}
      <Section title="תלמידים והתארגנות">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Field label="מספר תלמידים" value={data.totalStudents} onChange={(v) => update({ totalStudents: v })} />
          <Field label="מהם בנים" value={data.males} onChange={(v) => update({ males: v })} />
          <Field label="בנות" value={data.females} onChange={(v) => update({ females: v })} />
          <Field label="מקום התארגנות" value={data.gatherPlace} onChange={(v) => update({ gatherPlace: v })} />
          <Field label="שעת התארגנות" value={data.gatherTime} onChange={(v) => update({ gatherTime: v })} placeholder="06:30" />
        </div>
        <div className="mt-4 space-y-2">
          <label className={labelCls}>פיזור בסיום הטיול</label>
          <div className="flex flex-wrap gap-4">
            {DISPERSAL_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name="dispersal" value={opt.value}
                  checked={data.dispersal === opt.value}
                  onChange={() => update({ dispersal: opt.value })}
                  className="accent-primary"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {data.dispersal === "d" && (
            <input type="text" value={data.dispersalOther} onChange={(e) => update({ dispersalOther: e.target.value })}
              placeholder="פרט..." className={inputCls + " max-w-sm mt-2"} />
          )}
        </div>
      </Section>

      {/* ── Section 4: Leadership ─────────────────────────────────────────── */}
      <Section title="הנהגה והדרכה">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="אחראי/ת על המסע" value={data.leader} onChange={(v) => update({ leader: v })} />
          <Field label="מספר מדריכים נוספים" value={data.guideCount} onChange={(v) => update({ guideCount: v })} />
          <Field label="חברת הדרכה" value={data.guideCompany} onChange={(v) => update({ guideCompany: v })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Field label="תאריך תדרוך צוות" value={data.briefingDate} onChange={(v) => update({ briefingDate: v })} placeholder="DD.MM.YY" />
        </div>
      </Section>

      {/* ── Section 5: Content & admin (left-column fields on the form) ───── */}
      <Section title="תוכן ואדמינ׳">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={labelCls}>תוכן המסע</label>
            <input type="text" value={data.contentLine1} onChange={(e) => update({ contentLine1: e.target.value })} placeholder="שורה 1" className={inputCls} />
            <input type="text" value={data.contentLine2} onChange={(e) => update({ contentLine2: e.target.value })} placeholder="שורה 2" className={inputCls} />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>פרטים אדמיניסטרטיביים</label>
            <input type="text" value={data.adminLine1} onChange={(e) => update({ adminLine1: e.target.value })} placeholder="שורה 1" className={inputCls} />
            <input type="text" value={data.adminLine2} onChange={(e) => update({ adminLine2: e.target.value })} placeholder="שורה 2" className={inputCls} />
          </div>
        </div>
      </Section>

      {/* ── Section 6: Transport ──────────────────────────────────────────── */}
      <Section title="הסעות">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="מספר אוטובוסים" value={data.busCount} onChange={(v) => update({ busCount: v })} />
          <Field label="חברת הסעה" value={data.busCompany} onChange={(v) => update({ busCompany: v })} />
          <Field label="טלפון חברה" value={data.busTel} onChange={(v) => update({ busTel: v })} dir="ltr" />
          <Field label="מתוכם צמודים" value={data.busAttached} onChange={(v) => update({ busAttached: v })} />
        </div>
        <div className="mt-4 max-w-xs">
          <Field label="תאריך בקשת אישור ביטחוני" value={data.securityDate} onChange={(v) => update({ securityDate: v })} placeholder="DD.MM.YY" />
        </div>
      </Section>

      {/* ── Section 7: Schedule ───────────────────────────────────────────── */}
      <Section title="לוח זמנים יומי">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-muted">
              <tr>
                {["יום","תאריך","שעת יציאה","מנקודת ריכוז","מסלול","שעת סיום","פינוי 1","פינוי 2","לינה","ערב"].map((h) => (
                  <th key={h} className="border border-border px-2 py-1.5 text-center font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.scheduleRows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  {(["day","date","startTime","from","route","endTime","evac1","evac2","stay","evening"] as (keyof ScheduleRow)[]).map((field) => (
                    <td key={field} className="border border-border p-0">
                      <input
                        type="text"
                        value={row[field]}
                        onChange={(e) => updateScheduleRow(i, { [field]: e.target.value })}
                        className={`w-full text-xs px-2 py-1.5 bg-transparent focus:outline-none focus:bg-primary/5 ${
                          field === "day" ? "min-w-[36px]" :
                          field === "date" ? "min-w-[60px]" :
                          field === "route" ? "min-w-[160px]" : "min-w-[56px]"
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Section 8: Alternatives ───────────────────────────────────────── */}
      <Section title="תוכניות חלופיות">
        <textarea
          value={data.alternatives}
          onChange={(e) => update({ alternatives: e.target.value })}
          rows={3}
          placeholder="תאר/י תוכניות חלופיות במקרה גשם / מצב ביטחוני..."
          className="w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2 focus:outline-none focus:border-primary resize-y"
          dir="rtl"
        />
      </Section>

      {/* ── Section 9: Roles ──────────────────────────────────────────────── */}
      <Section title="בעלי תפקידים במסע">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted">
              <tr>
                <th className="border border-border px-3 py-2 text-right font-medium text-muted-foreground">תפקיד</th>
                <th className="border border-border px-3 py-2 text-right font-medium text-muted-foreground">שם</th>
                <th className="border border-border px-3 py-2 text-right font-medium text-muted-foreground">ת.ז.</th>
                <th className="border border-border px-3 py-2 text-right font-medium text-muted-foreground">טלפון</th>
                <th className="border border-border px-3 py-2 text-right font-medium text-muted-foreground">מס׳ תעודה</th>
              </tr>
            </thead>
            <tbody>
              {data.roles.map((role, i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="border border-border px-3 py-1.5 font-medium whitespace-nowrap">{ROLE_TITLES[i]}</td>
                  {(["name","id","phone"] as const).map((field) => (
                    <td key={field} className="border border-border p-0">
                      <input type="text" value={role[field]} onChange={(e) => updateRole(i, { [field]: e.target.value })}
                        dir={field === "id" || field === "phone" ? "ltr" : "rtl"}
                        className="w-full text-sm px-3 py-1.5 bg-transparent focus:outline-none focus:bg-primary/5 min-w-[100px]" />
                    </td>
                  ))}
                  <td className="border border-border p-0">
                    {i >= 2 ? (
                      <input type="text" value={role.cert} onChange={(e) => updateRole(i, { cert: e.target.value })}
                        className="w-full text-sm px-3 py-1.5 bg-transparent focus:outline-none focus:bg-primary/5 min-w-[100px]" />
                    ) : (
                      <span className="px-3 text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Hidden print preview — rendered off-screen, captured by html2canvas */}
      {printing && (
        <div
          ref={previewRef}
          style={{ position: "fixed", left: "-9999px", top: 0, display: "flex", flexDirection: "column", gap: 0 }}
          dangerouslySetInnerHTML={{ __html: buildPage1(data) + buildPage2(data) }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-3">
      <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">{title}</h2>
      {children}
    </div>
  );
}

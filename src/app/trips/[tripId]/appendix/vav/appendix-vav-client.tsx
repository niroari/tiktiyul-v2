"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { useTrip } from "@/hooks/use-trip";
import { useStudents } from "@/hooks/use-students";
import { useStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { AppendixActions } from "@/components/appendix-actions";

// ─── Constants ────────────────────────────────────────────────────────────────

const CREW_ROLES = ["מורה אחראי/ת", "מורה נוסף", "נהג", "מאבטח/חובש", "מדריך"];
const STAFF_DROPDOWN_LIMIT = 2; // first N roles use staff dropdown
const PART_LABELS = ["חלק א׳", "חלק ב׳", "חלק ג׳"];

// Encoded class selection value for a split part: "className|partIndex"
function splitKey(cls: string, part: number) { return `${cls}|${part}`; }
function isSplitSel(sel: string) { return sel.includes("|"); }
function parseSplit(sel: string): [string, number] {
  const idx = sel.lastIndexOf("|");
  return [sel.slice(0, idx), parseInt(sel.slice(idx + 1))];
}
function splitLabel(cls: string, part: number) { return `${cls} — ${PART_LABELS[part]}`; }

// ─── Types ────────────────────────────────────────────────────────────────────

type CrewMember    = { name: string; phone: string };
type ExtraTeacher  = { role: "מורה" | "מלווה"; name: string; phone: string };

type Bus = {
  id: string;
  classSelections: string[]; // up to 3 slots; value is class name OR splitKey
  crew: CrewMember[];        // length = CREW_ROLES.length
  extraTeachers: ExtraTeacher[];
};

type VavData = {
  buses:  Bus[];
  actual: Record<string, string>;   // class name → actual head count (whole class)
  splits: Record<string, string[]>; // class name → [count_part0, count_part1, ...]
};

function makeBus(): Bus {
  return {
    id: crypto.randomUUID(),
    classSelections: ["", "", ""],
    crew: CREW_ROLES.map(() => ({ name: "", phone: "" })),
    extraTeachers: [],
  };
}

function calcEscorts(bus: Bus): number {
  return bus.crew.filter((c) => c.name.trim()).length
    + bus.extraTeachers.filter((e) => e.name.trim()).length;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AppendixVavClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip }     = useTrip(tripId);
  const { students } = useStudents(tripId);
  const { staff }    = useStaff(tripId);

  const [data, setData]     = useState<VavData>({ buses: [], actual: {}, splits: {} });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "vav", (raw) => {
      if (raw?.buses) {
        setData({
          buses: (raw.buses as Bus[]).map((b) => ({
            ...b,
            crew:            b.crew            ?? CREW_ROLES.map(() => ({ name: "", phone: "" })),
            extraTeachers:   b.extraTeachers   ?? [],
            classSelections: b.classSelections ?? ["", "", ""],
          })),
          actual: (raw.actual as Record<string, string>)   ?? {},
          splits: (raw.splits as Record<string, string[]>) ?? {},
        });
      }
    });
    return () => unsub();
  }, [tripId]);

  // ── Save ───────────────────────────────────────────────────────────────────

  function save(updated: VavData) {
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "vav", updated as unknown as Record<string, unknown>);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function update(updated: VavData) { setData(updated); save(updated); }

  // ── Bus mutations ──────────────────────────────────────────────────────────

  function addBus() { update({ ...data, buses: [...data.buses, makeBus()] }); }

  function deleteBus(i: number) {
    update({ ...data, buses: data.buses.filter((_, j) => j !== i) });
  }

  function setBusClass(busIdx: number, slotIdx: number, val: string) {
    const buses = data.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const cs = [...b.classSelections];
      cs[slotIdx] = val;
      return { ...b, classSelections: cs };
    });
    update({ ...data, buses });
  }

  function setCrewField(busIdx: number, roleIdx: number, field: "name" | "phone", val: string) {
    const buses = data.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const crew = b.crew.map((c, ri) => ri === roleIdx ? { ...c, [field]: val } : c);
      return { ...b, crew };
    });
    update({ ...data, buses });
  }

  function selectStaff(busIdx: number, roleIdx: number, name: string) {
    const member = staff.find((s) => s.name === name);
    const buses = data.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const crew = b.crew.map((c, ri) =>
        ri === roleIdx ? { name, phone: member?.phone ?? c.phone } : c
      );
      return { ...b, crew };
    });
    update({ ...data, buses });
  }

  function addExtraTeacher(busIdx: number) {
    const buses = data.buses.map((b, i) =>
      i === busIdx
        ? { ...b, extraTeachers: [...b.extraTeachers, { role: "מורה" as const, name: "", phone: "" }] }
        : b
    );
    update({ ...data, buses });
  }

  function removeExtraTeacher(busIdx: number, ti: number) {
    const buses = data.buses.map((b, i) =>
      i === busIdx ? { ...b, extraTeachers: b.extraTeachers.filter((_, j) => j !== ti) } : b
    );
    update({ ...data, buses });
  }

  function setExtraTeacher(busIdx: number, ti: number, field: keyof ExtraTeacher, val: string) {
    const buses = data.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const extraTeachers = b.extraTeachers.map((e, j) => {
        if (j !== ti) return e;
        if (field === "name") {
          const member = staff.find((s) => s.name === val);
          return { ...e, name: val, phone: member?.phone ?? e.phone };
        }
        return { ...e, [field]: val };
      });
      return { ...b, extraTeachers };
    });
    update({ ...data, buses });
  }

  // ── Class / split mutations ────────────────────────────────────────────────

  function setActual(cls: string, val: string) {
    update({ ...data, actual: { ...data.actual, [cls]: val } });
  }

  function splitClass(cls: string) {
    const splits = { ...data.splits, [cls]: ["", ""] };
    update({ ...data, splits });
  }

  function unsplitClass(cls: string) {
    const splits = { ...data.splits };
    delete splits[cls];
    // clear any bus slot that referenced a split part of this class
    const buses = data.buses.map((b) => ({
      ...b,
      classSelections: b.classSelections.map((sel) => {
        if (isSplitSel(sel) && parseSplit(sel)[0] === cls) return "";
        return sel;
      }),
    }));
    update({ ...data, splits, buses });
  }

  function setSplitCount(cls: string, partIdx: number, val: string) {
    const parts = [...(data.splits[cls] ?? [])];
    parts[partIdx] = val;
    update({ ...data, splits: { ...data.splits, [cls]: parts } });
  }

  function addSplitPart(cls: string) {
    const parts = [...(data.splits[cls] ?? [])];
    if (parts.length >= 3) return;
    parts.push("");
    update({ ...data, splits: { ...data.splits, [cls]: parts } });
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const goingStudents = students.filter((s) => s.isGoing);

  const plannedByClass: Record<string, number> = {};
  goingStudents.forEach((s) => {
    plannedByClass[s.class] = (plannedByClass[s.class] ?? 0) + 1;
  });
  const classNames = Object.keys(plannedByClass).sort((a, b) => a.localeCompare(b, "he"));

  function busStudentCount(bus: Bus): number {
    return bus.classSelections.filter(Boolean).reduce((sum, sel) => {
      if (isSplitSel(sel)) {
        const [cls, part] = parseSplit(sel);
        return sum + (parseInt(data.splits[cls]?.[part] ?? "0") || 0);
      }
      return sum + (plannedByClass[sel] ?? 0);
    }, 0);
  }

  const totalStudents = data.buses.reduce((s, b) => s + busStudentCount(b), 0);
  const totalEscorts  = data.buses.reduce((s, b) => s + calcEscorts(b), 0);

  // All options for the bus class selector: whole classes + split parts
  const tripClasses = trip?.classes?.map((c) => c.name) ?? [];

  function classOptions() {
    const opts: { value: string; label: string }[] = [];
    tripClasses.forEach((cls) => {
      const parts = data.splits[cls];
      if (parts && parts.length >= 2) {
        parts.forEach((_, pi) => opts.push({ value: splitKey(cls, pi), label: splitLabel(cls, pi) }));
      } else {
        opts.push({ value: cls, label: cls });
      }
    });
    return opts;
  }

  // ── Print HTML ─────────────────────────────────────────────────────────────

  function getHTML() {
    const t = trip;
    const n = data.buses.length;

    const busHeaders = data.buses.map((b, bi) => {
      const labels = b.classSelections.filter(Boolean).map((sel) =>
        isSplitSel(sel) ? splitLabel(...parseSplit(sel)) : sel
      ).join(", ");
      const sc = busStudentCount(b);
      return `<th style="padding:5px 6px;border:1px solid #999;font-size:9px;font-weight:bold;background:#1b4332;color:white;text-align:center;min-width:110px">
        אוטובוס ${bi + 1}${labels ? `<br><span style="font-weight:normal">${labels}</span>` : ""}${sc ? `<br><span style="font-weight:normal;font-size:8px">${sc} תלמידים</span>` : ""}
      </th>`;
    }).join("");

    const crewRows = CREW_ROLES.map((role, ri) => `
      <tr style="background:#d4edda">
        <td colspan="${n + 1}" style="padding:3px 6px;border:1px solid #bbb;font-size:9px;font-weight:bold;color:#1b4332">${role}</td>
      </tr>
      <tr>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8px;color:#555;background:#f9f9f9">שם</td>
        ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center">${b.crew[ri]?.name ?? ""}</td>`).join("")}
      </tr>
      <tr>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8px;color:#555;background:#f9f9f9">טלפון</td>
        ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center;direction:ltr">${b.crew[ri]?.phone ?? ""}</td>`).join("")}
      </tr>`).join("");

    const maxExtra = Math.max(0, ...data.buses.map((b) => b.extraTeachers.length));
    const extraRows = Array.from({ length: maxExtra }, (_, ei) => `
      <tr style="background:#d4edda">
        <td colspan="${n + 1}" style="padding:3px 6px;border:1px solid #bbb;font-size:9px;font-weight:bold;color:#1b4332">מלווה נוסף ${ei + 1}</td>
      </tr>
      <tr>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8px;color:#555;background:#f9f9f9">תפקיד / שם</td>
        ${data.buses.map((b) => {
          const e = b.extraTeachers[ei];
          return `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center">${e ? `${e.role} — ${e.name}` : ""}</td>`;
        }).join("")}
      </tr>
      <tr>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8px;color:#555;background:#f9f9f9">טלפון</td>
        ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center;direction:ltr">${b.extraTeachers[ei]?.phone ?? ""}</td>`).join("")}
      </tr>`).join("");

    // Class summary rows — handle splits
    const classRows = classNames.flatMap((cls) => {
      const parts = data.splits[cls];
      if (parts && parts.length >= 2) {
        const splitSum = parts.reduce((s, v) => s + (parseInt(v) || 0), 0);
        return [
          `<tr style="background:#fff8e1">
            <td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;font-weight:bold">${cls}</td>
            <td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;text-align:center;font-weight:bold">${plannedByClass[cls]}</td>
            <td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;text-align:center">${data.actual[cls] ?? ""}</td>
          </tr>`,
          ...parts.map((count, pi) => `<tr style="background:#fffde7">
            <td style="padding:2px 6px 2px 16px;border:1px solid #ddd;font-size:8.5px;color:#666">${PART_LABELS[pi]}</td>
            <td style="padding:2px 6px;border:1px solid #ddd;font-size:8.5px;text-align:center">${count || "—"}</td>
            <td style="border:1px solid #ddd"></td>
          </tr>`),
          splitSum > 0 && splitSum !== plannedByClass[cls]
            ? `<tr style="background:#fff3cd"><td colspan="3" style="padding:2px 8px;font-size:8px;color:#856404;border:1px solid #ddd">סה״כ חלקים: ${splitSum} ${splitSum > plannedByClass[cls] ? "⚠ חורג" : ""}</td></tr>`
            : "",
        ].filter(Boolean);
      }
      return [`<tr>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:9px">${cls}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;text-align:center;font-weight:bold">${plannedByClass[cls]}</td>
        <td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;text-align:center">${data.actual[cls] ?? ""}</td>
      </tr>`];
    }).join("") || `<tr><td colspan="3" style="padding:6px;color:#aaa;text-align:center;font-size:9px">אין נתוני תלמידים</td></tr>`;

    const summaryRows = [
      ["תלמידים", totalStudents || ""],
      ["מורים ומלווים", totalEscorts || ""],
      ['סה"כ נוכחים', totalStudents + totalEscorts || ""],
    ].map(([label, val], i) => `<tr style="${i === 2 ? "font-weight:bold;background:#d4edda" : ""}">
      <td style="padding:3px 8px;border:1px solid #ccc;font-size:9px">${label}</td>
      <td style="padding:3px 8px;border:1px solid #ccc;font-size:9px;text-align:center;width:50px">${val}</td>
    </tr>`).join("");

    return `
      <div class="header">
        <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
        <div class="title">נספח ו׳ — טבלת שליטה בטיול</div>
        ${t ? `<div class="ministry">${t.name ?? ""} | ${t.schoolName ?? ""}</div>` : ""}
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
            <thead><tr>
              <th style="width:110px">כיתה</th>
              <th style="width:65px;text-align:center">מתוכנן</th>
              <th style="width:65px;text-align:center">בפועל</th>
            </tr></thead>
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
      </div>
    `;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const opts = classOptions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ו׳ — טבלת שליטה בטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">הקצאת אוטובוסים, צוות ובקרת נוכחות</p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {/* Buses */}
      <div className="space-y-4">
        {data.buses.map((bus, bi) => (
          <div key={bus.id} className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)]">
            {/* Bus header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-[var(--brand-light)] rounded-t-[var(--radius)]">
              <span className="font-semibold text-primary text-sm shrink-0">אוטובוס {bi + 1}</span>
              {busStudentCount(bus) > 0 && (
                <span className="text-xs text-muted-foreground shrink-0">{busStudentCount(bus)} תלמידים · {calcEscorts(bus)} מלווים</span>
              )}
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                {[0, 1, 2].map((si) => (
                  <select
                    key={si}
                    value={bus.classSelections[si] ?? ""}
                    onChange={(e) => setBusClass(bi, si, e.target.value)}
                    className="text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-white text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">— כיתה {si + 1} —</option>
                    {opts.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ))}
              </div>
              <button onClick={() => deleteBus(bi)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Crew */}
            <div className="p-4">
              <table className="w-full text-sm mb-3">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-36">תפקיד</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">שם</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-36">טלפון</th>
                  </tr>
                </thead>
                <tbody>
                  {CREW_ROLES.map((role, ri) => (
                    <tr key={role} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 text-sm text-muted-foreground">{role}</td>
                      <td className="px-2 py-1.5">
                        {ri < STAFF_DROPDOWN_LIMIT ? (
                          <select
                            value={bus.crew[ri]?.name ?? ""}
                            onChange={(e) => selectStaff(bi, ri, e.target.value)}
                            className="w-full text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-white focus:outline-none focus:border-primary"
                          >
                            <option value="">— בחר מצוות הטיול —</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ""}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={bus.crew[ri]?.name ?? ""}
                            onChange={(e) => setCrewField(bi, ri, "name", e.target.value)}
                            placeholder="שם מלא..."
                            className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50"
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="tel"
                          value={bus.crew[ri]?.phone ?? ""}
                          onChange={(e) => setCrewField(bi, ri, "phone", e.target.value)}
                          placeholder="050-0000000"
                          dir="ltr"
                          className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50 text-left"
                        />
                      </td>
                    </tr>
                  ))}

                  {bus.extraTeachers.map((et, ti) => (
                    <tr key={ti} className="border-b border-border last:border-0 hover:bg-muted/20 bg-muted/5">
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <select
                            value={et.role}
                            onChange={(e) => setExtraTeacher(bi, ti, "role", e.target.value)}
                            className="text-xs border border-border rounded-[var(--radius-sm)] px-1.5 py-1 bg-white focus:outline-none focus:border-primary"
                          >
                            <option value="מורה">מורה</option>
                            <option value="מלווה">מלווה</option>
                          </select>
                          <button onClick={() => removeExtraTeacher(bi, ti)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={et.name}
                          onChange={(e) => setExtraTeacher(bi, ti, "name", e.target.value)}
                          className="w-full text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-white focus:outline-none focus:border-primary"
                        >
                          <option value="">— בחר מצוות הטיול —</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ""}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="tel"
                          value={et.phone}
                          onChange={(e) => setExtraTeacher(bi, ti, "phone", e.target.value)}
                          placeholder="טלפון..."
                          dir="ltr"
                          className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50 text-left"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Button variant="ghost" size="sm" onClick={() => addExtraTeacher(bi)} className="text-primary text-xs" type="button">
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                הוסף מלווה נוסף
              </Button>
            </div>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addBus} className="w-full" type="button">
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          הוסף אוטובוס
        </Button>
      </div>

      {/* Class control table */}
      {classNames.length > 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">בקרת נוכחות לפי כיתה</h2>
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">כיתה</th>
                <th className="px-4 py-2 font-medium text-muted-foreground text-center w-24">מתוכנן</th>
                <th className="px-4 py-2 font-medium text-muted-foreground text-center w-24">בפועל</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {classNames.map((cls) => {
                const parts = data.splits[cls];
                const isSplit = parts && parts.length >= 2;
                const splitSum = isSplit ? parts.reduce((s, v) => s + (parseInt(v) || 0), 0) : 0;
                const isOver = isSplit && splitSum > plannedByClass[cls];

                return (
                  <>
                    {/* Main class row */}
                    <tr key={cls} className={`border-b border-border hover:bg-muted/20 ${isSplit ? "bg-amber-50/60" : ""}`}>
                      <td className="px-4 py-2 font-medium">{cls}</td>
                      <td className="px-4 py-2 text-center text-muted-foreground">{plannedByClass[cls]}</td>
                      <td className="px-2 py-1.5 text-center">
                        {!isSplit && (
                          <input
                            type="number"
                            min="0"
                            value={data.actual[cls] ?? ""}
                            onChange={(e) => setActual(cls, e.target.value)}
                            placeholder="—"
                            className="w-20 text-sm text-center border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors"
                          />
                        )}
                        {isSplit && (
                          <span className={`text-xs font-medium ${isOver ? "text-destructive" : "text-muted-foreground"}`}>
                            {splitSum ? `${splitSum} בסה״כ${isOver ? " ⚠" : ""}` : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {!isSplit ? (
                          <button
                            onClick={() => splitClass(cls)}
                            className="text-xs text-muted-foreground hover:text-primary border border-border rounded px-2 py-0.5 transition-colors"
                          >
                            ↕ פצל
                          </button>
                        ) : (
                          <button
                            onClick={() => unsplitClass(cls)}
                            className="text-xs text-destructive/70 hover:text-destructive border border-destructive/30 rounded px-2 py-0.5 transition-colors"
                          >
                            ✕ בטל
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Split part rows */}
                    {isSplit && parts.map((count, pi) => (
                      <tr key={`${cls}-${pi}`} className="border-b border-border bg-amber-50/30 hover:bg-amber-50/60">
                        <td className="px-4 py-1.5 text-xs text-muted-foreground pr-8">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 ml-1.5" />
                          {PART_LABELS[pi]}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            value={count}
                            onChange={(e) => setSplitCount(cls, pi, e.target.value)}
                            placeholder="כמות"
                            className="w-20 text-sm text-center border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors"
                          />
                        </td>
                        <td colSpan={2} />
                      </tr>
                    ))}

                    {/* Add part button (if <3 parts) */}
                    {isSplit && parts.length < 3 && (
                      <tr key={`${cls}-add`} className="border-b border-border bg-amber-50/20">
                        <td colSpan={4} className="px-8 py-1">
                          <button
                            onClick={() => addSplitPart(cls)}
                            className="text-xs text-primary/70 hover:text-primary transition-colors"
                          >
                            + הוסף {PART_LABELS[parts.length]}
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--brand-light)] border-t-2 border-border">
                <td className="px-4 py-2 font-semibold text-primary text-sm">סה"כ</td>
                <td className="px-4 py-2 text-center font-bold text-primary">{goingStudents.length}</td>
                <td className="px-4 py-2 text-center font-bold text-primary">
                  {Object.values(data.actual).reduce((s, v) => s + (parseInt(v) || 0), 0) || ""}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Summary */}
      {data.buses.length > 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">סיכום כללי</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "תלמידים", value: totalStudents },
              { label: "מורים ומלווים", value: totalEscorts },
              { label: 'סה"כ', value: totalStudents + totalEscorts },
            ].map(({ label, value }) => (
              <div key={label} className="text-center border border-border rounded-[var(--radius-sm)] py-3">
                <div className="text-2xl font-bold text-primary">{value || "—"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AppendixActions title="נספח ו׳ — טבלת שליטה בטיול" filename="נספח-ו" getHTML={getHTML} />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { useTrip } from "@/hooks/use-trip";
import { useStudents } from "@/hooks/use-students";
import { useStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { AppendixActions } from "@/components/appendix-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

const CREW_ROLES = ["מורה אחראי/ת", "מורה נוסף", "נהג", "מאבטח/חובש", "מדריך"];
// First 2 roles use staff dropdown; rest are free text
const STAFF_DROPDOWN_LIMIT = 2;

type CrewMember = { name: string; phone: string };
type ExtraTeacher = { role: "מורה" | "מלווה"; name: string; phone: string };

type Bus = {
  id: string;
  classSelections: string[]; // up to 3 class names
  crew: CrewMember[];        // always length 5, matches CREW_ROLES
  extraTeachers: ExtraTeacher[];
};

type VavData = {
  buses: Bus[];
  actual: Record<string, string>; // class name → actual head count
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
  const crewWithName = bus.crew.filter((c) => c.name.trim()).length;
  return crewWithName + bus.extraTeachers.filter((e) => e.name.trim()).length;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AppendixVavClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip } = useTrip(tripId);
  const { students } = useStudents(tripId);
  const { staff } = useStaff(tripId);

  const [data, setData] = useState<VavData>({ buses: [], actual: {} });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "vav", (raw) => {
      if (raw?.buses) {
        setData({
          buses: (raw.buses as Bus[]).map((b) => ({
            ...b,
            crew: b.crew ?? CREW_ROLES.map(() => ({ name: "", phone: "" })),
            extraTeachers: b.extraTeachers ?? [],
            classSelections: b.classSelections ?? ["", "", ""],
          })),
          actual: (raw.actual as Record<string, string>) ?? {},
        });
      }
    });
    return () => unsub();
  }, [tripId]);

  function save(updated: VavData) {
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "vav", updated as unknown as Record<string, unknown>);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function update(updated: VavData) {
    setData(updated);
    save(updated);
  }

  // ── Bus mutations ──────────────────────────────────────────────────────────

  function addBus() {
    update({ ...data, buses: [...data.buses, makeBus()] });
  }

  function deleteBus(idx: number) {
    const buses = data.buses.filter((_, i) => i !== idx);
    update({ ...data, buses });
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

  function setActual(cls: string, val: string) {
    update({ ...data, actual: { ...data.actual, [cls]: val } });
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const goingStudents = students.filter((s) => s.isGoing);

  // Planned count per class (from students list)
  const plannedByClass: Record<string, number> = {};
  goingStudents.forEach((s) => {
    plannedByClass[s.class] = (plannedByClass[s.class] ?? 0) + 1;
  });
  const classNames = Object.keys(plannedByClass).sort((a, b) => a.localeCompare(b, "he"));

  // Students on a bus (sum of going students in assigned classes)
  function busStudentCount(bus: Bus): number {
    return bus.classSelections
      .filter(Boolean)
      .reduce((sum, cls) => sum + (plannedByClass[cls] ?? 0), 0);
  }

  const totalStudents = data.buses.reduce((s, b) => s + busStudentCount(b), 0);
  const totalEscorts  = data.buses.reduce((s, b) => s + calcEscorts(b), 0);

  // ── Print HTML ─────────────────────────────────────────────────────────────

  function getHTML() {
    const t = trip;
    const n = data.buses.length;

    const busHeaders = data.buses.map((b, bi) => {
      const cls = b.classSelections.filter(Boolean).join(", ");
      const sc  = busStudentCount(b);
      return `<th style="padding:5px 6px;border:1px solid #999;font-size:9px;font-weight:bold;background:#1b4332;color:white;text-align:center;min-width:110px">
        אוטובוס ${bi + 1}${cls ? `<br><span style="font-weight:normal">${cls}</span>` : ""}${sc ? `<br><span style="font-weight:normal;font-size:8px">${sc} תלמידים</span>` : ""}
      </th>`;
    }).join("");

    const crewRows = CREW_ROLES.map((role) => `
      <tr style="background:#d4edda">
        <td colspan="${n + 1}" style="padding:3px 6px;border:1px solid #bbb;font-size:9px;font-weight:bold;color:#1b4332">${role}</td>
      </tr>
      <tr>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8px;color:#555;background:#f9f9f9">שם</td>
        ${data.buses.map((b, ri) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center">${b.crew[CREW_ROLES.indexOf(role)]?.name ?? ""}</td>`).join("")}
      </tr>
      <tr>
        <td style="padding:3px 6px;border:1px solid #ccc;font-size:8px;color:#555;background:#f9f9f9">טלפון</td>
        ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center;direction:ltr">${b.crew[CREW_ROLES.indexOf(role)]?.phone ?? ""}</td>`).join("")}
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

    const classRows = classNames.map((cls) => `<tr>
      <td style="padding:3px 6px;border:1px solid #ddd;font-size:9px">${cls}</td>
      <td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;text-align:center;font-weight:bold">${plannedByClass[cls]}</td>
      <td style="padding:3px 6px;border:1px solid #ddd;font-size:9px;text-align:center">${data.actual[cls] ?? ""}</td>
    </tr>`).join("") || `<tr><td colspan="3" style="padding:6px;color:#aaa;text-align:center;font-size:9px">אין נתוני תלמידים</td></tr>`;

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
            ${data.buses.map((b) => `<td style="padding:4px 6px;border:1px solid #ccc;font-size:9px;text-align:center">${b.classSelections.filter(Boolean).join(", ")}</td>`).join("")}
          </tr>
          ${crewRows}
          ${extraRows}
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
              <th style="width:100px">כיתה</th>
              <th style="width:65px;text-align:center">מתוכנן</th>
              <th style="width:65px;text-align:center">בפועל</th>
            </tr></thead>
            <tbody>${classRows}</tbody>
          </table>
        </div>
        <div>
          <div class="section-title">סיכום כללי</div>
          <table style="width:auto">
            <thead><tr>
              <th>קטגוריה</th>
              <th style="width:60px;text-align:center">מספר</th>
            </tr></thead>
            <tbody>${summaryRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const tripClasses = trip?.classes?.map((c) => c.name) ?? [];

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
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-[var(--brand-light)] rounded-t-[var(--radius)]">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-primary text-sm">אוטובוס {bi + 1}</span>
                {busStudentCount(bus) > 0 && (
                  <span className="text-xs text-muted-foreground">{busStudentCount(bus)} תלמידים · {calcEscorts(bus)} מלווים</span>
                )}
              </div>
              {/* Class selectors */}
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((si) => (
                  <select
                    key={si}
                    value={bus.classSelections[si] ?? ""}
                    onChange={(e) => setBusClass(bi, si, e.target.value)}
                    className="text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-white text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">— כיתה {si + 1} —</option>
                    {tripClasses.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                ))}
              </div>
              <button
                onClick={() => deleteBus(bi)}
                className="text-muted-foreground hover:text-destructive transition-colors text-xs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Crew table */}
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

                  {/* Extra teachers */}
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
              </tr>
            </thead>
            <tbody>
              {classNames.map((cls) => (
                <tr key={cls} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium">{cls}</td>
                  <td className="px-4 py-2 text-center text-muted-foreground">{plannedByClass[cls]}</td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      min="0"
                      value={data.actual[cls] ?? ""}
                      onChange={(e) => setActual(cls, e.target.value)}
                      placeholder="—"
                      className="w-20 text-sm text-center border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--brand-light)] border-t-2 border-border">
                <td className="px-4 py-2 font-semibold text-primary text-sm">סה"כ</td>
                <td className="px-4 py-2 text-center font-bold text-primary">{goingStudents.length}</td>
                <td className="px-4 py-2 text-center font-bold text-primary">
                  {Object.values(data.actual).reduce((s, v) => s + (parseInt(v) || 0), 0) || ""}
                </td>
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

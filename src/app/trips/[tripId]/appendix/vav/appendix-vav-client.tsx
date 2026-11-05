"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { useTrip } from "@/hooks/use-trip";
import { useStudents } from "@/hooks/use-students";
import { useStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { AppendixActions, esc } from "@/components/appendix-actions";
import type { Student } from "@/lib/types";
import { SplitStudentsDialog } from "./split-students-dialog";

// ─── Constants ────────────────────────────────────────────────────────────────

const CREW_ROLES = ["מורה אחראי/ת", "מורה נוסף", "נהג", "מאבטח/חובש", "מדריך"];
const STAFF_DROPDOWN_LIMIT = 2;
const PART_LABELS = ["חלק א׳", "חלק ב׳", "חלק ג׳", "חלק ד׳"];

function splitKey(cls: string, part: number) { return `${cls}|${part}`; }
function isSplitSel(sel: string) { return sel.includes("|"); }
function parseSplit(sel: string): [string, number] {
  const idx = sel.lastIndexOf("|");
  return [sel.slice(0, idx), parseInt(sel.slice(idx + 1))];
}
function splitLabel(cls: string, part: number) { return `${cls} — ${PART_LABELS[part]}`; }

// ─── Types ────────────────────────────────────────────────────────────────────

type CrewMember   = { name: string; phone: string };
type ExtraTeacher = { role: "מורה" | "מלווה"; name: string; phone: string };

type Bus = {
  id: string;
  classSelections: string[];
  crew: CrewMember[];
  extraTeachers: ExtraTeacher[];
};

type DayData = {
  id: string;
  label: string;
  buses: Bus[];
};

type VavData = {
  days:   DayData[];
  actual: Record<string, string>;
  splits: Record<string, string[]>;
  splitStudents?: Record<string, string[][]>;
};

function makeBus(): Bus {
  return {
    id: crypto.randomUUID(),
    classSelections: ["", "", "", ""],
    crew: CREW_ROLES.map(() => ({ name: "", phone: "" })),
    extraTeachers: [],
  };
}

function makeDay(n: number): DayData {
  return { id: crypto.randomUUID(), label: `יום ${n}`, buses: [] };
}

const DRIVER_IDX = CREW_ROLES.indexOf("נהג");

function calcEscorts(bus: Bus): number {
  return bus.crew.filter((c, i) => i !== DRIVER_IDX && c.name.trim()).length
    + bus.extraTeachers.filter((e) => e.name.trim()).length;
}

// Migrate legacy flat `buses` array to single-day structure
function migrateData(raw: Record<string, unknown>): VavData {
  const splits = (raw.splits as Record<string, string[]>) ?? {};
  const splitStudents = (raw.splitStudents as Record<string, string[][]>) ?? {};
  const actual = (raw.actual as Record<string, string>) ?? {};

  if (Array.isArray(raw.days) && raw.days.length > 0) {
    return {
      days: (raw.days as DayData[]).map((d) => ({
        ...d,
        buses: (d.buses ?? []).map((b: Bus) => ({
          ...b,
          crew:            b.crew            ?? CREW_ROLES.map(() => ({ name: "", phone: "" })),
          extraTeachers:   b.extraTeachers   ?? [],
          classSelections: b.classSelections ?? ["", "", "", ""],
        })),
      })),
      actual,
      splits,
      splitStudents,
    };
  }

  // Legacy: flat buses array → wrap in יום 1
  const legacyBuses = Array.isArray(raw.buses)
    ? (raw.buses as Bus[]).map((b) => ({
        ...b,
        crew:            b.crew            ?? CREW_ROLES.map(() => ({ name: "", phone: "" })),
        extraTeachers:   b.extraTeachers   ?? [],
        classSelections: b.classSelections ?? ["", "", "", ""],
      }))
    : [];

  return {
    days: [{ id: crypto.randomUUID(), label: "יום 1", buses: legacyBuses }],
    actual,
    splits,
    splitStudents,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AppendixVavClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip }     = useTrip(tripId);
  const { students } = useStudents(tripId);
  const { staff }    = useStaff(tripId);

  const [data,    setData]    = useState<VavData>({ days: [], actual: {}, splits: {}, splitStudents: {} });
  const [status,  setStatus]  = useState<"idle" | "saving" | "saved">("idle");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [splitModalClass, setSplitModalClass] = useState<string | null>(null);
  const [openBusRosters, setOpenBusRosters] = useState<Set<string>>(new Set());

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending = useRef(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "vav", (raw) => {
      if (isPending.current) return;
      if (raw) setData(migrateData(raw as Record<string, unknown>));
    });
    return () => unsub();
  }, [tripId]);

  // ── Save ───────────────────────────────────────────────────────────────────

  function save(updated: VavData) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "vav", updated as unknown as Record<string, unknown>);
      isPending.current = false;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function update(updated: VavData) { setData(updated); save(updated); }

  // ── Day mutations ──────────────────────────────────────────────────────────

  function addDay() {
    update({ ...data, days: [...data.days, makeDay(data.days.length + 1)] });
  }

  function deleteDay(dayId: string) {
    if (!confirm("למחוק יום זה וכל האוטובוסים שבו?")) return;
    update({ ...data, days: data.days.filter((d) => d.id !== dayId) });
  }

  function setDayLabel(dayId: string, label: string) {
    update({ ...data, days: data.days.map((d) => d.id === dayId ? { ...d, label } : d) });
  }

  function toggleCollapse(dayId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) { next.delete(dayId); } else { next.add(dayId); }
      return next;
    });
  }

  function collapseAll() {
    setCollapsed(new Set(data.days.map((d) => d.id)));
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  // ── Bus mutations ──────────────────────────────────────────────────────────

  function updateDayBuses(dayId: string, buses: Bus[]) {
    update({ ...data, days: data.days.map((d) => d.id === dayId ? { ...d, buses } : d) });
  }

  function addBus(dayId: string) {
    const day = data.days.find((d) => d.id === dayId)!;
    updateDayBuses(dayId, [...day.buses, makeBus()]);
  }

  function deleteBus(dayId: string, busIdx: number) {
    const day = data.days.find((d) => d.id === dayId)!;
    updateDayBuses(dayId, day.buses.filter((_, j) => j !== busIdx));
  }

  function setBusClass(dayId: string, busIdx: number, slotIdx: number, val: string) {
    const day = data.days.find((d) => d.id === dayId)!;
    const buses = day.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const cs = [...b.classSelections];
      cs[slotIdx] = val;
      return { ...b, classSelections: cs };
    });
    updateDayBuses(dayId, buses);
  }

  function setCrewField(dayId: string, busIdx: number, roleIdx: number, field: "name" | "phone", val: string) {
    const day = data.days.find((d) => d.id === dayId)!;
    const buses = day.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const crew = b.crew.map((c, ri) => ri === roleIdx ? { ...c, [field]: val } : c);
      return { ...b, crew };
    });
    updateDayBuses(dayId, buses);
  }

  function selectStaff(dayId: string, busIdx: number, roleIdx: number, name: string) {
    const member = staff.find((s) => s.name === name);
    const day = data.days.find((d) => d.id === dayId)!;
    const buses = day.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const crew = b.crew.map((c, ri) =>
        ri === roleIdx ? { name, phone: member?.phone ?? c.phone } : c
      );
      return { ...b, crew };
    });
    updateDayBuses(dayId, buses);
  }

  function addExtraTeacher(dayId: string, busIdx: number) {
    const day = data.days.find((d) => d.id === dayId)!;
    const buses = day.buses.map((b, i) =>
      i === busIdx
        ? { ...b, extraTeachers: [...b.extraTeachers, { role: "מורה" as const, name: "", phone: "" }] }
        : b
    );
    updateDayBuses(dayId, buses);
  }

  function removeExtraTeacher(dayId: string, busIdx: number, ti: number) {
    const day = data.days.find((d) => d.id === dayId)!;
    const buses = day.buses.map((b, i) =>
      i === busIdx ? { ...b, extraTeachers: b.extraTeachers.filter((_, j) => j !== ti) } : b
    );
    updateDayBuses(dayId, buses);
  }

  function setExtraTeacher(dayId: string, busIdx: number, ti: number, field: keyof ExtraTeacher, val: string) {
    const day = data.days.find((d) => d.id === dayId)!;
    const buses = day.buses.map((b, i) => {
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
    updateDayBuses(dayId, buses);
  }

  // ── Class / split mutations ────────────────────────────────────────────────

  function setActual(cls: string, val: string) {
    update({ ...data, actual: { ...data.actual, [cls]: val } });
  }

  function splitClass(cls: string) {
    update({
      ...data,
      splits: { ...data.splits, [cls]: ["", ""] },
      splitStudents: { ...(data.splitStudents ?? {}), [cls]: [[], []] },
    });
  }

  function unsplitClass(cls: string) {
    const splits = { ...data.splits };
    delete splits[cls];
    const splitStudents = { ...(data.splitStudents ?? {}) };
    delete splitStudents[cls];
    const days = data.days.map((d) => ({
      ...d,
      buses: d.buses.map((b) => ({
        ...b,
        classSelections: b.classSelections.map((sel) =>
          isSplitSel(sel) && parseSplit(sel)[0] === cls ? "" : sel
        ),
      })),
    }));
    update({ ...data, splits, splitStudents, days });
  }

  function setSplitCount(cls: string, partIdx: number, val: string) {
    const parts = [...(data.splits[cls] ?? [])];
    parts[partIdx] = val;
    update({ ...data, splits: { ...data.splits, [cls]: parts } });
  }

  function addSplitPart(cls: string) {
    const parts = [...(data.splits[cls] ?? [])];
    if (parts.length >= 4) return;
    parts.push("");
    const studentParts = [...(data.splitStudents?.[cls] ?? [])];
    while (studentParts.length < parts.length - 1) studentParts.push([]);
    studentParts.push([]);
    update({
      ...data,
      splits: { ...data.splits, [cls]: parts },
      splitStudents: { ...(data.splitStudents ?? {}), [cls]: studentParts },
    });
  }

  function removeSplitPart(cls: string) {
    const parts = [...(data.splits[cls] ?? [])];
    if (parts.length <= 2) return;
    const removedPartIdx = parts.length - 1;
    parts.pop();
    const studentParts = [...(data.splitStudents?.[cls] ?? [])];
    if (studentParts.length > parts.length) studentParts.pop();
    const removedKey = splitKey(cls, removedPartIdx);
    const days = data.days.map((d) => ({
      ...d,
      buses: d.buses.map((b) => ({
        ...b,
        classSelections: b.classSelections.map((sel) => (sel === removedKey ? "" : sel)),
      })),
    }));
    update({
      ...data,
      splits: { ...data.splits, [cls]: parts },
      splitStudents: { ...(data.splitStudents ?? {}), [cls]: studentParts },
      days,
    });
  }

  function handleSaveSplitStudents(cls: string, newSplitStudents: string[][]) {
    const currentParts = data.splits[cls] ?? [];
    const updatedParts = currentParts.map((count, pi) => {
      const assignedCount = newSplitStudents[pi]?.length ?? 0;
      return assignedCount > 0 ? String(assignedCount) : (count || "");
    });

    update({
      ...data,
      splits: { ...data.splits, [cls]: updatedParts },
      splitStudents: { ...(data.splitStudents ?? {}), [cls]: newSplitStudents },
    });
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const goingStudents = students.filter((s) => s.isGoing);

  function toggleBusRoster(busId: string) {
    setOpenBusRosters((prev) => {
      const next = new Set(prev);
      if (next.has(busId)) next.delete(busId);
      else next.add(busId);
      return next;
    });
  }

  function getBusAssignedStudents(bus: Bus): Student[] {
    const result: Student[] = [];
    const seen = new Set<string>();

    bus.classSelections.filter(Boolean).forEach((sel) => {
      if (isSplitSel(sel)) {
        const [cls, part] = parseSplit(sel);
        const studentIds = data.splitStudents?.[cls]?.[part] ?? [];
        studentIds.forEach((id) => {
          if (!seen.has(id)) {
            seen.add(id);
            const st = goingStudents.find((s) => s.id === id);
            if (st) result.push(st);
          }
        });
      }
    });

    return result;
  }
  const plannedByClass: Record<string, number> = {};
  goingStudents.forEach((s) => { plannedByClass[s.class] = (plannedByClass[s.class] ?? 0) + 1; });
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

  function dayTotals(day: DayData) {
    const students = day.buses.reduce((s, b) => s + busStudentCount(b), 0);
    const escorts  = day.buses.reduce((s, b) => s + calcEscorts(b), 0);
    return { students, escorts, total: students + escorts };
  }

  function classOptions() {
    const opts: { value: string; label: string }[] = [];
    classNames.forEach((cls) => {
      const parts = data.splits[cls];
      if (parts && parts.length >= 2) {
        parts.forEach((_, pi) => opts.push({ value: splitKey(cls, pi), label: splitLabel(cls, pi) }));
      } else {
        opts.push({ value: cls, label: `${cls} (${plannedByClass[cls]})` });
      }
    });
    return opts;
  }

  // ── Print HTML ─────────────────────────────────────────────────────────────

  function getHTML() {
    const t = trip;

    function dayTable(day: DayData) {
      const n = day.buses.length;
      if (n === 0) return `<p style="color:#aaa;font-size:10px;text-align:center">לא הוזנו אוטובוסים</p>`;

      const busHeaders = day.buses.map((b, bi) => {
        const labels = b.classSelections.filter(Boolean).map((sel) =>
          isSplitSel(sel) ? splitLabel(...parseSplit(sel)) : sel
        ).join(", ");
        const sc = busStudentCount(b);
        return `<th style="padding:6px 6px;border:1px solid #999;font-size:11.5px;font-weight:bold;background:#1b4332;color:white;text-align:center;min-width:110px">
          אוטובוס ${bi + 1}${labels ? `<br><span style="font-weight:normal">${labels}</span>` : ""}${sc ? `<br><span style="font-weight:normal;font-size:10px">${sc} תלמידים</span>` : ""}
        </th>`;
      }).join("");

      const crewRows = CREW_ROLES.map((role, ri) => `
        <tr style="background:#d4edda">
          <td colspan="${n + 1}" style="padding:4px 6px;border:1px solid #bbb;font-size:11.5px;font-weight:bold;color:#1b4332">${role}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;border:1px solid #ccc;font-size:10.5px;color:#555;background:#f9f9f9">שם</td>
          ${day.buses.map((b) => `<td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;text-align:center">${esc(b.crew[ri]?.name)}</td>`).join("")}
        </tr>
        <tr>
          <td style="padding:4px 6px;border:1px solid #ccc;font-size:10.5px;color:#555;background:#f9f9f9">טלפון</td>
          ${day.buses.map((b) => `<td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;text-align:center;direction:ltr">${esc(b.crew[ri]?.phone)}</td>`).join("")}
        </tr>`).join("");

      const maxExtra = Math.max(0, ...day.buses.map((b) => b.extraTeachers.length));
      const extraRows = Array.from({ length: maxExtra }, (_, ei) => `
        <tr style="background:#d4edda">
          <td colspan="${n + 1}" style="padding:4px 6px;border:1px solid #bbb;font-size:11.5px;font-weight:bold;color:#1b4332">מלווה נוסף ${ei + 1}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;border:1px solid #ccc;font-size:10.5px;color:#555;background:#f9f9f9">תפקיד / שם</td>
          ${day.buses.map((b) => {
            const e = b.extraTeachers[ei];
            return `<td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;text-align:center">${e ? `${esc(e.role)} — ${esc(e.name)}` : ""}</td>`;
          }).join("")}
        </tr>
        <tr>
          <td style="padding:4px 6px;border:1px solid #ccc;font-size:10.5px;color:#555;background:#f9f9f9">טלפון</td>
          ${day.buses.map((b) => `<td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;text-align:center;direction:ltr">${esc(b.extraTeachers[ei]?.phone)}</td>`).join("")}
        </tr>`).join("");

      const dt = dayTotals(day);
      return `
        <table>
          <thead><tr>
            <th style="padding:6px 6px;border:1px solid #999;font-size:11.5px;background:#1b4332;color:white;min-width:90px"></th>
            ${busHeaders}
          </tr></thead>
          <tbody>
            <tr style="background:#e8f5e9">
              <td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;font-weight:bold">כיתות</td>
              ${day.buses.map((b) => `<td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;text-align:center">${b.classSelections.filter(Boolean).map((sel) => isSplitSel(sel) ? splitLabel(...parseSplit(sel)) : sel).join(", ")}</td>`).join("")}
            </tr>
            ${crewRows}${extraRows}
            <tr style="background:#e8f5e9">
              <td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;font-weight:bold">מספר תלמידים</td>
              ${day.buses.map((b) => `<td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;text-align:center;font-weight:bold">${busStudentCount(b) || ""}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;font-weight:bold">מספר מלווים</td>
              ${day.buses.map((b) => `<td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;text-align:center">${calcEscorts(b) || ""}</td>`).join("")}
            </tr>
            <tr style="background:#d4edda;font-weight:bold">
              <td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px">סה"כ באוטובוס</td>
              ${day.buses.map((b) => `<td style="padding:5px 6px;border:1px solid #ccc;font-size:11.5px;text-align:center;font-weight:bold">${(busStudentCount(b) + calcEscorts(b)) || ""}</td>`).join("")}
            </tr>
          </tbody>
        </table>
        <div style="font-size:11.5px;color:#555;margin-top:5px">
          סה"כ ביום: <strong>${dt.students}</strong> תלמידים · <strong>${dt.escorts}</strong> מלווים · <strong>${dt.total}</strong> סה"כ
        </div>`;
    }

    const classRows = classNames.flatMap((cls) => {
      const parts = data.splits[cls];
      if (parts && parts.length >= 2) {
        const splitSum = parts.reduce((s, v) => s + (parseInt(v) || 0), 0);
        return [
          `<tr style="background:#fff8e1">
            <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px;font-weight:bold">${esc(cls)}</td>
            <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px;text-align:center;font-weight:bold">${esc(plannedByClass[cls])}</td>
            <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px;text-align:center">${esc(data.actual[cls])}</td>
          </tr>`,
          ...parts.map((count, pi) => `<tr style="background:#fffde7">
            <td style="padding:3px 8px 3px 18px;border:1px solid #ddd;font-size:11px;color:#666">${PART_LABELS[pi]}</td>
            <td style="padding:3px 8px;border:1px solid #ddd;font-size:11px;text-align:center">${count || "—"}</td>
            <td style="border:1px solid #ddd"></td>
          </tr>`),
          splitSum > 0 && splitSum !== plannedByClass[cls]
            ? `<tr style="background:#fff3cd"><td colspan="3" style="padding:3px 8px;font-size:11px;color:#856404;border:1px solid #ddd">סה״כ חלקים: ${splitSum} ${splitSum > plannedByClass[cls] ? "⚠ חורג" : ""}</td></tr>`
            : "",
        ].filter(Boolean);
      }
      return [`<tr>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px">${esc(cls)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px;text-align:center;font-weight:bold">${esc(plannedByClass[cls])}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:12px;text-align:center">${esc(data.actual[cls])}</td>
      </tr>`];
    }).join("") || `<tr><td colspan="3" style="padding:8px;color:#aaa;text-align:center;font-size:12px">אין נתוני תלמידים</td></tr>`;

    const totalStudents = data.days.reduce((s, d) => s + dayTotals(d).students, 0);
    const totalEscorts  = data.days.reduce((s, d) => s + dayTotals(d).escorts, 0);
    const summaryRows = [
      ["תלמידים", totalStudents || ""],
      ["מורים ומלווים", totalEscorts || ""],
      ['סה"כ נוכחים', totalStudents + totalEscorts || ""],
    ].map(([label, val], i) => `<tr style="${i === 2 ? "font-weight:bold;background:#d4edda" : ""}">
      <td style="padding:4px 10px;border:1px solid #ccc;font-size:12px">${label}</td>
      <td style="padding:4px 10px;border:1px solid #ccc;font-size:12px;text-align:center;width:60px">${val}</td>
    </tr>`).join("");

    const daysHTML = data.days.map((day, di) => `
      <div style="margin-bottom:20px;${di > 0 ? "page-break-before:always;break-before:page;" : ""}">
        <div style="font-size:13px;font-weight:bold;padding:6px 10px;background:#1b4332;color:white;border-radius:4px 4px 0 0;margin-bottom:6px">
          ${esc(day.label)} — ${day.buses.length} אוטובוסים
        </div>
        ${dayTable(day)}
      </div>`).join("");

    // Detailed Split Students Roster for Print
    const splitDetailsHTML = Object.entries(data.splitStudents ?? {}).map(([cls, partsArr]) => {
      if (!partsArr || partsArr.length === 0) return "";
      const partItems = partsArr.map((studentIds, pi) => {
        if (!studentIds || studentIds.length === 0) return "";
        const names = studentIds
          .map((id) => {
            const s = goingStudents.find((st) => st.id === id);
            return s ? `${s.firstName} ${s.lastName}` : "";
          })
          .filter(Boolean);
        if (names.length === 0) return "";
        return `<div style="margin-bottom:4px;font-size:10px;line-height:1.4">
          <strong style="color:#1b4332">${esc(cls)} — ${PART_LABELS[pi]} (${names.length} תלמידים):</strong> ${esc(names.join(", "))}
        </div>`;
      }).filter(Boolean).join("");

      if (!partItems) return "";
      return `<div style="margin-bottom:6px">${partItems}</div>`;
    }).filter(Boolean).join("");

    const splitSection = splitDetailsHTML ? `
      <div style="margin-top:14px;padding:8px 10px;background:#f9fbf9;border:1px solid #c3e6cb;border-radius:4px;page-break-inside:avoid">
        <div style="font-size:11px;font-weight:bold;color:#1b4332;margin-bottom:5px">פירוט שמות תלמידים בכיתות מפוצלות:</div>
        ${splitDetailsHTML}
      </div>` : "";

    return `
      <div class="header">
        <div class="title">נספח ו׳ — טבלת שליטה בטיול</div>
        ${t ? `<div class="ministry">${t.name ?? ""} | ${t.schoolName ?? ""}</div>` : ""}
      </div>
      ${daysHTML}
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
      ${splitSection}
    `;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const opts = classOptions();
  const allCollapsed = data.days.length > 0 && data.days.every((d) => collapsed.has(d.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ו׳ — טבלת שליטה בטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">הקצאת אוטובוסים, צוות ובקרת נוכחות</p>
        </div>
        <div className="flex items-center gap-3">
          {data.days.length > 1 && (
            <button
              onClick={allCollapsed ? expandAll : collapseAll}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-[var(--radius-sm)] px-3 py-1.5 transition-colors"
            >
              {allCollapsed ? "הרחב הכל" : "כווץ הכל"}
            </button>
          )}
          <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
            {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
          </span>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-4">
        {data.days.map((day, dayIdx) => {
          const isCollapsed = collapsed.has(day.id);
          const dt = dayTotals(day);

          return (
            <div key={day.id} className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
              {/* Day header */}
              <div className="px-5 py-3 bg-[#1b4332] flex items-center gap-3">
                {/* Collapse toggle */}
                <button
                  onClick={() => toggleCollapse(day.id)}
                  className="text-white/70 hover:text-white transition-colors flex-shrink-0"
                  title={isCollapsed ? "הרחב" : "כווץ"}
                >
                  <svg className={`w-4 h-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Editable label */}
                <input
                  value={day.label}
                  onChange={(e) => setDayLabel(day.id, e.target.value)}
                  className="bg-transparent text-white font-semibold text-sm focus:outline-none border-b border-transparent focus:border-white/50 transition-colors min-w-0 w-28"
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Day stats */}
                <div className="flex items-center gap-3 mr-2 flex-1">
                  <span className="text-white/70 text-xs">{day.buses.length} אוטובוסים</span>
                  {dt.students > 0 && (
                    <>
                      <span className="text-white/50 text-xs">·</span>
                      <span className="text-white/70 text-xs">👥 {dt.students} תלמידים</span>
                      <span className="text-white/50 text-xs">·</span>
                      <span className="text-white/70 text-xs">🧑‍🏫 {dt.escorts} מלווים</span>
                    </>
                  )}
                </div>

                {/* Delete day (only if >1 day) */}
                {data.days.length > 1 && (
                  <button
                    onClick={() => deleteDay(day.id)}
                    className="text-white/50 hover:text-white/90 transition-colors flex-shrink-0"
                    title="מחק יום"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Day content */}
              {!isCollapsed && (
                <div className="divide-y divide-border">
                  {day.buses.map((bus, bi) => (
                    <div key={bus.id}>
                      {/* Bus header */}
                      <div className="px-5 py-3 border-b border-border bg-[var(--brand-light)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-primary text-sm">אוטובוס {bi + 1}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-medium text-foreground">👥 {busStudentCount(bus)} תלמידים</span>
                            <span className="text-xs font-medium text-foreground">🧑‍🏫 {calcEscorts(bus)} מלווים</span>
                            <span className="text-xs font-bold text-primary">סה״כ {busStudentCount(bus) + calcEscorts(bus)}</span>
                            <button onClick={() => deleteBus(day.id, bi)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {classNames.length === 0 ? (
                          <p className="text-xs text-muted-foreground">ייבא רשימת תלמידים בנספח ז׳ כדי לבחור כיתות</p>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            {[0, 1, 2, 3].map((si) => (
                              <select
                                key={si}
                                value={bus.classSelections[si] ?? ""}
                                onChange={(e) => setBusClass(day.id, bi, si, e.target.value)}
                                className="text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-white text-foreground focus:outline-none focus:border-primary"
                              >
                                <option value="">— כיתה {si + 1} —</option>
                                {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ))}
                          </div>
                        )}

                        {/* Bus assigned students roster expander */}
                        {(() => {
                          const busStudents = getBusAssignedStudents(bus);
                          if (busStudents.length === 0) return null;
                          const isRosterOpen = openBusRosters.has(bus.id);
                          return (
                            <div className="mt-2.5 pt-2 border-t border-border/40">
                              <button
                                type="button"
                                onClick={() => toggleBusRoster(bus.id)}
                                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                              >
                                <svg
                                  className={`w-3.5 h-3.5 transition-transform ${isRosterOpen ? "rotate-90" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                {isRosterOpen
                                  ? "הסתר שמות תלמידים משובצים"
                                  : `הצג שמות תלמידים משובצים (${busStudents.length})`}
                              </button>
                              {isRosterOpen && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5 p-2 bg-white/70 rounded-[var(--radius-sm)] border border-border/50 max-h-36 overflow-y-auto">
                                  {busStudents.map((s) => (
                                    <span
                                      key={s.id}
                                      className="text-xs bg-muted/80 text-foreground px-2 py-0.5 rounded-full border border-border/40"
                                    >
                                      {s.firstName} {s.lastName}
                                      <span className="text-muted-foreground text-[10px] mr-1">({s.class})</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                                      onChange={(e) => selectStaff(day.id, bi, ri, e.target.value)}
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
                                      onChange={(e) => setCrewField(day.id, bi, ri, "name", e.target.value)}
                                      placeholder="שם מלא..."
                                      className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50"
                                    />
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="tel"
                                    value={bus.crew[ri]?.phone ?? ""}
                                    onChange={(e) => setCrewField(day.id, bi, ri, "phone", e.target.value)}
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
                                      onChange={(e) => setExtraTeacher(day.id, bi, ti, "role", e.target.value)}
                                      className="text-xs border border-border rounded-[var(--radius-sm)] px-1.5 py-1 bg-white focus:outline-none focus:border-primary"
                                    >
                                      <option value="מורה">מורה</option>
                                      <option value="מלווה">מלווה</option>
                                    </select>
                                    <button onClick={() => removeExtraTeacher(day.id, bi, ti)} className="text-muted-foreground hover:text-destructive transition-colors">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                                <td className="px-2 py-1.5">
                                  <select
                                    value={et.name}
                                    onChange={(e) => setExtraTeacher(day.id, bi, ti, "name", e.target.value)}
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
                                    onChange={(e) => setExtraTeacher(day.id, bi, ti, "phone", e.target.value)}
                                    placeholder="טלפון..."
                                    dir="ltr"
                                    className="w-full text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors placeholder:text-muted-foreground/50 text-left"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <Button variant="ghost" size="sm" onClick={() => addExtraTeacher(day.id, bi)} className="text-primary text-xs" type="button">
                          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          הוסף מלווה נוסף
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Add bus */}
                  <div className="px-5 py-3">
                    <Button variant="outline" size="sm" onClick={() => addBus(day.id)} className="w-full" type="button">
                      <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      הוסף אוטובוס ליום {dayIdx + 1}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add day */}
        <Button variant="outline" size="sm" onClick={addDay} className="w-full" type="button">
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          הוסף יום
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
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSplitModalClass(cls)}
                              className="text-xs text-primary hover:text-primary/80 border border-primary/30 rounded px-2 py-0.5 transition-colors bg-white font-medium"
                              title="ערוך חלוקת תלמידים"
                            >
                              שיוך שמות
                            </button>
                            <button
                              type="button"
                              onClick={() => unsplitClass(cls)}
                              className="text-xs text-destructive/70 hover:text-destructive border border-destructive/30 rounded px-2 py-0.5 transition-colors"
                              title="בטל פיצול כיתה"
                            >
                              ✕ בטל
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {isSplit && parts.map((count, pi) => {
                      const partStudentIds = data.splitStudents?.[cls]?.[pi] ?? [];
                      const assignedStudents = partStudentIds
                        .map((id) => goingStudents.find((s) => s.id === id))
                        .filter(Boolean) as Student[];
                      const hasAssigned = assignedStudents.length > 0;
                      const previewNames = assignedStudents.slice(0, 3).map((s) => `${s.firstName} ${s.lastName}`).join(", ");
                      const extraCount = assignedStudents.length - 3;
                      const fullNamesTitle = assignedStudents.map((s) => `${s.firstName} ${s.lastName}`).join(", ");

                      return (
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
                          <td colSpan={2} className="px-3 py-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSplitModalClass(cls)}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                                  hasAssigned
                                    ? "bg-primary/10 border-primary/30 text-primary font-medium hover:bg-primary/20"
                                    : "bg-white border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                {hasAssigned ? `${assignedStudents.length} שובצו` : "+ שיוך שמות"}
                              </button>
                              {hasAssigned && (
                                <span
                                  className="text-xs text-muted-foreground truncate max-w-[260px] cursor-help"
                                  title={fullNamesTitle}
                                >
                                  {previewNames}{extraCount > 0 ? ` ועוד ${extraCount}...` : ""}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {isSplit && (
                      <tr key={`${cls}-actions`} className="border-b border-border bg-amber-50/20">
                        <td colSpan={4} className="px-8 py-1">
                          <div className="flex items-center gap-3">
                            {parts.length < 4 && (
                              <button
                                onClick={() => addSplitPart(cls)}
                                className="text-xs text-primary/70 hover:text-primary transition-colors"
                              >
                                + הוסף {PART_LABELS[parts.length]}
                              </button>
                            )}
                            {parts.length > 2 && (
                              <button
                                onClick={() => removeSplitPart(cls)}
                                className="text-xs text-destructive/70 hover:text-destructive transition-colors"
                              >
                                - הסר {PART_LABELS[parts.length - 1]}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--brand-light)] border-t-2 border-border">
                <td className="px-4 py-2 font-semibold text-primary text-sm">{'סה"כ'}</td>
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

      {splitModalClass && (
        <SplitStudentsDialog
          open={!!splitModalClass}
          onOpenChange={(open) => { if (!open) setSplitModalClass(null); }}
          className={splitModalClass}
          students={goingStudents.filter((s) => s.class === splitModalClass)}
          partsCount={data.splits[splitModalClass]?.length || 2}
          initialPartStudents={data.splitStudents?.[splitModalClass] ?? []}
          onSave={(newPartStudents) => handleSaveSplitStudents(splitModalClass, newPartStudents)}
        />
      )}

      <AppendixActions title="נספח ו׳ — טבלת שליטה בטיול" getHTML={getHTML} />
    </div>
  );
}

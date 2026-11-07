"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { useTrip } from "@/hooks/use-trip";
import { useStudents } from "@/hooks/use-students";
import { useStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppendixActions, printHTML, sharePDF, esc } from "@/components/appendix-actions";
import type { Student } from "@/lib/types";
import { SplitStudentsDialog } from "./split-students-dialog";

// ─── Constants ────────────────────────────────────────────────────────────────

const CREW_ROLES = ["מורה אחראי/ת", "מורה נוסף", "נהג", "מאבטח/חובש", "מדריך"];
const DEFAULT_EXTRA_ROLES = [
  "מורה",
  "מורה מלווה",
  "מורה אחראי/ת",
  "מחנך",
  "מלווה",
  "הורה מלווה",
  "מדריך",
  "מאבטח",
  "חובש",
  "מאבטח/חובש",
  "אחות",
  "רכז טיול",
  "מנהל טיול",
  "נהג",
];
const PART_LABELS = ["חלק א׳", "חלק ב׳", "חלק ג׳", "חלק ד׳"];

function splitKey(cls: string, part: number) { return `${cls}|${part}`; }
function isSplitSel(sel: string) { return sel.includes("|"); }
function parseSplit(sel: string): [string, number] {
  const idx = sel.lastIndexOf("|");
  return [sel.slice(0, idx), parseInt(sel.slice(idx + 1))];
}
function splitLabel(cls: string, part: number) { return `${cls} — ${PART_LABELS[part]}`; }

// ─── Types ────────────────────────────────────────────────────────────────────

type CrewMember   = { name: string; phone: string; note?: string };
type ExtraTeacher = { role: string; name: string; phone: string; note?: string };

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
  actual?: Record<string, string>;
  splits?: Record<string, string[]>;
  splitStudents?: Record<string, Record<string, string[]>>;
};

type VavData = {
  days:   DayData[];
  actual: Record<string, string>;
  splits: Record<string, string[]>;
  splitStudents?: Record<string, Record<string, string[]>>;
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
  return {
    id: crypto.randomUUID(),
    label: `יום ${n}`,
    buses: [],
    actual: {},
    splits: {},
    splitStudents: {},
  };
}

const DRIVER_IDX = CREW_ROLES.indexOf("נהג");

function calcEscorts(bus: Bus): number {
  const crewCount = (bus.crew ?? []).filter(
    (c, i) => i !== DRIVER_IDX && Boolean(c?.name?.trim() || c?.phone?.trim())
  ).length;
  const extraCount = (bus.extraTeachers ?? []).filter(
    (e) => e?.role !== "נהג" && Boolean(e?.name?.trim() || e?.phone?.trim())
  ).length;
  return crewCount + extraCount;
}

function cloneSplits(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, string[]> = {};
  for (const [cls, arr] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(arr)) {
      result[cls] = arr.map((v) => String(v ?? ""));
    }
  }
  return result;
}

// Normalize splitStudents so that it stores objects with string keys { "0": [...], "1": [...] }
// avoiding Firestore's error on nested arrays (arrays inside arrays are disallowed by Firestore)
function normalizeSplitStudents(raw: unknown): Record<string, Record<string, string[]>> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, Record<string, string[]>> = {};

  for (const [cls, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val) continue;
    result[cls] = {};

    if (Array.isArray(val)) {
      // Legacy array-of-arrays format
      val.forEach((arr, pi) => {
        if (Array.isArray(arr)) {
          result[cls][String(pi)] = arr.filter((x): x is string => typeof x === "string");
        }
      });
    } else if (typeof val === "object") {
      // Map format { "0": [...], "1": [...] }
      for (const [partIdxStr, arr] of Object.entries(val as Record<string, unknown>)) {
        if (Array.isArray(arr)) {
          result[cls][partIdxStr] = arr.filter((x): x is string => typeof x === "string");
        }
      }
    }
  }

  return result;
}

// Migrate legacy flat `buses` array and top-level `splits` to per-day structure
function migrateData(raw: Record<string, unknown>): VavData {
  const fallbackSplits = cloneSplits(raw.splits);
  const fallbackSplitStudents = normalizeSplitStudents(raw.splitStudents);
  const fallbackActual = (raw.actual as Record<string, string>) ?? {};

  if (Array.isArray(raw.days) && raw.days.length > 0) {
    const days = (raw.days as DayData[]).map((d) => ({
      ...d,
      buses: (d.buses ?? []).map((b: Bus) => ({
        ...b,
        crew:            CREW_ROLES.map((_, ri) => b.crew?.[ri] ?? { name: "", phone: "" }),
        extraTeachers:   b.extraTeachers   ?? [],
        classSelections: b.classSelections ?? ["", "", "", ""],
      })),
      actual: d.actual ? { ...d.actual } : { ...fallbackActual },
      splits: d.splits ? cloneSplits(d.splits) : cloneSplits(fallbackSplits),
      splitStudents: d.splitStudents
        ? normalizeSplitStudents(d.splitStudents)
        : normalizeSplitStudents(fallbackSplitStudents),
    }));

    return {
      days,
      actual: days[0]?.actual ?? fallbackActual,
      splits: days[0]?.splits ?? fallbackSplits,
      splitStudents: days[0]?.splitStudents ?? fallbackSplitStudents,
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
    days: [
      {
        id: crypto.randomUUID(),
        label: "יום 1",
        buses: legacyBuses,
        actual: { ...fallbackActual },
        splits: cloneSplits(fallbackSplits),
        splitStudents: normalizeSplitStudents(fallbackSplitStudents),
      },
    ],
    actual: fallbackActual,
    splits: fallbackSplits,
    splitStudents: fallbackSplitStudents,
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
  const [collapsedBuses, setCollapsedBuses] = useState<Set<string>>(new Set());
  const [activeSplitDayId, setActiveSplitDayId] = useState<string>("");
  const [splitModalTarget, setSplitModalTarget] = useState<{ dayId: string; cls: string } | null>(null);
  const [openBusRosters, setOpenBusRosters] = useState<Set<string>>(new Set());
  const [exportTarget, setExportTarget] = useState<{ dayId: string; cls: string; partIdx: number | "all" } | null>(null);
  const [exportIncludePhones, setExportIncludePhones] = useState(false);
  const [copiedPartKey, setCopiedPartKey] = useState<string | null>(null);
  const [topPdfLoading, setTopPdfLoading] = useState(false);
  const [busRosterPdfLoadingId, setBusRosterPdfLoadingId] = useState<string | null>(null);

  const classControlRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending = useRef(false);
  const latestDataRef = useRef(data);
  latestDataRef.current = data;

  const activeSplitDay = data.days.find((d) => d.id === activeSplitDayId) ?? data.days[0] ?? null;

  function getDaySplits(day?: DayData | null): Record<string, string[]> {
    return day?.splits ?? data.splits ?? {};
  }

  function getDaySplitStudents(day?: DayData | null): Record<string, Record<string, string[]>> {
    return day?.splitStudents ?? data.splitStudents ?? {};
  }

  function getDayActual(day?: DayData | null): Record<string, string> {
    return day?.actual ?? data.actual ?? {};
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  const uiStorageKeyDays = `tiktiyul-vav-collapsed-days-${tripId}`;
  const uiStorageKeyBuses = `tiktiyul-vav-collapsed-buses-${tripId}`;

  useEffect(() => {
    try {
      const savedDays = localStorage.getItem(uiStorageKeyDays);
      if (savedDays) {
        const parsed = JSON.parse(savedDays);
        if (Array.isArray(parsed)) setCollapsed(new Set(parsed.filter((x): x is string => typeof x === "string")));
      }
      const savedBuses = localStorage.getItem(uiStorageKeyBuses);
      if (savedBuses) {
        const parsed = JSON.parse(savedBuses);
        if (Array.isArray(parsed)) setCollapsedBuses(new Set(parsed.filter((x): x is string => typeof x === "string")));
      }
    } catch {
      // ignore localStorage errors
    }
  }, [uiStorageKeyDays, uiStorageKeyBuses]);

  function persistCollapsedDays(next: Set<string>) {
    try {
      localStorage.setItem(uiStorageKeyDays, JSON.stringify(Array.from(next)));
    } catch {
      // ignore localStorage errors
    }
  }

  function persistCollapsedBuses(next: Set<string>) {
    try {
      localStorage.setItem(uiStorageKeyBuses, JSON.stringify(Array.from(next)));
    } catch {
      // ignore localStorage errors
    }
  }

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "vav", (raw) => {
      if (isPending.current) return;
      if (raw) {
        const migrated = migrateData(raw as Record<string, unknown>);
        setData(migrated);
        setActiveSplitDayId((prev) =>
          migrated.days.some((d) => d.id === prev) ? prev : (migrated.days[0]?.id ?? "")
        );
      }
    });
    return () => {
      unsub();
      clearTimeout(saveTimer.current);
      if (isPending.current && latestDataRef.current) {
        saveAppendix(tripId, "vav", latestDataRef.current as unknown as Record<string, unknown>).catch((err) => {
          console.error("Failed to flush appendix vav on unmount:", err);
        });
      }
    };
  }, [tripId]);

  // ── Save ───────────────────────────────────────────────────────────────────

  function save(updated: VavData, immediate = false) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);

    const executeSave = async () => {
      try {
        await saveAppendix(tripId, "vav", updated as unknown as Record<string, unknown>);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } catch (err) {
        console.error("Failed to save appendix vav:", err);
        setStatus("idle");
      } finally {
        isPending.current = false;
      }
    };

    if (immediate) {
      void executeSave();
    } else {
      saveTimer.current = setTimeout(executeSave, 1000);
    }
  }

  function update(updated: VavData, immediate = false) {
    const primaryDay = updated.days[0];
    const normalized: VavData = primaryDay
      ? {
          ...updated,
          actual: primaryDay.actual ?? updated.actual,
          splits: primaryDay.splits ?? updated.splits,
          splitStudents: primaryDay.splitStudents ?? updated.splitStudents,
        }
      : updated;
    setData(normalized);
    save(normalized, immediate);
  }

  function updateDay(dayId: string, updater: (day: DayData) => DayData, immediate = false) {
    const days = data.days.map((d) => (d.id === dayId ? updater(d) : d));
    update({ ...data, days }, immediate);
  }

  // ── Day mutations ──────────────────────────────────────────────────────────

  function addDay() {
    const newDay = makeDay(data.days.length + 1);
    update({ ...data, days: [...data.days, newDay] });
    setActiveSplitDayId(newDay.id);
  }

  function deleteDay(dayId: string) {
    if (!confirm("למחוק יום זה וכל האוטובוסים שבו?")) return;
    const remaining = data.days.filter((d) => d.id !== dayId);
    update({ ...data, days: remaining });
    if (activeSplitDayId === dayId) {
      setActiveSplitDayId(remaining[0]?.id ?? "");
    }
  }

  function setDayLabel(dayId: string, label: string) {
    updateDay(dayId, (d) => ({ ...d, label }));
  }

  function toggleCollapse(dayId: string) {
    const wasCollapsed = collapsed.has(dayId);
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) { next.delete(dayId); } else { next.add(dayId); }
      persistCollapsedDays(next);
      return next;
    });
    if (wasCollapsed) {
      setActiveSplitDayId(dayId);
    }
  }

  function collapseAll() {
    const next = new Set(data.days.map((d) => d.id));
    setCollapsed(next);
    persistCollapsedDays(next);
  }

  function expandAll() {
    const next = new Set<string>();
    setCollapsed(next);
    persistCollapsedDays(next);
  }

  function toggleBusCollapse(busId: string) {
    setCollapsedBuses((prev) => {
      const next = new Set(prev);
      if (next.has(busId)) { next.delete(busId); } else { next.add(busId); }
      persistCollapsedBuses(next);
      return next;
    });
  }

  function toggleAllDayBuses(day: DayData) {
    const allBusIds = day.buses.map((b) => b.id);
    const allCollapsedInDay = allBusIds.length > 0 && allBusIds.every((id) => collapsedBuses.has(id));
    setCollapsedBuses((prev) => {
      const next = new Set(prev);
      if (allCollapsedInDay) {
        allBusIds.forEach((id) => next.delete(id));
      } else {
        allBusIds.forEach((id) => next.add(id));
      }
      persistCollapsedBuses(next);
      return next;
    });
  }

  function focusDaySplits(dayId: string) {
    setActiveSplitDayId(dayId);
    classControlRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Bus mutations ──────────────────────────────────────────────────────────

  function updateDayBuses(dayId: string, buses: Bus[]) {
    updateDay(dayId, (d) => ({ ...d, buses }));
  }

  function addBus(dayId: string) {
    const day = data.days.find((d) => d.id === dayId)!;
    setActiveSplitDayId(dayId);
    updateDayBuses(dayId, [...day.buses, makeBus()]);
  }

  function deleteBus(dayId: string, busIdx: number) {
    const day = data.days.find((d) => d.id === dayId)!;
    updateDayBuses(dayId, day.buses.filter((_, j) => j !== busIdx));
  }

  function setBusClass(dayId: string, busIdx: number, slotIdx: number, val: string) {
    const day = data.days.find((d) => d.id === dayId)!;
    setActiveSplitDayId(dayId);
    const buses = day.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const cs = [...b.classSelections];
      cs[slotIdx] = val;
      return { ...b, classSelections: cs };
    });
    updateDayBuses(dayId, buses);
  }

  function setCrewField(dayId: string, busIdx: number, roleIdx: number, field: "name" | "phone" | "note", val: string) {
    const day = data.days.find((d) => d.id === dayId)!;
    const buses = day.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const baseCrew = CREW_ROLES.map((_, ri) => b.crew?.[ri] ?? { name: "", phone: "" });
      const crew = baseCrew.map((c, ri) => ri === roleIdx ? { ...c, [field]: val } : c);
      return { ...b, crew };
    });
    updateDayBuses(dayId, buses);
  }

  function selectStaff(dayId: string, busIdx: number, roleIdx: number, name: string) {
    const member = staff.find((s) => s.name === name);
    const day = data.days.find((d) => d.id === dayId)!;
    const buses = day.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const baseCrew = CREW_ROLES.map((_, ri) => b.crew?.[ri] ?? { name: "", phone: "" });
      const crew = baseCrew.map((c, ri) =>
        ri === roleIdx ? { ...c, name, phone: member?.phone ?? (name ? c.phone : "") } : c
      );
      return { ...b, crew };
    });
    updateDayBuses(dayId, buses);
  }

  function addExtraTeacher(dayId: string, busIdx: number) {
    const day = data.days.find((d) => d.id === dayId)!;
    const buses = day.buses.map((b, i) =>
      i === busIdx
        ? { ...b, extraTeachers: [...b.extraTeachers, { role: "מורה", name: "", phone: "", note: "" }] }
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

  function setExtraTeacher(dayId: string, busIdx: number, ti: number, field: keyof ExtraTeacher, val: string, fromSelect = false) {
    const day = data.days.find((d) => d.id === dayId)!;
    const buses = day.buses.map((b, i) => {
      if (i !== busIdx) return b;
      const extraTeachers = b.extraTeachers.map((e, j) => {
        if (j !== ti) return e;
        if (field === "name") {
          const member = staff.find((s) => s.name === val);
          return {
            ...e,
            name: val,
            role: fromSelect && member?.role?.trim() ? member.role.trim() : e.role,
            phone: member?.phone ?? (fromSelect && !val ? "" : e.phone),
          };
        }
        return { ...e, [field]: val };
      });
      return { ...b, extraTeachers };
    });
    updateDayBuses(dayId, buses);
  }

  // ── Class / split mutations (per day) ──────────────────────────────────────

  function setActual(cls: string, val: string, targetDayId = activeSplitDay?.id) {
    if (!targetDayId) {
      update({ ...data, actual: { ...data.actual, [cls]: val } });
      return;
    }
    updateDay(targetDayId, (d) => ({
      ...d,
      actual: { ...getDayActual(d), [cls]: val },
    }));
  }

  function splitClass(cls: string, targetDayId = activeSplitDay?.id) {
    if (!targetDayId) return;
    updateDay(targetDayId, (d) => ({
      ...d,
      splits: { ...getDaySplits(d), [cls]: ["", ""] },
      splitStudents: { ...getDaySplitStudents(d), [cls]: { "0": [], "1": [] } },
    }));
  }

  function unsplitClass(cls: string, targetDayId = activeSplitDay?.id) {
    if (!targetDayId) return;
    updateDay(
      targetDayId,
      (d) => {
        const splits = { ...getDaySplits(d) };
        delete splits[cls];
        const splitStudents = { ...getDaySplitStudents(d) };
        delete splitStudents[cls];
        const buses = d.buses.map((b) => ({
          ...b,
          classSelections: b.classSelections.map((sel) =>
            isSplitSel(sel) && parseSplit(sel)[0] === cls ? "" : sel
          ),
        }));
        return { ...d, splits, splitStudents, buses };
      },
      true
    );
  }

  function setSplitCount(cls: string, partIdx: number, val: string, targetDayId = activeSplitDay?.id) {
    if (!targetDayId) return;
    updateDay(targetDayId, (d) => {
      const daySplits = getDaySplits(d);
      const parts = [...(daySplits[cls] ?? [])];
      parts[partIdx] = val;
      return { ...d, splits: { ...daySplits, [cls]: parts } };
    });
  }

  function addSplitPart(cls: string, targetDayId = activeSplitDay?.id) {
    if (!targetDayId) return;
    updateDay(targetDayId, (d) => {
      const daySplits = getDaySplits(d);
      const parts = [...(daySplits[cls] ?? [])];
      if (parts.length >= 4) return d;
      const newIdx = parts.length;
      parts.push("");
      const daySplitStudents = getDaySplitStudents(d);
      const clsMap = { ...(daySplitStudents[cls] ?? {}) };
      clsMap[String(newIdx)] = [];
      return {
        ...d,
        splits: { ...daySplits, [cls]: parts },
        splitStudents: { ...daySplitStudents, [cls]: clsMap },
      };
    });
  }

  function removeSplitPart(cls: string, targetDayId = activeSplitDay?.id) {
    if (!targetDayId) return;
    updateDay(targetDayId, (d) => {
      const daySplits = getDaySplits(d);
      const parts = [...(daySplits[cls] ?? [])];
      if (parts.length <= 2) return d;
      const removedPartIdx = parts.length - 1;
      parts.pop();
      const daySplitStudents = getDaySplitStudents(d);
      const clsMap = { ...(daySplitStudents[cls] ?? {}) };
      delete clsMap[String(removedPartIdx)];
      const removedKey = splitKey(cls, removedPartIdx);
      const buses = d.buses.map((b) => ({
        ...b,
        classSelections: b.classSelections.map((sel) => (sel === removedKey ? "" : sel)),
      }));
      return {
        ...d,
        splits: { ...daySplits, [cls]: parts },
        splitStudents: { ...daySplitStudents, [cls]: clsMap },
        buses,
      };
    });
  }

  function handleSaveSplitStudents(targetDayId: string, cls: string, newSplitStudents: string[][]) {
    updateDay(
      targetDayId,
      (d) => {
        const daySplits = getDaySplits(d);
        const currentParts = daySplits[cls] ?? [];
        const updatedParts = currentParts.map((count, pi) => {
          const assignedCount = newSplitStudents[pi]?.length ?? 0;
          return assignedCount > 0 ? String(assignedCount) : (count || "");
        });

        const partsMap: Record<string, string[]> = {};
        newSplitStudents.forEach((ids, pi) => {
          partsMap[String(pi)] = ids;
        });

        const daySplitStudents = getDaySplitStudents(d);
        return {
          ...d,
          splits: { ...daySplits, [cls]: updatedParts },
          splitStudents: { ...daySplitStudents, [cls]: partsMap },
        };
      },
      true
    );
  }

  function copySplitsFromDay(sourceDayId: string, targetDayId = activeSplitDay?.id) {
    if (!targetDayId || sourceDayId === targetDayId) return;
    const sourceDay = data.days.find((d) => d.id === sourceDayId);
    if (!sourceDay) return;

    const copiedSplits = cloneSplits(getDaySplits(sourceDay));
    const copiedSplitStudents = normalizeSplitStudents(getDaySplitStudents(sourceDay));

    updateDay(
      targetDayId,
      (d) => {
        // Clean up any bus selections on targetDay that don't match the new split structure
        const buses = d.buses.map((b) => ({
          ...b,
          classSelections: b.classSelections.map((sel) => {
            if (!sel) return "";
            if (isSplitSel(sel)) {
              const [cls, part] = parseSplit(sel);
              const parts = copiedSplits[cls];
              if (!parts || parts.length < 2 || part >= parts.length) return "";
              return sel;
            }
            // Whole class selected, but now it is split in copiedSplits
            if (copiedSplits[sel] && copiedSplits[sel].length >= 2) {
              return "";
            }
            return sel;
          }),
        }));

        return {
          ...d,
          splits: copiedSplits,
          splitStudents: copiedSplitStudents,
          buses,
        };
      },
      true
    );
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

  function getPartAssignedStudents(day: DayData | null | undefined, cls: string, partIdx: number): Student[] {
    const daySplitStudents = getDaySplitStudents(day);
    const partStudentIds =
      daySplitStudents[cls]?.[partIdx] ??
      daySplitStudents[cls]?.[String(partIdx)] ??
      [];
    return (partStudentIds
      .map((id) => goingStudents.find((s) => s.id === id))
      .filter(Boolean) as Student[])
      .sort((a, b) => {
        const l = (a.lastName || "").localeCompare(b.lastName || "", "he");
        return l !== 0 ? l : (a.firstName || "").localeCompare(b.firstName || "", "he");
      });
  }

  function getPartBusLabels(day: DayData | null | undefined, cls: string, partIdx: number): string[] {
    if (!day) return [];
    const key = splitKey(cls, partIdx);
    const labels: string[] = [];
    day.buses.forEach((bus, bi) => {
      if (bus.classSelections.includes(key)) {
        const label = data.days.length > 1 ? `${day.label} — אוטובוס ${bi + 1}` : `אוטובוס ${bi + 1}`;
        if (!labels.includes(label)) labels.push(label);
      }
    });
    return labels;
  }

  function buildPartWhatsAppText(day: DayData | null | undefined, cls: string, partIdx: number, includePhones = false): string {
    const partStudents = getPartAssignedStudents(day, cls, partIdx);
    const busLabels = getPartBusLabels(day, cls, partIdx);
    const daySuffix = data.days.length > 1 && day ? ` — ${day.label}` : "";
    const headerLines = [
      `*רשימת תלמידים — כיתה ${cls} (${PART_LABELS[partIdx]})${daySuffix}*`,
      ...(trip?.name ? [`📍 ${trip.name}${trip.schoolName ? ` | ${trip.schoolName}` : ""}`] : []),
      `${busLabels.length > 0 ? `🚌 ${busLabels.join(", ")} | ` : ""}סה״כ: *${partStudents.length} תלמידים*`,
    ];
    const studentLines = partStudents.map((s, idx) => {
      const phoneSuffix = includePhones && s.phone ? ` (${s.phone})` : "";
      return `${idx + 1}. ${s.firstName} ${s.lastName}${phoneSuffix}`;
    });
    return `${headerLines.join("\n")}\n\n${studentLines.join("\n")}`;
  }

  function buildAllPartsWhatsAppText(day: DayData | null | undefined, cls: string, includePhones = false): string {
    const parts = getDaySplits(day)[cls] ?? [];
    const daySuffix = data.days.length > 1 && day ? ` — ${day.label}` : "";
    const sections = parts
      .map((_, pi) => {
        const partStudents = getPartAssignedStudents(day, cls, pi);
        if (partStudents.length === 0) return "";
        const busLabels = getPartBusLabels(day, cls, pi);
        const busSuffix = busLabels.length > 0 ? ` — 🚌 ${busLabels.join(", ")}` : "";
        const lines = partStudents.map((s, idx) => {
          const phoneSuffix = includePhones && s.phone ? ` (${s.phone})` : "";
          return `${idx + 1}. ${s.firstName} ${s.lastName}${phoneSuffix}`;
        });
        return `*${PART_LABELS[pi]} (${partStudents.length} תלמידים)*${busSuffix}\n${lines.join("\n")}`;
      })
      .filter(Boolean);

    const header = [
      `*חלוקת תלמידים — כיתה ${cls}${daySuffix}*`,
      ...(trip?.name ? [`📍 ${trip.name}${trip.schoolName ? ` | ${trip.schoolName}` : ""}`] : []),
    ].join("\n");

    return `${header}\n\n${sections.join("\n\n")}`;
  }

  async function copySplitText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPartKey(key);
      setTimeout(() => setCopiedPartKey(null), 2200);
    } catch (err) {
      console.error("Failed to copy split list:", err);
    }
  }

  function openWhatsAppWithText(text: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  function getBusAssignedStudents(day: DayData, bus: Bus): Student[] {
    const result: Student[] = [];
    const seen = new Set<string>();
    const daySplitStudents = getDaySplitStudents(day);

    bus.classSelections.filter(Boolean).forEach((sel) => {
      if (isSplitSel(sel)) {
        const [cls, part] = parseSplit(sel);
        const studentIds = daySplitStudents[cls]?.[part] ?? daySplitStudents[cls]?.[String(part)] ?? [];
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

  // Returns all students assigned to a bus (both full classes and split class parts), sorted alphabetically
  function getBusAllStudents(day: DayData, bus: Bus): { student: Student; groupLabel: string }[] {
    const result: { student: Student; groupLabel: string }[] = [];
    const seen = new Set<string>();
    const daySplitStudents = getDaySplitStudents(day);

    bus.classSelections.filter(Boolean).forEach((sel) => {
      if (isSplitSel(sel)) {
        const [cls, part] = parseSplit(sel);
        const label = splitLabel(cls, part);
        const studentIds = daySplitStudents[cls]?.[part] ?? daySplitStudents[cls]?.[String(part)] ?? [];
        const partStudents = (studentIds
          .map((id) => goingStudents.find((s) => s.id === id))
          .filter(Boolean) as Student[])
          .sort((a, b) => {
            const l = (a.lastName || "").localeCompare(b.lastName || "", "he");
            return l !== 0 ? l : (a.firstName || "").localeCompare(b.firstName || "", "he");
          });
        partStudents.forEach((st) => {
          if (!seen.has(st.id)) {
            seen.add(st.id);
            result.push({ student: st, groupLabel: label });
          }
        });
      } else {
        const clsStudents = goingStudents
          .filter((s) => s.class === sel)
          .sort((a, b) => {
            const l = (a.lastName || "").localeCompare(b.lastName || "", "he");
            return l !== 0 ? l : (a.firstName || "").localeCompare(b.firstName || "", "he");
          });
        clsStudents.forEach((st) => {
          if (!seen.has(st.id)) {
            seen.add(st.id);
            result.push({ student: st, groupLabel: sel });
          }
        });
      }
    });

    return result;
  }

  function getBusCrewMembers(bus: Bus): { role: string; name: string; phone: string; note: string }[] {
    const list: { role: string; name: string; phone: string; note: string }[] = [];
    CREW_ROLES.forEach((role, ri) => {
      const c = bus.crew?.[ri];
      const name = (c?.name ?? "").trim();
      const phone = (c?.phone ?? "").trim();
      const note = (c?.note ?? "").trim();
      if (name || phone || note) {
        list.push({ role, name: name || "—", phone, note });
      }
    });
    (bus.extraTeachers ?? []).forEach((et) => {
      const name = (et.name ?? "").trim();
      const phone = (et.phone ?? "").trim();
      const note = (et.note ?? "").trim();
      if (name || phone || note) {
        list.push({ role: (et.role ?? "מלווה נוסף").trim(), name: name || "—", phone, note });
      }
    });
    return list;
  }

  function buildBusRosterHTML(day: DayData, bus: Bus, busIdx: number): string {
    const t = trip;
    const busNum = busIdx + 1;
    const classLabels = bus.classSelections
      .filter(Boolean)
      .map((sel) => (isSplitSel(sel) ? splitLabel(...parseSplit(sel)) : sel))
      .join(", ");
    const crewList = getBusCrewMembers(bus);
    const studentEntries = getBusAllStudents(day, bus);
    const expectedStudents = busStudentCount(day, bus);
    const escortsCount = calcEscorts(bus);

    // Check if there are any split classes selected without named students assigned
    const daySplitStudents = getDaySplitStudents(day);
    const unassignedSplits = bus.classSelections
      .filter(Boolean)
      .filter((sel) => {
        if (!isSplitSel(sel)) return false;
        const [cls, part] = parseSplit(sel);
        const ids = daySplitStudents[cls]?.[part] ?? daySplitStudents[cls]?.[String(part)] ?? [];
        return ids.length === 0;
      })
      .map((sel) => splitLabel(...parseSplit(sel)));

    const crewRowsHTML = crewList.length > 0
      ? crewList.map((c, idx) => `
          <tr>
            <td style="width:28px;text-align:center;padding:4px 6px;font-size:11.5px">${idx + 1}</td>
            <td style="width:32px;text-align:center;padding:4px 6px;font-size:13px">☐</td>
            <td style="width:120px;padding:4px 8px;font-size:11.5px;font-weight:bold;color:#1b4332">${esc(c.role)}</td>
            <td style="padding:4px 8px;font-size:11.5px;font-weight:500">${esc(c.name)}</td>
            <td style="width:110px;padding:4px 8px;font-size:11.5px;direction:ltr;text-align:right">${esc(c.phone)}</td>
            <td style="padding:4px 8px;font-size:11px;color:#555">${esc(c.note)}</td>
          </tr>`).join("")
      : `<tr><td colspan="6" style="text-align:center;padding:8px;color:#888;font-size:11.5px">לא הוזנו אנשי צוות לאוטובוס זה</td></tr>`;

    const studentRowsHTML = studentEntries.length > 0
      ? studentEntries.map(({ student: s, groupLabel }, idx) => {
          const medNote = (s.medicalNotes ?? "").trim();
          const genNote = (s.notes ?? "").trim();
          const combinedNotes = [medNote ? `רפואי: ${medNote}` : "", genNote].filter(Boolean).join(" | ");
          return `
            <tr>
              <td style="width:28px;text-align:center;padding:4px 6px;font-size:11.5px">${idx + 1}</td>
              <td style="width:32px;text-align:center;padding:4px 6px;font-size:13px">☐</td>
              <td style="width:32px;text-align:center;padding:4px 6px;font-size:13px">☐</td>
              <td style="padding:4px 8px;font-size:12px;font-weight:500">${esc(s.lastName)} ${esc(s.firstName)}</td>
              <td style="width:95px;padding:4px 8px;font-size:11.5px;text-align:center">${esc(groupLabel)}</td>
              <td style="width:105px;padding:4px 8px;font-size:11px;direction:ltr;text-align:right">${esc(s.phone ?? "")}</td>
              <td style="padding:4px 8px;font-size:10.5px;color:#444">${esc(combinedNotes)}</td>
            </tr>`;
        }).join("")
      : `<tr><td colspan="7" style="text-align:center;padding:12px;color:#888;font-size:11.5px">לא נמצאו שמות תלמידים משובצים לאוטובוס זה</td></tr>`;

    const missingSplitWarningHTML = unassignedSplits.length > 0
      ? `<div style="margin-bottom:10px;padding:6px 10px;background:#fff8e1;border:1px solid #ffe082;border-radius:4px;font-size:11px;color:#856404">
           שים לב: עבור <strong>${esc(unassignedSplits.join(", "))}</strong> טרם שובצו שמות תלמידים ספציפיים בפיצול הכיתות (מוצגת כמות מתוכננת של ${expectedStudents} תלמידים).
         </div>`
      : "";

    return `
      <div class="header" style="padding-bottom:8px;margin-bottom:12px">
        <div class="title" style="font-size:18px;margin-top:0">רשימה שמית ובדיקת נוכחות — אוטובוס ${busNum}${data.days.length > 1 ? ` (${esc(day.label)})` : ""}</div>
        ${t ? `<div class="ministry" style="font-size:11.5px;margin-top:2px">${esc(t.name ?? "")}${t.schoolName ? ` | ${esc(t.schoolName)}` : ""}</div>` : ""}
      </div>

      <div style="display:flex;gap:18px;flex-wrap:wrap;background:#f4faf6;border:1px solid #c3e6cb;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12px">
        <span><strong>יום:</strong> ${esc(day.label)}</span>
        <span><strong>אוטובוס:</strong> ${busNum}</span>
        <span><strong>כיתות:</strong> ${esc(classLabels || "—")}</span>
        <span><strong>תלמידים:</strong> ${studentEntries.length || expectedStudents}</span>
        <span><strong>מלווים (ללא נהג):</strong> ${escortsCount}</span>
        <span><strong>סה״כ נוסעים:</strong> ${(studentEntries.length || expectedStudents) + escortsCount}</span>
      </div>

      <div class="section-title" style="font-size:13px;margin:8px 0 6px;color:#1b4332">צוות ומלווים באוטובוס</div>
      <table style="margin-bottom:14px">
        <thead>
          <tr>
            <th style="width:28px;text-align:center;padding:4px 6px;font-size:11px">#</th>
            <th style="width:32px;text-align:center;padding:4px 6px;font-size:11px">נוכח</th>
            <th style="width:120px;padding:4px 8px;font-size:11px">תפקיד</th>
            <th style="padding:4px 8px;font-size:11px">שם מלא</th>
            <th style="width:110px;padding:4px 8px;font-size:11px">טלפון</th>
            <th style="padding:4px 8px;font-size:11px">הערות</th>
          </tr>
        </thead>
        <tbody>${crewRowsHTML}</tbody>
      </table>

      <div class="section-title" style="font-size:13px;margin:10px 0 6px;color:#1b4332">
        רשימת תלמידים באוטובוס (${studentEntries.length} שמות)
      </div>
      ${missingSplitWarningHTML}
      <table>
        <thead>
          <tr>
            <th style="width:28px;text-align:center;padding:4px 6px;font-size:11px">#</th>
            <th style="width:32px;text-align:center;padding:4px 6px;font-size:10.5px">עלייה</th>
            <th style="width:32px;text-align:center;padding:4px 6px;font-size:10.5px">חזרה</th>
            <th style="padding:4px 8px;font-size:11px">שם התלמיד/ה (משפחה ופרטי)</th>
            <th style="width:95px;text-align:center;padding:4px 8px;font-size:11px">כיתה</th>
            <th style="width:105px;padding:4px 8px;font-size:11px">טלפון</th>
            <th style="padding:4px 8px;font-size:11px">הערות / רפואי</th>
          </tr>
        </thead>
        <tbody>${studentRowsHTML}</tbody>
      </table>
    `;
  }

  function printBusRoster(day: DayData, bus: Bus, busIdx: number) {
    const title = `רשימה שמית — אוטובוס ${busIdx + 1}${data.days.length > 1 ? ` — ${day.label}` : ""}`;
    printHTML(buildBusRosterHTML(day, bus, busIdx), title);
  }

  async function shareBusRosterPDF(day: DayData, bus: Bus, busIdx: number) {
    const title = `רשימה שמית — אוטובוס ${busIdx + 1}${data.days.length > 1 ? ` — ${day.label}` : ""}`;
    setBusRosterPdfLoadingId(bus.id);
    try {
      await sharePDF(buildBusRosterHTML(day, bus, busIdx), title);
    } finally {
      setBusRosterPdfLoadingId(null);
    }
  }

  const plannedByClass: Record<string, number> = {};
  goingStudents.forEach((s) => { plannedByClass[s.class] = (plannedByClass[s.class] ?? 0) + 1; });
  const classNames = Object.keys(plannedByClass).sort((a, b) => a.localeCompare(b, "he"));

  function busStudentCount(day: DayData, bus: Bus): number {
    const daySplits = getDaySplits(day);
    return bus.classSelections.filter(Boolean).reduce((sum, sel) => {
      if (isSplitSel(sel)) {
        const [cls, part] = parseSplit(sel);
        return sum + (parseInt(daySplits[cls]?.[part] ?? "0") || 0);
      }
      return sum + (plannedByClass[sel] ?? 0);
    }, 0);
  }

  function dayTotals(day: DayData) {
    const students = day.buses.reduce((s, b) => s + busStudentCount(day, b), 0);
    const escorts  = day.buses.reduce((s, b) => s + calcEscorts(b), 0);
    return { students, escorts, total: students + escorts };
  }

  function classOptions(day: DayData) {
    const daySplits = getDaySplits(day);
    const opts: { value: string; label: string }[] = [];
    classNames.forEach((cls) => {
      const parts = daySplits[cls];
      if (parts && parts.length >= 2) {
        parts.forEach((_, pi) => opts.push({ value: splitKey(cls, pi), label: splitLabel(cls, pi) }));
      } else {
        opts.push({ value: cls, label: `${cls} (${plannedByClass[cls]})` });
      }
    });
    return opts;
  }

  function getUnassignedStaffForDay(day: DayData | null | undefined) {
    if (!day) return staff;
    const assignedNames = new Set<string>();
    day.buses.forEach((b) => {
      b.crew.forEach((c) => {
        if (c.name?.trim()) assignedNames.add(c.name.trim());
      });
      b.extraTeachers.forEach((et) => {
        if (et.name?.trim()) assignedNames.add(et.name.trim());
      });
    });
    return staff.filter((s) => s.name?.trim() && !assignedNames.has(s.name.trim()));
  }

  // ── Print HTML ─────────────────────────────────────────────────────────────

  function getHTML() {
    const t = trip;

    function renderCrewCell(name?: string, phone?: string, rolePrefix?: string, note?: string) {
      const cleanName = (name ?? "").trim();
      const cleanPhone = (phone ?? "").trim();
      const cleanNote = (note ?? "").trim();
      if (!cleanName && !cleanPhone && !cleanNote) return "";
      const prefixHTML = rolePrefix ? `<span style="color:#555;font-size:9.5px">${esc(rolePrefix)}: </span>` : "";
      const nameHTML = cleanName ? `<div style="font-weight:500;line-height:1.25">${prefixHTML}${esc(cleanName)}</div>` : "";
      const noteHTML = cleanNote ? `<div style="font-size:9.5px;color:#555;line-height:1.2;margin-top:${cleanName ? "1px" : "0"}">(${esc(cleanNote)})</div>` : "";
      const phoneHTML = cleanPhone
        ? `<div style="direction:ltr;font-size:9.5px;color:#444;line-height:1.2;margin-top:${cleanName || cleanNote ? "1px" : "0"}">${esc(cleanPhone)}</div>`
        : "";
      return `${nameHTML}${noteHTML}${phoneHTML}`;
    }

    function dayTable(day: DayData) {
      const n = day.buses.length;
      if (n === 0) return `<p style="color:#aaa;font-size:10px;text-align:center;margin:8px 0">לא הוזנו אוטובוסים</p>`;

      const busHeaders = day.buses.map((b, bi) => {
        const labels = b.classSelections.filter(Boolean).map((sel) =>
          isSplitSel(sel) ? splitLabel(...parseSplit(sel)) : sel
        ).join(", ");
        const sc = busStudentCount(day, b);
        return `<th style="padding:4px 5px;border:1px solid #999;font-size:11px;font-weight:bold;background:#1b4332;color:white;text-align:center">
          אוטובוס ${bi + 1}${labels ? `<br><span style="font-weight:normal;font-size:10px">${esc(labels)}</span>` : ""}${sc ? `<br><span style="font-weight:normal;font-size:9.5px">${sc} תלמידים</span>` : ""}
        </th>`;
      }).join("");

      const crewRows = CREW_ROLES.map((role, ri) => `
        <tr>
          <td style="padding:3.5px 6px;border:1px solid #bbb;font-size:10.5px;font-weight:bold;color:#1b4332;background:#eef7f1;white-space:nowrap">${role}</td>
          ${day.buses.map((b) => `<td style="padding:3.5px 5px;border:1px solid #ccc;font-size:10.5px;text-align:center;vertical-align:middle">${renderCrewCell(b.crew[ri]?.name, b.crew[ri]?.phone, undefined, b.crew[ri]?.note)}</td>`).join("")}
        </tr>`).join("");

      const maxExtra = Math.max(0, ...day.buses.map((b) => b.extraTeachers.length));
      const extraRows = Array.from({ length: maxExtra }, (_, ei) => `
        <tr>
          <td style="padding:3.5px 6px;border:1px solid #bbb;font-size:10.5px;font-weight:bold;color:#1b4332;background:#eef7f1;white-space:nowrap">מלווה נוסף ${ei + 1}</td>
          ${day.buses.map((b) => {
            const e = b.extraTeachers[ei];
            return `<td style="padding:3.5px 5px;border:1px solid #ccc;font-size:10.5px;text-align:center;vertical-align:middle">${e ? renderCrewCell(e.name, e.phone, e.role, e.note) : ""}</td>`;
          }).join("")}
        </tr>`).join("");

      const dt = dayTotals(day);
      return `
        <table style="table-layout:fixed;width:100%;margin-bottom:4px">
          <thead><tr>
            <th style="padding:4px 6px;border:1px solid #999;font-size:10.5px;background:#1b4332;color:white;width:92px">תפקיד / אוטובוס</th>
            ${busHeaders}
          </tr></thead>
          <tbody>
            <tr style="background:#e8f5e9">
              <td style="padding:3.5px 6px;border:1px solid #ccc;font-size:10.5px;font-weight:bold">כיתות</td>
              ${day.buses.map((b) => `<td style="padding:3.5px 5px;border:1px solid #ccc;font-size:10.5px;text-align:center">${b.classSelections.filter(Boolean).map((sel) => isSplitSel(sel) ? splitLabel(...parseSplit(sel)) : sel).join(", ")}</td>`).join("")}
            </tr>
            ${crewRows}${extraRows}
            <tr style="background:#e8f5e9">
              <td style="padding:3.5px 6px;border:1px solid #ccc;font-size:10.5px;font-weight:bold">מספר תלמידים</td>
              ${day.buses.map((b) => `<td style="padding:3.5px 5px;border:1px solid #ccc;font-size:10.5px;text-align:center;font-weight:bold">${busStudentCount(day, b) || ""}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:3.5px 6px;border:1px solid #ccc;font-size:10.5px;font-weight:bold">מספר מלווים</td>
              ${day.buses.map((b) => `<td style="padding:3.5px 5px;border:1px solid #ccc;font-size:10.5px;text-align:center">${calcEscorts(b) || ""}</td>`).join("")}
            </tr>
            <tr style="background:#d4edda;font-weight:bold">
              <td style="padding:3.5px 6px;border:1px solid #ccc;font-size:10.5px">סה"כ באוטובוס</td>
              ${day.buses.map((b) => `<td style="padding:3.5px 5px;border:1px solid #ccc;font-size:10.5px;text-align:center;font-weight:bold">${(busStudentCount(day, b) + calcEscorts(b)) || ""}</td>`).join("")}
            </tr>
          </tbody>
        </table>
        <div style="font-size:10.5px;color:#555;margin-top:3px">
          סה"כ ביום: <strong>${dt.students}</strong> תלמידים · <strong>${dt.escorts}</strong> מלווים · <strong>${dt.total}</strong> סה"כ
        </div>`;
    }

    function renderDayPage(day: DayData) {
      const dayActual = getDayActual(day);
      const daySplits = getDaySplits(day);
      const daySplitStudents = getDaySplitStudents(day);
      const dt = dayTotals(day);

      const classRows = classNames.flatMap((cls) => {
        const parts = daySplits[cls];
        if (parts && parts.length >= 2) {
          const splitSum = parts.reduce((s, v) => s + (parseInt(v) || 0), 0);
          return [
            `<tr style="background:#fff8e1">
              <td style="padding:2.5px 6px;border:1px solid #ddd;font-size:10.5px;font-weight:bold">${esc(cls)}</td>
              <td style="padding:2.5px 6px;border:1px solid #ddd;font-size:10.5px;text-align:center;font-weight:bold">${esc(plannedByClass[cls])}</td>
              <td style="padding:2.5px 6px;border:1px solid #ddd;font-size:10.5px;text-align:center">${esc(dayActual[cls] || (splitSum ? String(splitSum) : ""))}</td>
            </tr>`,
            ...parts.map((count, pi) => `<tr style="background:#fffde7">
              <td style="padding:2px 6px 2px 14px;border:1px solid #ddd;font-size:9.5px;color:#666">${PART_LABELS[pi]}</td>
              <td style="padding:2px 6px;border:1px solid #ddd;font-size:9.5px;text-align:center">${count || "—"}</td>
              <td style="border:1px solid #ddd"></td>
            </tr>`),
            splitSum > 0 && splitSum !== plannedByClass[cls]
              ? `<tr style="background:#fff3cd"><td colspan="3" style="padding:2px 6px;font-size:9.5px;color:#856404;border:1px solid #ddd">סה״כ חלקים: ${splitSum} ${splitSum > plannedByClass[cls] ? "⚠ חורג" : ""}</td></tr>`
              : "",
          ].filter(Boolean);
        }

        return [`<tr>
          <td style="padding:2.5px 6px;border:1px solid #ddd;font-size:10.5px">${esc(cls)}</td>
          <td style="padding:2.5px 6px;border:1px solid #ddd;font-size:10.5px;text-align:center;font-weight:bold">${esc(plannedByClass[cls])}</td>
          <td style="padding:2.5px 6px;border:1px solid #ddd;font-size:10.5px;text-align:center">${esc(dayActual[cls])}</td>
        </tr>`];
      }).join("") || `<tr><td colspan="3" style="padding:6px;color:#aaa;text-align:center;font-size:10.5px">אין נתוני תלמידים</td></tr>`;

      const actualTotal = classNames.reduce((sum, cls) => {
        const parts = daySplits[cls];
        if (parts && parts.length >= 2) {
          const splitSum = parts.reduce((s, v) => s + (parseInt(v) || 0), 0);
          return sum + (parseInt(dayActual[cls]) || splitSum || 0);
        }
        return sum + (parseInt(dayActual[cls]) || 0);
      }, 0);

      const classFooterRow = classNames.length > 0 ? `
        <tfoot>
          <tr style="background:#e8f5e9;font-weight:bold">
            <td style="padding:3px 6px;border:1px solid #bbb;font-size:10.5px;color:#1b4332">סה"כ</td>
            <td style="padding:3px 6px;border:1px solid #bbb;font-size:10.5px;text-align:center;color:#1b4332">${goingStudents.length}</td>
            <td style="padding:3px 6px;border:1px solid #bbb;font-size:10.5px;text-align:center;color:#1b4332">${actualTotal || ""}</td>
          </tr>
        </tfoot>` : "";

      const summaryRows = [
        ["תלמידים", dt.students || ""],
        ["מורים ומלווים", dt.escorts || ""],
        ['סה"כ נוכחים', dt.total || ""],
      ].map(([label, val], i) => `<tr style="${i === 2 ? "font-weight:bold;background:#d4edda" : ""}">
        <td style="padding:3px 8px;border:1px solid #ccc;font-size:10.5px">${label}</td>
        <td style="padding:3px 8px;border:1px solid #ccc;font-size:10.5px;text-align:center;width:55px">${val}</td>
      </tr>`).join("");

      const splitDetailsHTML = Object.entries(daySplitStudents).map(([cls, partsData]) => {
        if (!daySplits[cls] || daySplits[cls].length < 2) return "";
        if (!partsData || typeof partsData !== "object") return "";
        const partsEntries = Array.isArray(partsData)
          ? partsData.map((arr, i) => [i, Array.isArray(arr) ? (arr as string[]) : []] as const)
          : Object.entries(partsData).map(([k, v]) => [parseInt(k, 10), Array.isArray(v) ? (v as string[]) : []] as const);

        const partItems = partsEntries.map(([pi, studentIds]) => {
          if (!studentIds || studentIds.length === 0) return "";
          const names = studentIds
            .map((id: string) => {
              const s = goingStudents.find((st) => st.id === id);
              return s ? `${s.firstName} ${s.lastName}` : "";
            })
            .filter(Boolean);
          if (names.length === 0) return "";
          return `<div style="margin-bottom:2px;font-size:9.5px;line-height:1.35">
            <strong style="color:#1b4332">${esc(cls)} — ${PART_LABELS[pi] ?? `חלק ${pi + 1}`} (${names.length} תלמידים):</strong> ${esc(names.join(", "))}
          </div>`;
        }).filter(Boolean).join("");

        if (!partItems) return "";
        return `<div style="margin-bottom:3px">${partItems}</div>`;
      }).filter(Boolean).join("");

      const splitSection = splitDetailsHTML ? `
        <div style="flex:1;min-width:220px;padding:6px 8px;background:#f9fbf9;border:1px solid #c3e6cb;border-radius:4px">
          <div style="font-size:10px;font-weight:bold;color:#1b4332;margin-bottom:3px">פירוט שמות תלמידים בכיתות מפוצלות:</div>
          ${splitDetailsHTML}
        </div>` : "";

      return `
        <div class="print-page">
          <div class="header" style="padding-bottom:6px;margin-bottom:8px">
            <div class="title" style="font-size:16px;margin-top:0">נספח ו׳ — טבלת שליטה בטיול</div>
            ${t ? `<div class="ministry" style="font-size:10.5px">${esc(t.name ?? "")} | ${esc(t.schoolName ?? "")}</div>` : ""}
          </div>
          <div style="margin-bottom:10px">
            <div style="font-size:11.5px;font-weight:bold;padding:4px 8px;background:#1b4332;color:white;border-radius:4px 4px 0 0;margin-bottom:4px">
              ${esc(day.label)} — ${day.buses.length} אוטובוסים
            </div>
            ${dayTable(day)}
          </div>
          <div style="display:flex;gap:16px;margin-top:8px;align-items:flex-start;flex-wrap:wrap">
            <div>
              <div class="section-title" style="font-size:12px;margin:4px 0 4px">סיכום לפי כיתה</div>
              <table style="width:auto;margin-bottom:0">
                <thead><tr>
                  <th style="width:95px;padding:3px 6px;font-size:10.5px">כיתה</th>
                  <th style="width:55px;padding:3px 6px;font-size:10.5px;text-align:center">מתוכנן</th>
                  <th style="width:55px;padding:3px 6px;font-size:10.5px;text-align:center">בפועל</th>
                </tr></thead>
                <tbody>${classRows}</tbody>
                ${classFooterRow}
              </table>
            </div>
            <div>
              <div class="section-title" style="font-size:12px;margin:4px 0 4px">סיכום כללי</div>
              <table style="width:auto;margin-bottom:0">
                <thead><tr>
                  <th style="padding:3px 8px;font-size:10.5px">קטגוריה</th>
                  <th style="width:55px;padding:3px 6px;font-size:10.5px;text-align:center">מספר</th>
                </tr></thead>
                <tbody>${summaryRows}</tbody>
              </table>
            </div>
            ${splitSection}
          </div>
        </div>
      `;
    }

    const daysToRender = data.days.length > 0 ? data.days : [makeDay(1)];
    return daysToRender.map((day) => renderDayPage(day)).join("");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const allCollapsed = data.days.length > 0 && data.days.every((d) => collapsed.has(d.id));
  const activeDaySplits = getDaySplits(activeSplitDay);
  const activeDayActual = getDayActual(activeSplitDay);
  const otherDaysWithSplits = data.days.filter(
    (d) =>
      d.id !== activeSplitDay?.id &&
      Object.values(getDaySplits(d)).some((parts) => parts && parts.length >= 2)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ו׳ — טבלת שליטה בטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">הקצאת אוטובוסים, צוות ובקרת נוכחות</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => printHTML(getHTML(), "נספח ו׳ — טבלת שליטה בטיול", { fitPages: true })}
          >
            <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            הדפס
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={topPdfLoading}
            onClick={async () => {
              setTopPdfLoading(true);
              try {
                await sharePDF(getHTML(), "נספח ו׳ — טבלת שליטה בטיול", { fitPages: true });
              } finally {
                setTopPdfLoading(false);
              }
            }}
          >
            {topPdfLoading ? (
              <svg className="w-4 h-4 ml-1.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            )}
            {topPdfLoading ? "מכין PDF..." : "שתף PDF"}
          </Button>
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
          const allBusesCollapsedInDay = day.buses.length > 0 && day.buses.every((b) => collapsedBuses.has(b.id));
          const dt = dayTotals(day);
          const opts = classOptions(day);
          const daySplits = getDaySplits(day);
          const splitClassNamesOnDay = classNames.filter(
            (cls) => daySplits[cls] && daySplits[cls].length >= 2
          );

          return (
            <div key={day.id} className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
              {/* Day header */}
              <div className="px-3.5 sm:px-5 py-3 bg-[#1b4332] flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
                  {/* Collapse toggle */}
                  <button
                    onClick={() => toggleCollapse(day.id)}
                    className="text-white/70 hover:text-white transition-colors flex-shrink-0 p-1 -m-1"
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
                    className="bg-transparent text-white font-semibold text-sm focus:outline-none border-b border-transparent focus:border-white/50 transition-colors min-w-0 w-24 sm:w-28"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Day stats */}
                <div className="flex items-center gap-x-2.5 gap-y-1 sm:mr-2 flex-1 flex-wrap order-3 sm:order-none w-full sm:w-auto pt-1 sm:pt-0 border-t border-white/10 sm:border-0">
                  <span className="text-white/80 text-xs">{day.buses.length} אוטובוסים</span>
                  {dt.students > 0 && (
                    <>
                      <span className="text-white/40 text-xs">·</span>
                      <span className="text-white/80 text-xs">👥 {dt.students} תלמידים</span>
                      <span className="text-white/40 text-xs">·</span>
                      <span className="text-white/80 text-xs">🧑‍🏫 {dt.escorts} מלווים</span>
                    </>
                  )}
                  {splitClassNamesOnDay.length > 0 && (
                    <>
                      <span className="text-white/40 text-xs">·</span>
                      <span className="text-amber-200 text-xs">
                        ✂️ מפוצלות: {splitClassNamesOnDay.join(", ")}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {/* Collapse / Expand all buses in this day */}
                  {!isCollapsed && day.buses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleAllDayBuses(day)}
                      className="text-xs text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-[var(--radius-sm)] px-2 sm:px-2.5 py-1 transition-colors flex-shrink-0"
                      title={allBusesCollapsedInDay ? "הרחב את כל האוטובוסים ביום זה" : "כווץ את כל האוטובוסים ביום זה"}
                    >
                      {allBusesCollapsedInDay ? "הרחב אוטובוסים" : "כווץ אוטובוסים"}
                    </button>
                  )}

                  {/* Quick jump to split classes for this day */}
                  {classNames.length > 0 && (
                    <button
                      type="button"
                      onClick={() => focusDaySplits(day.id)}
                      className="text-xs text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-[var(--radius-sm)] px-2 sm:px-2.5 py-1 transition-colors flex-shrink-0"
                      title={`ניהול פיצול כיתות עבור ${day.label}`}
                    >
                      ✂️ פיצול כיתות ({splitClassNamesOnDay.length})
                    </button>
                  )}

                  {/* Delete day (only if >1 day) */}
                  {data.days.length > 1 && (
                    <button
                      onClick={() => deleteDay(day.id)}
                      className="text-white/50 hover:text-white/90 transition-colors flex-shrink-0 p-1"
                      title="מחק יום"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Day content */}
              {!isCollapsed && (
                <div className="p-3 sm:p-4 space-y-4 sm:space-y-5 bg-muted/15">
                  {day.buses.map((bus, bi) => {
                    const isBusCollapsed = collapsedBuses.has(bus.id);
                    const busClassLabels = bus.classSelections
                      .filter(Boolean)
                      .map((sel) => (isSplitSel(sel) ? splitLabel(...parseSplit(sel)) : sel))
                      .join(", ");
                    const leadTeacher = bus.crew[0]?.name?.trim() || "";

                    return (
                      <div key={bus.id} className="bg-white rounded-[var(--radius-sm)] border border-border shadow-xs overflow-hidden">
                        {/* Bus header */}
                        <div className={`px-3.5 sm:px-5 py-3 bg-[var(--brand-light)] ${isBusCollapsed ? "" : "border-b border-border"}`}>
                          <div className={`flex items-center justify-between gap-2 flex-wrap ${isBusCollapsed ? "" : "mb-2"}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleBusCollapse(bus.id)}
                                className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity text-right"
                                title={isBusCollapsed ? "הרחב אוטובוס" : "כווץ אוטובוס"}
                              >
                                <svg
                                  className={`w-4 h-4 transition-transform shrink-0 ${isBusCollapsed ? "-rotate-90" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                <span className="font-semibold text-sm">אוטובוס {bi + 1}</span>
                              </button>

                              {isBusCollapsed && busClassLabels && (
                                <span className="text-xs text-muted-foreground bg-white/80 border border-border/60 rounded-full px-2 py-0.5 truncate max-w-[180px] sm:max-w-xs">
                                  {busClassLabels}
                                </span>
                              )}
                              {isBusCollapsed && leadTeacher && (
                                <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[160px]">
                                  · {leadTeacher}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              <span className="text-xs font-medium text-foreground">👥 {busStudentCount(day, bus)} תלמידים</span>
                              <span className="text-xs font-medium text-foreground">🧑‍🏫 {calcEscorts(bus)} מלווים</span>
                              <span className="text-xs font-bold text-primary">סה״כ {busStudentCount(day, bus) + calcEscorts(bus)}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => printBusRoster(day, bus, bi)}
                                  className="text-xs px-2 sm:px-2.5 py-1 rounded-[var(--radius-sm)] border border-primary/30 bg-white text-primary hover:bg-primary/5 transition-colors flex items-center gap-1 font-medium"
                                  title="הדפס רשימה שמית לבדיקת נוכחות באוטובוס (תלמידים + צוות)"
                                >
                                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                  </svg>
                                  <span>רשימה שמית</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={busRosterPdfLoadingId === bus.id}
                                  onClick={() => shareBusRosterPDF(day, bus, bi)}
                                  className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-primary/30 bg-white text-primary hover:bg-primary/5 transition-colors flex items-center gap-1 disabled:opacity-50"
                                  title="שתף PDF של רשימה שמית לאוטובוס זה"
                                >
                                  {busRosterPdfLoadingId === bus.id ? (
                                    <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                  )}
                                  <span className="hidden sm:inline">{busRosterPdfLoadingId === bus.id ? "..." : "PDF"}</span>
                                </button>
                                <button onClick={() => deleteBus(day.id, bi)} className="text-muted-foreground hover:text-destructive transition-colors p-1" title="מחק אוטובוס">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {!isBusCollapsed && (
                            <>
                              {classNames.length === 0 ? (
                                <p className="text-xs text-muted-foreground">ייבא רשימת תלמידים בנספח ז׳ כדי לבחור כיתות</p>
                              ) : (
                                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:flex-wrap">
                                  {[0, 1, 2, 3].map((si) => (
                                    <select
                                      key={si}
                                      value={bus.classSelections[si] ?? ""}
                                      onChange={(e) => setBusClass(day.id, bi, si, e.target.value)}
                                      className="w-full sm:w-auto text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1.5 sm:py-1 bg-white text-foreground focus:outline-none focus:border-primary"
                                    >
                                      <option value="">— כיתה {si + 1} —</option>
                                      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                  ))}
                                </div>
                              )}

                              {/* Bus assigned students roster expander */}
                              {(() => {
                                const busStudentEntries = getBusAllStudents(day, bus);
                                if (busStudentEntries.length === 0) return null;
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
                                        ? "הסתר שמות תלמידים באוטובוס"
                                        : `הצג שמות תלמידים באוטובוס (${busStudentEntries.length})`}
                                    </button>
                                    {isRosterOpen && (
                                      <div className="mt-1.5 flex flex-wrap gap-1.5 p-2 bg-white/70 rounded-[var(--radius-sm)] border border-border/50 max-h-36 overflow-y-auto">
                                        {busStudentEntries.map(({ student: s, groupLabel }) => (
                                          <span
                                            key={s.id}
                                            className="text-xs bg-muted/80 text-foreground px-2 py-0.5 rounded-full border border-border/40"
                                          >
                                            {s.firstName} {s.lastName}
                                            <span className="text-muted-foreground text-[10px] mr-1">({groupLabel})</span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>

                        {/* Crew table & mobile list */}
                        {!isBusCollapsed && (
                          <div className="p-3 sm:p-4">
                        {/* Mobile stacked cards (< md) + horizontally scrollable table wrapper */}
                        <div className="md:hidden space-y-2.5 mb-3">
                          {CREW_ROLES.map((role, ri) => {
                            const currentName = bus.crew[ri]?.name ?? "";
                            const currentPhone = bus.crew[ri]?.phone ?? "";
                            const currentNote = bus.crew[ri]?.note ?? "";
                            const matchedStaffVal = staff.some((s) => s.name === currentName) ? currentName : "";

                            return (
                              <div key={role} className="rounded-[var(--radius-sm)] border border-border p-2.5 bg-muted/10 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-primary">{role}</span>
                                  {currentPhone.trim() && (
                                    <a
                                      href={`tel:${currentPhone.trim()}`}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
                                      dir="ltr"
                                    >
                                      <span>📞</span>
                                      <span>{currentPhone.trim()}</span>
                                    </a>
                                  )}
                                </div>

                                {staff.length > 0 && (
                                  <select
                                    value={matchedStaffVal}
                                    onChange={(e) => selectStaff(day.id, bi, ri, e.target.value)}
                                    className="w-full text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1.5 bg-white focus:outline-none focus:border-primary"
                                    title="בחר מרשימת צוות הטיול"
                                  >
                                    <option value="">— בחר מצוות הטיול —</option>
                                    {staff.map((s) => (
                                      <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ""}</option>
                                    ))}
                                  </select>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={currentName}
                                    onChange={(e) => setCrewField(day.id, bi, ri, "name", e.target.value)}
                                    placeholder={staff.length > 0 ? "או הקלד שם ידנית..." : "שם מלא..."}
                                    className="w-full text-xs border border-border rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-white focus:border-primary focus:outline-none placeholder:text-muted-foreground/50"
                                  />
                                  <input
                                    type="tel"
                                    value={currentPhone}
                                    onChange={(e) => setCrewField(day.id, bi, ri, "phone", e.target.value)}
                                    placeholder="050-0000000"
                                    dir="ltr"
                                    className="w-full text-xs border border-border rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-white focus:border-primary focus:outline-none placeholder:text-muted-foreground/50 text-left"
                                  />
                                </div>

                                <input
                                  type="text"
                                  value={currentNote}
                                  onChange={(e) => setCrewField(day.id, bi, ri, "note", e.target.value)}
                                  placeholder="הערה (עולה בדרך, יורד בדרך...)"
                                  className="w-full text-xs border border-border rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-muted/20 focus:bg-white focus:border-primary focus:outline-none placeholder:text-muted-foreground/60"
                                />
                              </div>
                            );
                          })}

                          {bus.extraTeachers.map((et, ti) => {
                            const matchedExtraVal = staff.some((s) => s.name === et.name) ? et.name : "";
                            const extraRoleOptions = Array.from(
                              new Set([
                                ...DEFAULT_EXTRA_ROLES,
                                ...staff.map((s) => s.role?.trim()).filter((r): r is string => Boolean(r)),
                                ...(et.role ? [et.role] : []),
                              ])
                            );

                            return (
                              <div key={ti} className="rounded-[var(--radius-sm)] border border-border p-2.5 bg-muted/20 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <select
                                    value={et.role}
                                    onChange={(e) => setExtraTeacher(day.id, bi, ti, "role", e.target.value)}
                                    className="flex-1 text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-white focus:outline-none focus:border-primary font-medium"
                                  >
                                    {extraRoleOptions.map((roleOpt) => (
                                      <option key={roleOpt} value={roleOpt}>{roleOpt}</option>
                                    ))}
                                  </select>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {et.phone?.trim() && (
                                      <a
                                        href={`tel:${et.phone.trim()}`}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
                                        dir="ltr"
                                      >
                                        <span>📞</span>
                                        <span>{et.phone.trim()}</span>
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => removeExtraTeacher(day.id, bi, ti)}
                                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                      title="הסר מלווה"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {staff.length > 0 && (
                                  <select
                                    value={matchedExtraVal}
                                    onChange={(e) => setExtraTeacher(day.id, bi, ti, "name", e.target.value, true)}
                                    className="w-full text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1.5 bg-white focus:outline-none focus:border-primary"
                                    title="בחר מרשימת צוות הטיול"
                                  >
                                    <option value="">— בחר מצוות הטיול —</option>
                                    {staff.map((s) => (
                                      <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ""}</option>
                                    ))}
                                  </select>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={et.name}
                                    onChange={(e) => setExtraTeacher(day.id, bi, ti, "name", e.target.value)}
                                    placeholder={staff.length > 0 ? "או הקלד שם ידנית..." : "שם מלא..."}
                                    className="w-full text-xs border border-border rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-white focus:border-primary focus:outline-none placeholder:text-muted-foreground/50"
                                  />
                                  <input
                                    type="tel"
                                    value={et.phone}
                                    onChange={(e) => setExtraTeacher(day.id, bi, ti, "phone", e.target.value)}
                                    placeholder="טלפון..."
                                    dir="ltr"
                                    className="w-full text-xs border border-border rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-white focus:border-primary focus:outline-none placeholder:text-muted-foreground/50 text-left"
                                  />
                                </div>

                                <input
                                  type="text"
                                  value={et.note ?? ""}
                                  onChange={(e) => setExtraTeacher(day.id, bi, ti, "note", e.target.value)}
                                  placeholder="הערה (עולה בדרך, יורד בדרך...)"
                                  className="w-full text-xs border border-border rounded-[var(--radius-sm)] px-2.5 py-1.5 bg-muted/20 focus:bg-white focus:border-primary focus:outline-none placeholder:text-muted-foreground/60"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop table (md+) with overflow-x-auto safety */}
                        <div className="hidden md:block overflow-x-auto mb-3">
                          <table className="w-full min-w-[640px] text-sm">
                            <thead className="bg-muted border-b border-border">
                              <tr>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-36">תפקיד</th>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground">שם</th>
                                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-36">טלפון</th>
                              </tr>
                            </thead>
                            <tbody>
                              {CREW_ROLES.map((role, ri) => {
                                const currentName = bus.crew[ri]?.name ?? "";
                                const matchedStaffVal = staff.some((s) => s.name === currentName) ? currentName : "";

                                return (
                                  <tr key={role} className="border-b border-border last:border-0 hover:bg-muted/20">
                                    <td className="px-3 py-2 text-sm text-muted-foreground">{role}</td>
                                    <td className="px-2 py-1.5">
                                      <div className="flex items-center gap-1.5">
                                        {staff.length > 0 && (
                                          <select
                                            value={matchedStaffVal}
                                            onChange={(e) => selectStaff(day.id, bi, ri, e.target.value)}
                                            className="w-40 shrink-0 text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-white focus:outline-none focus:border-primary"
                                            title="בחר מרשימת צוות הטיול"
                                          >
                                            <option value="">— בחר מצוות הטיול —</option>
                                            {staff.map((s) => (
                                              <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ""}</option>
                                            ))}
                                          </select>
                                        )}
                                        <input
                                          type="text"
                                          value={currentName}
                                          onChange={(e) => setCrewField(day.id, bi, ri, "name", e.target.value)}
                                          placeholder={staff.length > 0 ? "או הקלד שם ידנית..." : "שם מלא..."}
                                          className="w-full min-w-0 text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 px-1 transition-colors placeholder:text-muted-foreground/50"
                                        />
                                        <input
                                          type="text"
                                          value={bus.crew[ri]?.note ?? ""}
                                          onChange={(e) => setCrewField(day.id, bi, ri, "note", e.target.value)}
                                          placeholder="הערה (עולה בדרך, יורד בדרך...)"
                                          className="w-56 shrink-0 text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-muted/20 hover:bg-white focus:bg-white focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground/60"
                                        />
                                      </div>
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
                                );
                              })}

                              {bus.extraTeachers.map((et, ti) => {
                                const matchedExtraVal = staff.some((s) => s.name === et.name) ? et.name : "";
                                const extraRoleOptions = Array.from(
                                  new Set([
                                    ...DEFAULT_EXTRA_ROLES,
                                    ...staff.map((s) => s.role?.trim()).filter((r): r is string => Boolean(r)),
                                    ...(et.role ? [et.role] : []),
                                  ])
                                );

                                return (
                                  <tr key={ti} className="border-b border-border last:border-0 hover:bg-muted/20 bg-muted/5">
                                    <td className="px-2 py-1.5">
                                      <div className="flex items-center gap-1">
                                        <select
                                          value={et.role}
                                          onChange={(e) => setExtraTeacher(day.id, bi, ti, "role", e.target.value)}
                                          className="w-full text-xs border border-border rounded-[var(--radius-sm)] px-1.5 py-1 bg-white focus:outline-none focus:border-primary"
                                        >
                                          {extraRoleOptions.map((roleOpt) => (
                                            <option key={roleOpt} value={roleOpt}>{roleOpt}</option>
                                          ))}
                                        </select>
                                        <button onClick={() => removeExtraTeacher(day.id, bi, ti)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <div className="flex items-center gap-1.5">
                                        {staff.length > 0 && (
                                          <select
                                            value={matchedExtraVal}
                                            onChange={(e) => setExtraTeacher(day.id, bi, ti, "name", e.target.value, true)}
                                            className="w-40 shrink-0 text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-white focus:outline-none focus:border-primary"
                                            title="בחר מרשימת צוות הטיול"
                                          >
                                            <option value="">— בחר מצוות הטיול —</option>
                                            {staff.map((s) => (
                                              <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ""}</option>
                                            ))}
                                          </select>
                                        )}
                                        <input
                                          type="text"
                                          value={et.name}
                                          onChange={(e) => setExtraTeacher(day.id, bi, ti, "name", e.target.value)}
                                          placeholder={staff.length > 0 ? "או הקלד שם ידנית..." : "שם מלא..."}
                                          className="w-full min-w-0 text-sm border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 px-1 transition-colors placeholder:text-muted-foreground/50"
                                        />
                                        <input
                                          type="text"
                                          value={et.note ?? ""}
                                          onChange={(e) => setExtraTeacher(day.id, bi, ti, "note", e.target.value)}
                                          placeholder="הערה (עולה בדרך, יורד בדרך...)"
                                          className="w-56 shrink-0 text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-muted/20 hover:bg-white focus:bg-white focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground/60"
                                        />
                                      </div>
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
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap pt-2 border-t border-border/60">
                          <Button variant="ghost" size="sm" onClick={() => addExtraTeacher(day.id, bi)} className="text-primary text-xs" type="button">
                            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            הוסף מלווה נוסף
                          </Button>
                          <div className="flex items-center gap-x-2 sm:gap-x-3 gap-y-1 flex-wrap text-xs bg-[var(--brand-light)]/70 border border-primary/20 rounded-xl sm:rounded-full px-3 py-1.5 sm:py-1">
                            <span className="font-semibold text-primary">אוטובוס {bi + 1}:</span>
                            <span className="text-foreground">👥 {busStudentCount(day, bus)} תלמידים</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-foreground">🧑‍🏫 {calcEscorts(bus)} מלווים (ללא נהג)</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="font-bold text-primary">סה״כ {busStudentCount(day, bus) + calcEscorts(bus)} נוסעים</span>
                          </div>
                        </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add bus */}
                  <div>
                    <Button variant="outline" size="sm" onClick={() => addBus(day.id)} className="w-full bg-white" type="button">
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
      {classNames.length > 0 && activeSplitDay && (
        <div ref={classControlRef} className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-3.5 sm:p-5 scroll-mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                בקרת נוכחות ופיצול כיתות{data.days.length > 1 ? ` — ${activeSplitDay.label}` : ""}
              </h2>
              {data.days.length > 1 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  בחר יום כדי להגדיר אילו כיתות מפוצלות באותו יום (השיבוץ באוטובוסים מתעדכן בהתאם ליום)
                </p>
              )}
            </div>

            {data.days.length > 1 && otherDaysWithSplits.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">העתק פיצולים מ:</span>
                {otherDaysWithSplits.map((srcDay) => (
                  <button
                    key={srcDay.id}
                    type="button"
                    onClick={() => copySplitsFromDay(srcDay.id, activeSplitDay.id)}
                    className="text-xs px-2.5 py-1 rounded-[var(--radius-sm)] border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
                    title={`העתק את פיצולי הכיתות ושיוך השמות מ${srcDay.label} ל${activeSplitDay.label}`}
                  >
                    📋 {srcDay.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Day Selector Tabs when trip has multiple days */}
          {data.days.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-4 pb-3 border-b border-border">
              {data.days.map((d) => {
                const isActive = d.id === activeSplitDay.id;
                const dSplits = getDaySplits(d);
                const splitCountOnDay = classNames.filter(
                  (cls) => dSplits[cls] && dSplits[cls].length >= 2
                ).length;

                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveSplitDayId(d.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#1b4332] text-white font-semibold border-[#1b4332] shadow-xs"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{d.label}</span>
                    {splitCountOnDay > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {splitCountOnDay} מפוצלות
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Mobile cards view (< md) */}
          <div className="md:hidden space-y-2.5">
            {classNames.map((cls) => {
              const parts = activeDaySplits[cls];
              const isSplit = parts && parts.length >= 2;
              const splitSum = isSplit ? parts.reduce((s, v) => s + (parseInt(v) || 0), 0) : 0;
              const isOver = isSplit && splitSum > plannedByClass[cls];

              return (
                <div
                  key={cls}
                  className={`rounded-[var(--radius-sm)] border p-3 space-y-2.5 ${
                    isSplit ? "bg-amber-50/40 border-amber-200/80" : "bg-muted/10 border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">כיתה {cls}</span>
                      <span className="text-xs text-muted-foreground bg-white border border-border rounded-full px-2 py-0.5">
                        מתוכנן: <strong>{plannedByClass[cls]}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isSplit ? (
                        <button
                          type="button"
                          onClick={() => splitClass(cls, activeSplitDay.id)}
                          className="text-xs text-muted-foreground hover:text-primary border border-border bg-white rounded-[var(--radius-sm)] px-2.5 py-1 transition-colors"
                        >
                          ↕ פצל כיתה
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setSplitModalTarget({ dayId: activeSplitDay.id, cls })}
                            className="text-xs text-primary hover:text-primary/80 border border-primary/30 rounded-[var(--radius-sm)] px-2.5 py-1 transition-colors bg-white font-medium"
                          >
                            שיוך שמות
                          </button>
                          <button
                            type="button"
                            onClick={() => unsplitClass(cls, activeSplitDay.id)}
                            className="text-xs text-destructive/80 hover:text-destructive border border-destructive/30 bg-white rounded-[var(--radius-sm)] px-2 py-1 transition-colors"
                          >
                            ✕ בטל
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {!isSplit ? (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">נוכחים בפועל:</span>
                      <input
                        type="number"
                        min="0"
                        value={activeDayActual[cls] ?? ""}
                        onChange={(e) => setActual(cls, e.target.value, activeSplitDay.id)}
                        placeholder="הזן כמות..."
                        className="w-28 text-xs text-center border border-border rounded-[var(--radius-sm)] px-2.5 py-1 bg-white focus:border-primary focus:outline-none transition-colors"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1 border-t border-amber-200/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">סה״כ בחלקים:</span>
                        <span className={`font-semibold ${isOver ? "text-destructive" : "text-foreground"}`}>
                          {splitSum ? `${splitSum} תלמידים${isOver ? " ⚠ חורג" : ""}` : "—"}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {parts.map((count, pi) => {
                          const assignedStudents = getPartAssignedStudents(activeSplitDay, cls, pi);
                          const hasAssigned = assignedStudents.length > 0;
                          const previewNames = assignedStudents.slice(0, 3).map((s) => `${s.firstName} ${s.lastName}`).join(", ");
                          const extraCount = assignedStudents.length - 3;
                          const partCopyKey = `${activeSplitDay.id}|${cls}|${pi}`;

                          return (
                            <div key={`${cls}-${pi}`} className="rounded-[var(--radius-sm)] border border-amber-200/70 bg-white/80 p-2 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  {PART_LABELS[pi]}
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  value={count}
                                  onChange={(e) => setSplitCount(cls, pi, e.target.value, activeSplitDay.id)}
                                  placeholder="כמות"
                                  className="w-20 text-xs text-center border border-border rounded-[var(--radius-sm)] px-2 py-1 bg-white focus:border-primary focus:outline-none"
                                />
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setSplitModalTarget({ dayId: activeSplitDay.id, cls })}
                                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                                    hasAssigned
                                      ? "bg-primary/10 border-primary/30 text-primary font-medium"
                                      : "bg-white border-border text-muted-foreground"
                                  }`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                  </svg>
                                  {hasAssigned ? `${assignedStudents.length} שובצו` : "+ שיוך שמות"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setExportTarget({ dayId: activeSplitDay.id, cls, partIdx: pi })}
                                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                                    hasAssigned
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-medium"
                                      : "bg-white border-border text-muted-foreground"
                                  }`}
                                >
                                  <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                  </svg>
                                  ייצוא רשימה
                                </button>

                                {hasAssigned && (
                                  <button
                                    type="button"
                                    onClick={() => copySplitText(buildPartWhatsAppText(activeSplitDay, cls, pi, exportIncludePhones), partCopyKey)}
                                    className="text-xs px-2 py-1 rounded-full border border-border bg-white text-muted-foreground"
                                  >
                                    {copiedPartKey === partCopyKey ? "הועתק ✓" : "העתק"}
                                  </button>
                                )}
                              </div>

                              {hasAssigned && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {previewNames}{extraCount > 0 ? ` ועוד ${extraCount}...` : ""}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        {parts.length < 4 && (
                          <button
                            type="button"
                            onClick={() => addSplitPart(cls, activeSplitDay.id)}
                            className="text-xs text-primary/80 hover:text-primary font-medium"
                          >
                            + הוסף {PART_LABELS[parts.length]}
                          </button>
                        )}
                        {parts.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeSplitPart(cls, activeSplitDay.id)}
                            className="text-xs text-destructive/80 hover:text-destructive font-medium"
                          >
                            - הסר {PART_LABELS[parts.length - 1]}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="rounded-[var(--radius-sm)] bg-[var(--brand-light)] border border-primary/20 p-3 flex items-center justify-between text-xs">
              <span className="font-semibold text-primary">סה״כ תלמידים</span>
              <div className="flex items-center gap-3">
                <span className="text-foreground">מתוכנן: <strong className="text-primary">{goingStudents.length}</strong></span>
                <span className="text-muted-foreground">·</span>
                <span className="text-foreground">
                  בפועל:{" "}
                  <strong className="text-primary">
                    {Object.values(activeDayActual).reduce((s, v) => s + (parseInt(v) || 0), 0) || "—"}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Desktop table (md+) with overflow-x-auto */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
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
                const parts = activeDaySplits[cls];
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
                            value={activeDayActual[cls] ?? ""}
                            onChange={(e) => setActual(cls, e.target.value, activeSplitDay.id)}
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
                            onClick={() => splitClass(cls, activeSplitDay.id)}
                            className="text-xs text-muted-foreground hover:text-primary border border-border rounded px-2 py-0.5 transition-colors"
                          >
                            ↕ פצל
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSplitModalTarget({ dayId: activeSplitDay.id, cls })}
                              className="text-xs text-primary hover:text-primary/80 border border-primary/30 rounded px-2 py-0.5 transition-colors bg-white font-medium"
                              title="ערוך חלוקת תלמידים"
                            >
                              שיוך שמות
                            </button>
                            <button
                              type="button"
                              onClick={() => unsplitClass(cls, activeSplitDay.id)}
                              className="text-xs text-destructive/70 hover:text-destructive border border-destructive/30 rounded px-2 py-0.5 transition-colors"
                              title="בטל פיצול כיתה ביום זה"
                            >
                              ✕ בטל
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {isSplit && parts.map((count, pi) => {
                      const assignedStudents = getPartAssignedStudents(activeSplitDay, cls, pi);
                      const hasAssigned = assignedStudents.length > 0;
                      const previewNames = assignedStudents.slice(0, 3).map((s) => `${s.firstName} ${s.lastName}`).join(", ");
                      const extraCount = assignedStudents.length - 3;
                      const fullNamesTitle = assignedStudents.map((s) => `${s.firstName} ${s.lastName}`).join(", ");
                      const partCopyKey = `${activeSplitDay.id}|${cls}|${pi}`;

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
                              onChange={(e) => setSplitCount(cls, pi, e.target.value, activeSplitDay.id)}
                              placeholder="כמות"
                              className="w-20 text-sm text-center border-b border-transparent hover:border-border focus:border-primary focus:outline-none bg-transparent py-0.5 transition-colors"
                            />
                          </td>
                          <td colSpan={2} className="px-3 py-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSplitModalTarget({ dayId: activeSplitDay.id, cls })}
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

                              {/* Export / WhatsApp button next to each split part */}
                              <button
                                type="button"
                                onClick={() => setExportTarget({ dayId: activeSplitDay.id, cls, partIdx: pi })}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                                  hasAssigned
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-medium hover:bg-emerald-100"
                                    : "bg-white border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                                title={hasAssigned ? `ייצוא ושליחת רשימת ${PART_LABELS[pi]} בוואטסאפ` : "ייצוא רשימת שמות לוואטסאפ"}
                              >
                                <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                ייצוא רשימה
                              </button>

                              {hasAssigned && (
                                <button
                                  type="button"
                                  onClick={() => copySplitText(buildPartWhatsAppText(activeSplitDay, cls, pi, exportIncludePhones), partCopyKey)}
                                  className="text-xs px-2 py-1 rounded-full border border-border bg-white text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                  title="העתק רשימת שמות ללוח"
                                >
                                  {copiedPartKey === partCopyKey ? "הועתק ✓" : "העתק"}
                                </button>
                              )}

                              {hasAssigned && (
                                <span
                                  className="text-xs text-muted-foreground truncate max-w-[220px] cursor-help"
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
                                onClick={() => addSplitPart(cls, activeSplitDay.id)}
                                className="text-xs text-primary/70 hover:text-primary transition-colors"
                              >
                                + הוסף {PART_LABELS[parts.length]}
                              </button>
                            )}
                            {parts.length > 2 && (
                              <button
                                onClick={() => removeSplitPart(cls, activeSplitDay.id)}
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
                  {Object.values(activeDayActual).reduce((s, v) => s + (parseInt(v) || 0), 0) || ""}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      )}

      {/* Unassigned staff card */}
      {staff.length > 0 && activeSplitDay && (() => {
        const unassignedStaff = getUnassignedStaffForDay(activeSplitDay);

        return (
          <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-3.5 sm:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  אנשי צוות לא משובצים לאוטובוסים{data.days.length > 1 ? ` — ${activeSplitDay.label}` : ""}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  אנשי צוות מרשימת הצוות של הטיול שטרם שובצו לאף אוטובוס{data.days.length > 1 ? ` ב${activeSplitDay.label}` : ""}
                </p>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                  unassignedStaff.length === 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {unassignedStaff.length === 0
                  ? `כולם משובצים (${staff.length}) ✓`
                  : `${unassignedStaff.length} מתוך ${staff.length} לא שובצו`}
              </span>
            </div>

            {data.days.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-4 pb-3 border-b border-border">
                {data.days.map((d) => {
                  const isActive = d.id === activeSplitDay.id;
                  const dUnassignedCount = getUnassignedStaffForDay(d).length;

                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setActiveSplitDayId(d.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                        isActive
                          ? "bg-[#1b4332] text-white font-semibold border-[#1b4332] shadow-xs"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span>{d.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isActive
                            ? "bg-white/20 text-white"
                            : dUnassignedCount > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {dUnassignedCount > 0 ? `${dUnassignedCount} לא שובצו` : "✓"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {unassignedStaff.length === 0 ? (
              <div className="rounded-[var(--radius-sm)] bg-emerald-50/60 border border-emerald-200/70 px-4 py-3 text-xs text-emerald-800 flex items-center gap-2">
                <span>✓</span>
                <span>כל אנשי הצוות ({staff.length}) משובצים לאוטובוסים{data.days.length > 1 ? ` ב${activeSplitDay.label}` : ""}.</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {unassignedStaff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] border border-amber-200/80 bg-amber-50/40 text-xs flex-wrap"
                  >
                    <span className="font-medium text-foreground">{member.name}</span>
                    {member.role && (
                      <span className="text-[11px] text-muted-foreground bg-white px-1.5 py-0.5 rounded border border-border/60">
                        {member.role}
                      </span>
                    )}
                    {member.phone && (
                      <a
                        href={`tel:${member.phone.trim()}`}
                        className="text-[11px] text-emerald-700 hover:underline font-medium"
                        dir="ltr"
                      >
                        📞 {member.phone}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {splitModalTarget && (() => {
        const modalDay = data.days.find((d) => d.id === splitModalTarget.dayId) ?? activeSplitDay;
        const modalDaySplits = getDaySplits(modalDay);
        const modalDaySplitStudents = getDaySplitStudents(modalDay);
        const partsCount = modalDaySplits[splitModalTarget.cls]?.length || 2;

        return (
          <SplitStudentsDialog
            open={!!splitModalTarget}
            onOpenChange={(open) => { if (!open) setSplitModalTarget(null); }}
            className={splitModalTarget.cls}
            dayLabel={data.days.length > 1 ? modalDay?.label : undefined}
            students={goingStudents.filter((s) => s.class === splitModalTarget.cls)}
            partsCount={partsCount}
            initialPartStudents={Array.from(
              { length: partsCount },
              (_, pi) =>
                modalDaySplitStudents[splitModalTarget.cls]?.[pi] ??
                modalDaySplitStudents[splitModalTarget.cls]?.[String(pi)] ??
                []
            )}
            onSave={(newPartStudents) =>
              handleSaveSplitStudents(splitModalTarget.dayId, splitModalTarget.cls, newPartStudents)
            }
          />
        );
      })()}

      {/* Export / WhatsApp Split Roster Dialog */}
      {exportTarget && (() => {
        const { dayId, cls, partIdx } = exportTarget;
        const targetDay = data.days.find((d) => d.id === dayId) ?? activeSplitDay;
        const parts = getDaySplits(targetDay)[cls] ?? [];
        const currentStudents =
          partIdx === "all"
            ? parts.flatMap((_, pi) => getPartAssignedStudents(targetDay, cls, pi))
            : getPartAssignedStudents(targetDay, cls, partIdx);
        const formattedText =
          partIdx === "all"
            ? buildAllPartsWhatsAppText(targetDay, cls, exportIncludePhones)
            : buildPartWhatsAppText(targetDay, cls, partIdx, exportIncludePhones);
        const modalCopyKey = `modal-${dayId}-${cls}-${partIdx}`;

        return (
          <Dialog open={!!exportTarget} onOpenChange={(open) => { if (!open) setExportTarget(null); }}>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-foreground">
                  ייצוא רשימת תלמידים — כיתה {cls} {partIdx !== "all" ? `(${PART_LABELS[partIdx]})` : "(כל החלקים)"}
                  {data.days.length > 1 && targetDay ? ` — ${targetDay.label}` : ""}
                </DialogTitle>
              </DialogHeader>

              {/* Part selector pills */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {parts.map((_, pi) => {
                    const count = getPartAssignedStudents(targetDay, cls, pi).length;
                    const active = partIdx === pi;
                    return (
                      <button
                        key={pi}
                        type="button"
                        onClick={() => setExportTarget({ dayId, cls, partIdx: pi })}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary font-medium"
                            : "bg-white border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {PART_LABELS[pi]} ({count})
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setExportTarget({ dayId, cls, partIdx: "all" })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      partIdx === "all"
                        ? "bg-primary text-primary-foreground border-primary font-medium"
                        : "bg-white border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    כל החלקים
                  </button>
                </div>

                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportIncludePhones}
                    onChange={(e) => setExportIncludePhones(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  כלול מספרי טלפון
                </label>
              </div>

              {currentStudents.length === 0 ? (
                <div className="rounded-[var(--radius-sm)] border border-border bg-muted/30 p-6 text-center space-y-3 my-2">
                  <p className="text-sm text-muted-foreground">
                    טרם שובצו שמות תלמידים ל{partIdx === "all" ? `כיתה ${cls}` : `${PART_LABELS[partIdx]} בכיתה ${cls}`}.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setExportTarget(null);
                      setSplitModalTarget({ dayId, cls });
                    }}
                  >
                    שבץ שמות תלמידים כעת
                  </Button>
                </div>
              ) : (
                <div className="my-2">
                  <textarea
                    readOnly
                    value={formattedText}
                    rows={10}
                    className="w-full text-xs leading-relaxed border border-border rounded-[var(--radius-sm)] p-3 bg-muted/30 text-foreground focus:outline-none resize-none font-sans"
                  />
                </div>
              )}

              <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => setExportTarget(null)}>
                  סגור
                </Button>
                {currentStudents.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copySplitText(formattedText, modalCopyKey)}
                    >
                      {copiedPartKey === modalCopyKey ? "הועתק ללוח ✓" : "העתק רשימה"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openWhatsAppWithText(formattedText)}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <svg className="w-4 h-4 ml-1.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      שלח בוואטסאפ
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      <AppendixActions title="נספח ו׳ — טבלת שליטה בטיול" getHTML={getHTML} fitPages />
    </div>
  );
}

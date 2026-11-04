import type { ItineraryRow, TripSchedule, DaletData } from "./types";
export type { ItineraryRow, TripSchedule, DaletData } from "./types";

export const DEFAULT_SCHEDULE_ID = "main";
export const DEFAULT_SCHEDULE_NAME = "לוח זמנים ראשי";

export const createEmptyItineraryRow = (): ItineraryRow => ({
  id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
  day: "",
  time: "",
  activity: "",
  notes: "",
});

export function createSchedule(
  name: string = DEFAULT_SCHEDULE_NAME,
  rows: ItineraryRow[] = [createEmptyItineraryRow()],
  description?: string,
  customId?: string
): TripSchedule {
  const sched: TripSchedule = {
    id: customId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
    name: name.trim() || DEFAULT_SCHEDULE_NAME,
    rows: rows.length > 0 ? rows : [createEmptyItineraryRow()],
    createdAt: new Date().toISOString(),
  };
  if (description?.trim()) {
    sched.description = description.trim();
  }
  return sched;
}

/**
 * Safely parses Appendix Dalet data from Firestore, ensuring full backward
 * compatibility with legacy flat `{ rows: ItineraryRow[] }` documents.
 */
export function parseDaletData(raw: Record<string, unknown> | null | undefined): DaletData {
  if (!raw) {
    const defaultSchedule = createSchedule(DEFAULT_SCHEDULE_NAME, [createEmptyItineraryRow()], undefined, DEFAULT_SCHEDULE_ID);
    return {
      activeScheduleId: defaultSchedule.id,
      schedules: [defaultSchedule],
      rows: defaultSchedule.rows,
    };
  }

  // Check if modern format with schedules array exists
  if (Array.isArray(raw.schedules) && raw.schedules.length > 0) {
    const schedules: TripSchedule[] = raw.schedules.map((s: unknown) => {
      const item = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      const id = String(item.id || (typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).substring(2)));
      const name = String(item.name || DEFAULT_SCHEDULE_NAME);
      const rawRows = Array.isArray(item.rows) ? (item.rows as ItineraryRow[]) : [];
      const rows = rawRows.length > 0
        ? rawRows.map((r) => ({
            id: String(r?.id || (typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).substring(2))),
            day: String(r?.day || ""),
            time: String(r?.time || ""),
            activity: String(r?.activity || ""),
            notes: String(r?.notes || ""),
          }))
        : [createEmptyItineraryRow()];

      const sched: TripSchedule = {
        id,
        name,
        rows,
        createdAt: item.createdAt ? String(item.createdAt) : new Date().toISOString(),
      };
      if (typeof item.description === "string" && item.description.trim()) {
        sched.description = item.description.trim();
      }
      return sched;
    });

    let activeScheduleId = String(raw.activeScheduleId || "");
    let activeSchedule = schedules.find((s) => s.id === activeScheduleId);
    if (!activeSchedule) {
      activeSchedule = schedules[0];
      activeScheduleId = activeSchedule.id;
    }

    return {
      activeScheduleId,
      schedules,
      rows: activeSchedule.rows,
    };
  }

  // Legacy format: `{ rows: [...] }`
  const legacyRows = Array.isArray(raw.rows) && raw.rows.length > 0
    ? (raw.rows as ItineraryRow[]).map((r) => ({
        id: String(r?.id || (typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).substring(2))),
        day: String(r?.day || ""),
        time: String(r?.time || ""),
        activity: String(r?.activity || ""),
        notes: String(r?.notes || ""),
      }))
    : [createEmptyItineraryRow()];

  const defaultSchedule = createSchedule(DEFAULT_SCHEDULE_NAME, legacyRows, undefined, DEFAULT_SCHEDULE_ID);

  return {
    activeScheduleId: defaultSchedule.id,
    schedules: [defaultSchedule],
    rows: defaultSchedule.rows,
  };
}

/**
 * Returns the currently active schedule and its rows from Dalet data.
 */
export function getActiveSchedule(raw: Record<string, unknown> | null | undefined): {
  activeSchedule: TripSchedule;
  schedules: TripSchedule[];
  rows: ItineraryRow[];
} {
  const data = parseDaletData(raw);
  const activeSchedule = data.schedules.find((s) => s.id === data.activeScheduleId) || data.schedules[0];
  return {
    activeSchedule,
    schedules: data.schedules,
    rows: activeSchedule.rows,
  };
}

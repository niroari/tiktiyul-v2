export type VavCrewMember = {
  role?: string;
  name: string;
  phone: string;
};

export type VavExtraTeacher = {
  role?: string;
  name: string;
  phone: string;
};

export type VavBus = {
  id?: string;
  classSelections?: string[];
  crew?: VavCrewMember[];
  extraTeachers?: VavExtraTeacher[];
};

export const SHORT_PARTS = ["א׳", "ב׳", "ג׳", "ד׳"];

/**
 * Extracts the primary list of buses from Appendix Vav data,
 * handling both the modern multi-day structure (`days`) and the legacy flat structure (`buses`).
 */
export function extractVavBuses(raw: Record<string, unknown> | null | undefined): VavBus[] {
  if (!raw) return [];

  // Modern structure: { days: [ { id, label, buses: [...] } ] }
  if (Array.isArray(raw.days) && raw.days.length > 0) {
    const days = raw.days as { buses?: VavBus[] }[];
    // Find the first day with buses configured, or fallback to the first day's buses
    const dayWithBuses = days.find((d) => Array.isArray(d.buses) && d.buses.length > 0);
    if (dayWithBuses?.buses) return dayWithBuses.buses;
    if (Array.isArray(days[0]?.buses)) return days[0].buses;
  }

  // Legacy structure: { buses: [...] }
  if (Array.isArray(raw.buses)) {
    return raw.buses as VavBus[];
  }

  return [];
}

/**
 * Formats class selections into a human-readable string, e.g. "ט׳1 (א׳), ט׳2".
 */
export function formatVavClassSelections(classSelections?: string[]): string {
  if (!classSelections) return "";
  return classSelections
    .filter(Boolean)
    .map((sel) => {
      if (!sel.includes("|")) return sel;
      const idx = sel.lastIndexOf("|");
      const cls = sel.slice(0, idx);
      const part = parseInt(sel.slice(idx + 1), 10);
      const partLabel = !isNaN(part) && SHORT_PARTS[part] ? ` (${SHORT_PARTS[part]})` : "";
      return `${cls}${partLabel}`;
    })
    .join(", ");
}

/**
 * Extracts the driver info from a Vav bus entry.
 * In Appendix Vav, CREW_ROLES = ["מורה אחראי/ת", "מורה נוסף", "נהג", "מאבטח/חובש", "מדריך"]
 * Driver is at index 2.
 */
export function getVavDriver(bus: VavBus): { name: string; phone: string } | null {
  if (!bus.crew || !Array.isArray(bus.crew)) return null;
  // Check index 2
  const driver = bus.crew[2];
  if (driver && (driver.name || driver.phone)) {
    return { name: driver.name || "", phone: driver.phone || "" };
  }
  // Fallback: check if any crew item has role === "נהג"
  const namedDriver = bus.crew.find((c) => c.role === "נהג");
  if (namedDriver && (namedDriver.name || namedDriver.phone)) {
    return { name: namedDriver.name || "", phone: namedDriver.phone || "" };
  }
  return null;
}

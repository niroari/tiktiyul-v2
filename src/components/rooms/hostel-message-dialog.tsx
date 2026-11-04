"use client";

import { useEffect, useState, useMemo } from "react";
import type { Student, StaffMember, Trip } from "@/lib/types";

// ─── Staff Classification Helper ──────────────────────────────────────────────

export type ParticipantCounts = {
  femaleStudents: number;
  maleStudents: number;
  femaleTeachers: number;
  maleTeachers: number;
  femaleGuides: number;
  maleGuides: number;
  femaleGuards: number;
  maleGuards: number;
};

export function classifyStaff(staff: StaffMember[]) {
  let femaleTeachers = 0;
  let maleTeachers = 0;
  let femaleGuides = 0;
  let maleGuides = 0;
  let femaleGuards = 0;
  let maleGuards = 0;

  for (const m of staff) {
    const role = (m.role || "").trim().toLowerCase();
    const gender = m.gender;

    // Check Guide
    if (role.includes("מדריך") || role.includes("מדריכה")) {
      if (gender === "female" || role.includes("מדריכה")) {
        femaleGuides++;
      } else {
        maleGuides++;
      }
    }
    // Check Guard
    else if (
      role.includes("מאבטח") ||
      role.includes("מאבטחת") ||
      role.includes("שומר") ||
      role.includes("שומרת")
    ) {
      if (gender === "female" || role.includes("מאבטחת") || role.includes("שומרת")) {
        femaleGuards++;
      } else {
        maleGuards++;
      }
    }
    // Check Teacher / School Staff / Other escorts
    else {
      if (
        gender === "female" ||
        role.includes("מחנכת") ||
        role.includes("מורת") ||
        role.includes("מנהלת") ||
        role.includes("רכזת") ||
        role.includes("אחות") ||
        role.includes("חובשת") ||
        role.includes("פרמדיקית")
      ) {
        femaleTeachers++;
      } else {
        maleTeachers++;
      }
    }
  }

  return { femaleTeachers, maleTeachers, femaleGuides, maleGuides, femaleGuards, maleGuards };
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    const [y, m, d] = iso.split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
  } catch {
    // fallback
  }
  return iso;
}

// ─── Component Props ──────────────────────────────────────────────────────────

type HostelMessageDialogProps = {
  open: boolean;
  onClose: () => void;
  trip: Trip | null;
  students: Student[];
  staff: StaffMember[];
};

export function HostelMessageDialog({
  open,
  onClose,
  trip,
  students,
  staff,
}: HostelMessageDialogProps) {
  // Compute initial automatic counts
  const initialCounts = useMemo<ParticipantCounts>(() => {
    const going = students.filter((s) => s.isGoing);
    const femaleStudents = going.filter((s) => s.gender === "female").length;
    const maleStudents = going.filter((s) => s.gender === "male").length;
    const classifiedStaff = classifyStaff(staff);

    return {
      femaleStudents,
      maleStudents,
      ...classifiedStaff,
    };
  }, [students, staff]);

  // Editable state
  const [counts, setCounts] = useState<ParticipantCounts>(initialCounts);
  const [hostelName, setHostelName] = useState(trip?.accommodation || "");
  const [customNotes, setCustomNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"whatsapp" | "email">("whatsapp");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync initial values when dialog opens or trip/students/staff change
  useEffect(() => {
    if (open) {
      setCounts(initialCounts);
      setHostelName(trip?.accommodation || "");
    }
  }, [open, initialCounts, trip]);

  if (!open) return null;

  function updateCount(key: keyof ParticipantCounts, delta: number) {
    setCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, prev[key] + delta),
    }));
  }

  function setCountValue(key: keyof ParticipantCounts, val: string) {
    const parsed = parseInt(val, 10);
    setCounts((prev) => ({
      ...prev,
      [key]: isNaN(parsed) ? 0 : Math.max(0, parsed),
    }));
  }

  function resetToSystem() {
    setCounts(initialCounts);
    setHostelName(trip?.accommodation || "");
    setCustomNotes("");
  }

  const totalStudents = counts.femaleStudents + counts.maleStudents;
  const totalStaff =
    counts.femaleTeachers +
    counts.maleTeachers +
    counts.maleGuides +
    counts.femaleGuides +
    counts.maleGuards +
    counts.femaleGuards;
  const grandTotal = totalStudents + totalStaff;

  const schoolName = trip?.schoolName || "בית הספר";
  const tripName = trip?.name || "טיול שנתי";
  const startFormatted = formatDate(trip?.startDate);
  const endFormatted = formatDate(trip?.endDate);
  const datesText =
    startFormatted && endFormatted
      ? startFormatted === endFormatted
        ? startFormatted
        : `${startFormatted} – ${endFormatted}`
      : startFormatted || "";

  // ── Formatted Message Generators ─────────────────────────────────────────────

  // 1. WhatsApp Text
  const whatsappText = `*הקצאת חדרים — ${schoolName} | ${tripName}*${
    datesText ? `\n📅 תאריכים: ${datesText}` : ""
  }${hostelName ? `\n🏨 אכסנייה: ${hostelName}` : ""}

שלום, להלן פירוט הרכב המשתתפים לקראת קבלת הקצאת וחלוקת חדרים:

👥 *תלמידים (סה״כ ${totalStudents}):*
• תלמידות: ${counts.femaleStudents}
• תלמידים: ${counts.maleStudents}

🧑‍🏫 *צוות ומלווים (סה״כ ${totalStaff}):*
• מורות: ${counts.femaleTeachers}
• מורים: ${counts.maleTeachers}
• מדריכים: ${counts.maleGuides}
• מדריכות: ${counts.femaleGuides}
• מאבטחים: ${counts.maleGuards}
• מאבטחות: ${counts.femaleGuards}

📌 *סה״כ משתתפים בטיול: ${grandTotal}*${
    customNotes.trim() ? `\n\n📝 *הערות ודגשים:*\n${customNotes.trim()}` : ""
  }

נודה לקבלת הקצאת החדרים ופירוט הקיבולת בהקדם לצורך שיבוץ. תודה רבה!`;

  // 2. Email Subject & Body
  const emailSubject = `בקשה להקצאת חדרים — ${schoolName} | ${tripName}${
    datesText ? ` (${datesText})` : ""
  }`;

  const emailBody = `שלום רב${hostelName ? ` לצוות ${hostelName}` : ""},

בהמשך להזמנתנו עבור ${tripName} של ${schoolName}${
    datesText ? ` בתאריכים ${datesText}` : ""
  }, להלן פירוט מדויק של הרכב המשתתפים לצורך קבלת הקצאת חדרים:

תלמידים (סה״כ ${totalStudents}):
• תלמידות: ${counts.femaleStudents}
• תלמידים: ${counts.maleStudents}

צוות ומלווים (סה״כ ${totalStaff}):
• מורות: ${counts.femaleTeachers}
• מורים: ${counts.maleTeachers}
• מדריכים: ${counts.maleGuides}
• מדריכות: ${counts.femaleGuides}
• מאבטחים: ${counts.maleGuards}
• מאבטחות: ${counts.femaleGuards}

סה״כ כלל המשתתפים בטיול: ${grandTotal}
${customNotes.trim() ? `\nהערות ודגשים מיוחדים:\n${customNotes.trim()}\n` : ""}
נודה לקבלת הקצאת החדרים (מספרי חדרים וקיבולת לכל חדר) בהקדם על מנת שנוכל לבצע שיבוץ סופי.

בברכה ובתודה,
צוות הטיול — ${schoolName}`;

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  }

  function openWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, "_blank");
  }

  function openEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;
  }

  const countCategories: {
    key: keyof ParticipantCounts;
    label: string;
    group: "students" | "staff";
    icon: string;
    chipClass: string;
  }[] = [
    {
      key: "femaleStudents",
      label: "תלמידות",
      group: "students",
      icon: "👧",
      chipClass: "border-pink-200 bg-pink-50 text-pink-900",
    },
    {
      key: "maleStudents",
      label: "תלמידים",
      group: "students",
      icon: "👦",
      chipClass: "border-blue-200 bg-blue-50 text-blue-900",
    },
    {
      key: "femaleTeachers",
      label: "מורות",
      group: "staff",
      icon: "👩‍🏫",
      chipClass: "border-purple-200 bg-purple-50 text-purple-900",
    },
    {
      key: "maleTeachers",
      label: "מורים",
      group: "staff",
      icon: "👨‍🏫",
      chipClass: "border-indigo-200 bg-indigo-50 text-indigo-900",
    },
    {
      key: "maleGuides",
      label: "מדריכים",
      group: "staff",
      icon: "🧭",
      chipClass: "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      key: "femaleGuides",
      label: "מדריכות",
      group: "staff",
      icon: "🧭",
      chipClass: "border-orange-200 bg-orange-50 text-orange-900",
    },
    {
      key: "maleGuards",
      label: "מאבטחים",
      group: "staff",
      icon: "🛡️",
      chipClass: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    {
      key: "femaleGuards",
      label: "מאבטחות",
      group: "staff",
      icon: "🛡️",
      chipClass: "border-teal-200 bg-teal-50 text-teal-900",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div
        className="relative bg-white rounded-[var(--radius)] border border-border shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base">
              🏨
            </div>
            <div>
              <h2 className="font-semibold text-base text-foreground">הודעה לאכסנייה — הקצאת חדרים</h2>
              <p className="text-xs text-muted-foreground">
                ניסוח הודעה מדויקת עם חלוקת בנים/בנות וצוות לשליחה במייל או בוואטסאפ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 text-lg leading-none transition-colors rounded-md"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Trip Details & Hostel Info Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-3 rounded-[var(--radius-sm)] border border-border text-xs">
            <div>
              <label className="text-muted-foreground block mb-1 font-medium">שם האכסנייה / מקום הלינה:</label>
              <input
                type="text"
                value={hostelName}
                onChange={(e) => setHostelName(e.target.value)}
                placeholder="לדוגמה: אנ״א אגרון ירושלים"
                className="w-full text-xs border border-border bg-white rounded-[var(--radius-sm)] px-2.5 py-1.5 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-muted-foreground block mb-1 font-medium">תאריכים ובית ספר:</label>
              <div className="text-foreground py-1.5 px-2 bg-white/70 border border-border rounded-[var(--radius-sm)] truncate">
                {schoolName} · {datesText || "לא הוגדרו תאריכים"}
              </div>
            </div>
          </div>

          {/* Participant Breakdown Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <span>פירוט משתתפים להקצאת חדרים</span>
                <span className="text-xs font-normal text-muted-foreground">
                  (סה״כ: <strong className="text-foreground font-semibold">{grandTotal}</strong>)
                </span>
              </h3>
              <button
                type="button"
                onClick={resetToSystem}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
                title="אפס לספירה המקורית מהתלמידים והצוות השמורים בטיול"
              >
                ↺ אפס לנתוני הטיול
              </button>
            </div>

            {/* Students counts */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">תלמידים (סה״כ {totalStudents}):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {countCategories
                  .filter((c) => c.group === "students")
                  .map((cat) => (
                    <div
                      key={cat.key}
                      className={`flex items-center justify-between p-2 rounded-[var(--radius-sm)] border ${cat.chipClass}`}
                    >
                      <span className="text-xs font-medium flex items-center gap-1.5">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                      <div className="flex items-center gap-1 bg-white/90 border border-border rounded-[var(--radius-sm)] px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => updateCount(cat.key, -1)}
                          disabled={counts[cat.key] <= 0}
                          className="w-5 h-5 flex items-center justify-center rounded text-xs hover:bg-muted text-muted-foreground disabled:opacity-30 leading-none"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={counts[cat.key]}
                          onChange={(e) => setCountValue(cat.key, e.target.value)}
                          className="w-10 text-center text-xs font-semibold bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateCount(cat.key, 1)}
                          className="w-5 h-5 flex items-center justify-center rounded text-xs hover:bg-muted text-muted-foreground leading-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Staff counts */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-medium text-muted-foreground">צוות ומלווים (סה״כ {totalStaff}):</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {countCategories
                  .filter((c) => c.group === "staff")
                  .map((cat) => (
                    <div
                      key={cat.key}
                      className={`flex items-center justify-between p-2 rounded-[var(--radius-sm)] border ${cat.chipClass}`}
                    >
                      <span className="text-xs font-medium flex items-center gap-1">
                        <span>{cat.icon}</span>
                        <span className="truncate">{cat.label}</span>
                      </span>
                      <div className="flex items-center gap-0.5 bg-white/90 border border-border rounded-[var(--radius-sm)] px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => updateCount(cat.key, -1)}
                          disabled={counts[cat.key] <= 0}
                          className="w-4 h-4 flex items-center justify-center rounded text-[11px] hover:bg-muted text-muted-foreground disabled:opacity-30 leading-none"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={counts[cat.key]}
                          onChange={(e) => setCountValue(cat.key, e.target.value)}
                          className="w-7 text-center text-xs font-semibold bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateCount(cat.key, 1)}
                          className="w-4 h-4 flex items-center justify-center rounded text-[11px] hover:bg-muted text-muted-foreground leading-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Custom Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              הערות ודגשים מיוחדים (אופציונלי):
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="למשל: דרוש חדר נגיש לתלמיד, מורות בחדרים נפרדים, הפרדה לקומות בנים/בנות..."
              className="w-full text-xs border border-border rounded-[var(--radius-sm)] px-3 py-1.5 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Message Output Format Preview */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              {/* Tab Selector */}
              <div className="flex rounded-[var(--radius-sm)] border border-border p-0.5 bg-muted text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("whatsapp")}
                  className={`px-3 py-1 rounded-[var(--radius-sm)] font-medium transition-colors ${
                    activeTab === "whatsapp"
                      ? "bg-white text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  💬 נוסח לוואטסאפ
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("email")}
                  className={`px-3 py-1 rounded-[var(--radius-sm)] font-medium transition-colors ${
                    activeTab === "email"
                      ? "bg-white text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ✉️ נוסח למייל
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {activeTab === "whatsapp" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => copyText(whatsappText, "wa")}
                      className="text-xs px-2.5 py-1 border border-border bg-white rounded-[var(--radius-sm)] hover:bg-muted text-foreground transition-colors"
                    >
                      {copiedKey === "wa" ? "✓ הועתק!" : "העתק הודעה"}
                    </button>
                    <button
                      type="button"
                      onClick={openWhatsApp}
                      className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-[var(--radius-sm)] hover:bg-emerald-700 transition-colors flex items-center gap-1 font-medium"
                    >
                      פתח בוואטסאפ
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => copyText(emailBody, "emailBody")}
                      className="text-xs px-2.5 py-1 border border-border bg-white rounded-[var(--radius-sm)] hover:bg-muted text-foreground transition-colors"
                    >
                      {copiedKey === "emailBody" ? "✓ תוכן הועתק!" : "העתק תוכן מייל"}
                    </button>
                    <button
                      type="button"
                      onClick={openEmail}
                      className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors flex items-center gap-1 font-medium"
                    >
                      פתח במייל
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Preview Box */}
            {activeTab === "whatsapp" ? (
              <div className="bg-[#eef8f3] border border-emerald-200/70 rounded-[var(--radius-sm)] p-3 text-xs leading-relaxed font-sans whitespace-pre-wrap text-emerald-950 max-h-48 overflow-y-auto selection:bg-emerald-200">
                {whatsappText}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs bg-muted/50 border border-border rounded-[var(--radius-sm)] px-2.5 py-1.5">
                  <span className="font-semibold text-muted-foreground whitespace-nowrap">נושא:</span>
                  <span className="text-foreground truncate flex-1">{emailSubject}</span>
                  <button
                    type="button"
                    onClick={() => copyText(emailSubject, "subj")}
                    className="text-[11px] text-primary hover:underline whitespace-nowrap"
                  >
                    {copiedKey === "subj" ? "✓ הועתק" : "העתק נושא"}
                  </button>
                </div>
                <div className="bg-slate-50 border border-border rounded-[var(--radius-sm)] p-3 text-xs leading-relaxed font-sans whitespace-pre-wrap text-slate-800 max-h-48 overflow-y-auto">
                  {emailBody}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            {copiedKey ? "הטקסט הועתק ללוח בהצלחה!" : "הטקסט מוכן לשליחה מהירה"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-[var(--radius-sm)] transition-colors font-medium"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

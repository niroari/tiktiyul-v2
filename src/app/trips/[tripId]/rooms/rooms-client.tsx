"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { useStudents } from "@/hooks/use-students";
import { useTrip } from "@/hooks/use-trip";
import { AppendixActions } from "@/components/appendix-actions";

type Room = {
  id: string;
  number: string;      // optional room number, e.g. "101"
  gender: "male" | "female";
  studentIds: string[];
};

function makeRoom(gender: "male" | "female"): Room {
  return { id: crypto.randomUUID(), number: "", gender, studentIds: [] };
}

export function RoomsClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { students } = useStudents(tripId);
  const { trip }     = useTrip(tripId);

  const [rooms, setRooms]         = useState<Room[]>([]);
  const [status, setStatus]       = useState<"idle" | "saving" | "saved">("idle");
  const [preferredSize, setPreferredSize] = useState(5);
  const [classFilter, setClassFilter]     = useState("all");
  const [genderView, setGenderView]       = useState<"all" | "male" | "female">("all");
  // per-unassigned-student: which room they're being assigned to
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending = useRef(false);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "rooms", (raw) => {
      if (isPending.current) return;
      if (raw?.rooms) setRooms(raw.rooms as Room[]);
      if (raw?.preferredSize) setPreferredSize(raw.preferredSize as number);
    });
    return () => unsub();
  }, [tripId]);

  function scheduleAutoSave(updatedRooms: Room[], size = preferredSize) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "rooms", { rooms: updatedRooms, preferredSize: size });
      isPending.current = false;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function updateRooms(updated: Room[]) {
    setRooms(updated);
    scheduleAutoSave(updated);
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const going = students
    .filter((s) => s.isGoing)
    .sort((a, b) => {
      const c = a.class.localeCompare(b.class, "he");
      return c !== 0 ? c : a.lastName.localeCompare(b.lastName, "he");
    });

  const allClasses = [...new Set(going.map((s) => s.class).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "he")
  );

  const assignedIds = new Set(rooms.flatMap((r) => r.studentIds));
  const unassigned  = going.filter((s) => !assignedIds.has(s.id));

  const studentById = Object.fromEntries(going.map((s) => [s.id, s]));

  const boyRooms  = rooms.filter((r) => r.gender === "male");
  const girlRooms = rooms.filter((r) => r.gender === "female");

  // Filter rooms and unassigned by class
  function roomMatchesFilter(room: Room) {
    if (classFilter === "all") return true;
    if (room.studentIds.length === 0) return true; // empty rooms always visible
    return room.studentIds.some((id) => studentById[id]?.class === classFilter);
  }

  const filteredUnassigned = unassigned.filter((s) => {
    if (classFilter !== "all" && s.class !== classFilter) return false;
    if (genderView !== "all" && s.gender !== genderView) return false;
    return true;
  });

  // ── Auto-assign ───────────────────────────────────────────────────────────────

  function autoAssign() {
    const boys  = going.filter((s) => s.gender === "male");
    const girls = going.filter((s) => s.gender === "female");

    const newRooms: Room[] = [];

    function assignGroup(group: typeof going, gender: "male" | "female") {
      const byClass: Record<string, typeof going> = {};
      group.forEach((s) => {
        const k = s.class || "ללא כיתה";
        if (!byClass[k]) byClass[k] = [];
        byClass[k].push(s);
      });
      Object.keys(byClass)
        .sort((a, b) => a.localeCompare(b, "he"))
        .forEach((cls) => {
          const arr = byClass[cls];
          for (let i = 0; i < arr.length; i += preferredSize) {
            newRooms.push({
              id: crypto.randomUUID(),
              number: "",
              gender,
              studentIds: arr.slice(i, i + preferredSize).map((s) => s.id),
            });
          }
        });
    }

    assignGroup(boys,  "male");
    assignGroup(girls, "female");

    updateRooms(newRooms);
  }

  function clearAll() {
    if (!confirm("לנקות את כל חלוקת החדרים?")) return;
    updateRooms([]);
  }

  // ── Room actions ──────────────────────────────────────────────────────────────

  function addRoom(gender: "male" | "female") {
    updateRooms([...rooms, makeRoom(gender)]);
  }

  function deleteRoom(roomId: string) {
    if (!confirm("למחוק חדר זה? התלמידים יחזרו לרשימת לא משובצים.")) return;
    updateRooms(rooms.filter((r) => r.id !== roomId));
  }

  function setRoomNumber(roomId: string, number: string) {
    const updated = rooms.map((r) => r.id === roomId ? { ...r, number } : r);
    setRooms(updated);
    scheduleAutoSave(updated);
  }

  function moveRoom(roomId: string, dir: -1 | 1) {
    const idx = rooms.findIndex((r) => r.id === roomId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= rooms.length) return;
    const updated = [...rooms];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updateRooms(updated);
  }

  function removeStudentFromRoom(roomId: string, studentId: string) {
    updateRooms(
      rooms.map((r) =>
        r.id === roomId ? { ...r, studentIds: r.studentIds.filter((id) => id !== studentId) } : r
      )
    );
  }

  function assignStudentToRoom(studentId: string, roomId: string) {
    setAssigningId(null);
    if (!roomId) return;
    updateRooms(
      rooms.map((r) =>
        r.id === roomId ? { ...r, studentIds: [...r.studentIds, studentId] } : r
      )
    );
  }

  // ── Print ─────────────────────────────────────────────────────────────────────

  function getHTML() {
    const sections = [
      { gender: "male"   as const, label: "בנים" },
      { gender: "female" as const, label: "בנות" },
    ].map(({ gender, label }) => {
      const gRooms = rooms.filter((r) => r.gender === gender);
      if (gRooms.length === 0) return "";

      const cards = gRooms.map((room) => {
        const studs = room.studentIds.map((id) => studentById[id]).filter(Boolean);
        const chipColor = gender === "female" ? "#fce4ec" : "#e3f2fd";
        const chipBorder = gender === "female" ? "#f48fb1" : "#90caf9";
        const chips = studs
          .map((s) => `<span style="background:${chipColor};border:1px solid ${chipBorder};border-radius:12px;padding:2px 8px;font-size:10px;display:inline-block;margin:2px">${s.lastName} ${s.firstName} <span style="color:#999;font-size:9px">(${s.class})</span></span>`)
          .join("");
        const classLabel = [...new Set(studs.map((s) => s.class).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")).join(" + ");
        return `
          <div style="background:white;border:1.5px solid #e0e0e0;border-radius:8px;padding:10px;margin-bottom:10px;break-inside:avoid">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:11px">
              <strong>חדר ${room.number || "—"}</strong>
              ${classLabel ? `<span style="background:#e8f5e9;color:#2d6a4f;border-radius:8px;padding:1px 7px;font-size:10px">${classLabel}</span>` : ""}
              <span style="margin-right:auto;color:#888">${studs.length} תלמידים</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;min-height:24px">${chips || '<span style="color:#bbb;font-size:10px">ריק</span>'}</div>
          </div>`;
      }).join("");

      return `
        <div style="margin-bottom:20px">
          <div style="font-size:13px;font-weight:bold;padding:6px 10px;background:${gender === "female" ? "#fce4ec" : "#e3f2fd"};border-radius:6px;margin-bottom:10px">${label} — ${gRooms.length} חדרים</div>
          ${cards}
        </div>`;
    }).join("");

    const unassignedHTML = unassigned.length > 0
      ? `<div style="margin-top:16px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:10px;break-inside:avoid">
          <div style="font-size:11px;font-weight:bold;margin-bottom:6px">לא שובצו (${unassigned.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${unassigned.map((s) => {
              const bg  = s.gender === "female" ? "#fce4ec" : "#e3f2fd";
              const bdr = s.gender === "female" ? "#f48fb1" : "#90caf9";
              return `<span style="background:${bg};border:1px solid ${bdr};border-radius:12px;padding:2px 8px;font-size:10px">${s.lastName} ${s.firstName} <span style="color:#888">(${s.class})</span></span>`;
            }).join("")}
          </div>
        </div>`
      : "";

    return `
      <div class="header">
        <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
        <div class="title">חלוקת חדרים</div>
        ${trip ? `<div class="ministry">${trip.name ?? ""} | ${trip.schoolName ?? ""}</div>` : ""}
      </div>
      ${sections}
      ${unassignedHTML}
    `;
  }

  // ── Room card component ───────────────────────────────────────────────────────

  function RoomCard({ room, genderRooms }: { room: Room; genderRooms: Room[] }) {
    const studs = room.studentIds.map((id) => studentById[id]).filter(Boolean);
    const classLabel = [...new Set(studs.map((s) => s.class).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "he"))
      .join(" + ");

    const isGirl    = room.gender === "female";
    const chipBg    = isGirl ? "bg-pink-50"  : "bg-blue-50";
    const chipBorder = isGirl ? "border-pink-200" : "border-blue-200";
    const chipText  = isGirl ? "text-pink-800" : "text-blue-800";

    // eligible to add: unassigned students of same gender
    const eligible = unassigned.filter((s) => s.gender === room.gender);

    const gIdx = genderRooms.findIndex((r) => r.id === room.id);

    return (
      <div className="bg-white border border-border rounded-[var(--radius)] shadow-[var(--shadow-card)]">
        {/* Card header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          {/* Move controls */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => moveRoom(room.id, -1)}
              disabled={gIdx === 0}
              className="border border-border rounded px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 leading-tight"
            >▲</button>
            <button
              onClick={() => moveRoom(room.id, 1)}
              disabled={gIdx === genderRooms.length - 1}
              className="border border-border rounded px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 leading-tight"
            >▼</button>
          </div>

          {/* Room number */}
          <label className="text-xs text-muted-foreground whitespace-nowrap">מס׳ חדר:</label>
          <input
            type="text"
            value={room.number}
            onChange={(e) => setRoomNumber(room.id, e.target.value)}
            placeholder="ממתין לאכסנייה"
            className="text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1 focus:outline-none focus:border-primary w-28 ltr"
            dir="ltr"
          />

          {classLabel && (
            <span className="text-xs bg-[var(--primary-light,#e8f5e9)] text-primary rounded-full px-2 py-0.5">
              {classLabel}
            </span>
          )}

          <span className="mr-auto text-xs text-muted-foreground">{studs.length} תלמידים</span>

          <button
            onClick={() => deleteRoom(room.id)}
            className="text-muted-foreground hover:text-destructive transition-colors text-lg leading-none px-1"
            title="מחק חדר"
          >✕</button>
        </div>

        {/* Students chips area */}
        <div className="px-3 py-3 min-h-[52px] border-b border-dashed border-border">
          <div className="flex flex-wrap gap-1.5">
            {studs.length === 0 && (
              <span className="text-xs text-muted-foreground/40 italic">אין תלמידים</span>
            )}
            {studs.map((s) => (
              <span
                key={s.id}
                className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 border ${chipBg} ${chipBorder} ${chipText}`}
              >
                {s.firstName} {s.lastName}
                <span className="text-muted-foreground text-[10px]">({s.class})</span>
                <button
                  onClick={() => removeStudentFromRoom(room.id, s.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors mr-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Add student selector */}
        {eligible.length > 0 && (
          <div className="px-3 py-2 flex gap-2">
            <input
              type="text"
              list={`room-list-${room.id}`}
              placeholder="הוסף תלמיד/ה..."
              className="flex-1 text-xs border border-border rounded-[var(--radius-sm)] px-2 py-1 focus:outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const val = (e.target as HTMLInputElement).value.trim();
                const s = eligible.find((s) => `${s.lastName} ${s.firstName} (${s.class})` === val);
                if (s) {
                  assignStudentToRoom(s.id, room.id);
                  (e.target as HTMLInputElement).value = "";
                }
              }}
              onChange={(e) => {
                const val = e.target.value.trim();
                const s = eligible.find((s) => `${s.lastName} ${s.firstName} (${s.class})` === val);
                if (s) {
                  assignStudentToRoom(s.id, room.id);
                  e.target.value = "";
                }
              }}
            />
            <datalist id={`room-list-${room.id}`}>
              {eligible.map((s) => (
                <option key={s.id} value={`${s.lastName} ${s.firstName} (${s.class})`} />
              ))}
            </datalist>
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">חלוקת חדרים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            חלוקת תלמידים לחדרים באכסנייה — הפרדה בין בנים לבנות
          </p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {students.length === 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center">
          <p className="text-muted-foreground text-sm">ייבא רשימת תלמידים כדי לשבץ חדרים</p>
        </div>
      )}

      {students.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] px-4 py-3 flex flex-wrap items-center gap-4">
            {/* Preferred size */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground whitespace-nowrap">גודל חדר מועדף:</label>
              <div className="flex gap-1">
                {[4, 5, 6].map((n) => (
                  <label key={n} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="room-size"
                      checked={preferredSize === n}
                      onChange={() => {
                        setPreferredSize(n);
                        scheduleAutoSave(rooms, n);
                      }}
                      className="accent-primary"
                    />
                    <span className="text-sm">{n}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Auto-assign */}
            <button
              onClick={autoAssign}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors"
            >
              ⚡ חלק אוטומטית
            </button>

            {/* Class filter */}
            {allClasses.length > 1 && (
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="all">כל הכיתות</option>
                {allClasses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {/* Gender view toggle */}
            <div className="flex rounded-[var(--radius-sm)] border border-border overflow-hidden text-sm">
              {(["all", "male", "female"] as const).map((opt) => {
                const label = opt === "all" ? "הכל" : opt === "male" ? "בנים" : "בנות";
                return (
                  <button
                    key={opt}
                    onClick={() => setGenderView(opt)}
                    className={`px-3 py-1.5 transition-colors ${
                      genderView === opt
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Clear all */}
            {rooms.length > 0 && (
              <button
                onClick={clearAll}
                className="mr-auto text-sm text-destructive hover:text-destructive/80 transition-colors"
              >
                נקה הכל
              </button>
            )}
          </div>

          {/* Unassigned students */}
          {filteredUnassigned.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-[var(--radius)] p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                תלמידים ללא חדר ({filteredUnassigned.length}) — לחץ/י על תלמיד/ה לשיבוץ
              </p>
              <div className="flex flex-wrap gap-2">
                {filteredUnassigned.map((s) => {
                  const isGirl   = s.gender === "female";
                  const chipBg   = isGirl ? "bg-pink-100 border-pink-300 text-pink-900" : "bg-blue-100 border-blue-300 text-blue-900";
                  const targetRooms = rooms.filter((r) => r.gender === s.gender);

                  return (
                    <div key={s.id} className="relative">
                      {assigningId === s.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            autoFocus
                            className="text-xs border border-border rounded-full px-2 py-0.5 focus:outline-none focus:border-primary"
                            onChange={(e) => assignStudentToRoom(s.id, e.target.value)}
                            onBlur={() => setAssigningId(null)}
                          >
                            <option value="">בחר חדר...</option>
                            {targetRooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.number ? `חדר ${r.number}` : `חדר ${rooms.indexOf(r) + 1}`}
                                {` (${r.studentIds.length})`}
                              </option>
                            ))}
                          </select>
                          <button onClick={() => setAssigningId(null)} className="text-xs text-muted-foreground">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (targetRooms.length === 0) return;
                            if (targetRooms.length === 1) {
                              assignStudentToRoom(s.id, targetRooms[0].id);
                            } else {
                              setAssigningId(s.id);
                            }
                          }}
                          title={targetRooms.length === 0 ? `הוסף חדר ${isGirl ? "בנות" : "בנים"} תחילה` : "לחץ לשיבוץ"}
                          className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${chipBg} ${
                            targetRooms.length === 0 ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 cursor-pointer"
                          }`}
                        >
                          {s.firstName} {s.lastName}
                          <span className="mr-1 opacity-60">({s.class})</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Boys and Girls sections */}
          <div className={`grid gap-6 ${genderView === "all" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-2xl"}`}>
            {/* Boys */}
            {(genderView === "all" || genderView === "male") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-sm text-blue-700 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-200 inline-block" />
                    בנים — {boyRooms.length} חדרים
                  </h2>
                  <button
                    onClick={() => addRoom("male")}
                    className="text-xs text-primary border border-primary/30 rounded px-2 py-0.5 hover:bg-primary/5 transition-colors"
                  >
                    + הוסף חדר
                  </button>
                </div>

                {boyRooms.filter(roomMatchesFilter).length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8 bg-blue-50/50 rounded-[var(--radius)] border border-blue-100">
                    {classFilter !== "all" ? "אין חדרי בנים לכיתה זו" : "אין חדרי בנים — לחץ ⚡ או + הוסף חדר"}
                  </div>
                ) : (
                  boyRooms.filter(roomMatchesFilter).map((room) => (
                    <RoomCard key={room.id} room={room} genderRooms={boyRooms} />
                  ))
                )}
              </div>
            )}

            {/* Girls */}
            {(genderView === "all" || genderView === "female") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-sm text-pink-700 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-pink-200 inline-block" />
                    בנות — {girlRooms.length} חדרים
                  </h2>
                  <button
                    onClick={() => addRoom("female")}
                    className="text-xs text-primary border border-primary/30 rounded px-2 py-0.5 hover:bg-primary/5 transition-colors"
                  >
                    + הוסף חדר
                  </button>
                </div>

                {girlRooms.filter(roomMatchesFilter).length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8 bg-pink-50/50 rounded-[var(--radius)] border border-pink-100">
                    {classFilter !== "all" ? "אין חדרי בנות לכיתה זו" : "אין חדרי בנות — לחץ ⚡ או + הוסף חדר"}
                  </div>
                ) : (
                  girlRooms.filter(roomMatchesFilter).map((room) => (
                    <RoomCard key={room.id} room={room} genderRooms={girlRooms} />
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      <AppendixActions title="חלוקת חדרים" filename="חלוקת-חדרים" getHTML={getHTML} />
    </div>
  );
}

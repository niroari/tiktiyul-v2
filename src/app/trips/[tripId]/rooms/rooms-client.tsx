"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { useStudents } from "@/hooks/use-students";
import { useTrip } from "@/hooks/use-trip";
import { AppendixActions } from "@/components/appendix-actions";
import { Button } from "@/components/ui/button";

type RoomGender = "female" | "male" | "mixed";

type Room = {
  id: string;
  name: string;
  gender: RoomGender;
  capacity: number; // 0 = no limit
  studentIds: string[];
};

const GENDER_LABELS: Record<RoomGender, string> = {
  female: "בנות",
  male:   "בנים",
  mixed:  "מעורב",
};

const GENDER_COLORS: Record<RoomGender, string> = {
  female: "bg-pink-50 text-pink-700 border-pink-200",
  male:   "bg-blue-50 text-blue-700 border-blue-200",
  mixed:  "bg-purple-50 text-purple-700 border-purple-200",
};

function makeRoom(): Room {
  return { id: crypto.randomUUID(), name: "", gender: "female", capacity: 0, studentIds: [] };
}

export function RoomsClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { students } = useStudents(tripId);
  const { trip }     = useTrip(tripId);

  const [rooms, setRooms]   = useState<Room[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Per-room selector state
  const [selectors, setSelectors]     = useState<Record<string, string>>({});
  const [selectorErrors, setSelectorErrors] = useState<Record<string, string>>({});

  // New room form
  const [addingRoom, setAddingRoom]   = useState(false);
  const [newRoom, setNewRoom]         = useState<Room>(makeRoom());

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending = useRef(false);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "rooms", (raw) => {
      if (isPending.current) return;
      if (raw?.rooms) setRooms(raw.rooms as Room[]);
    });
    return () => unsub();
  }, [tripId]);

  function scheduleAutoSave(updated: Room[]) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "rooms", { rooms: updated });
      isPending.current = false;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function update(updated: Room[]) {
    setRooms(updated);
    scheduleAutoSave(updated);
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const going = students
    .filter((s) => s.isGoing)
    .sort((a, b) => {
      const c = a.class.localeCompare(b.class, "he");
      return c !== 0 ? c : a.lastName.localeCompare(b.lastName, "he");
    });

  const assignedIds = new Set(rooms.flatMap((r) => r.studentIds));
  const unassigned  = going.filter((s) => !assignedIds.has(s.id));

  const studentById = Object.fromEntries(going.map((s) => [s.id, s]));

  function eligibleForRoom(room: Room) {
    return going.filter((s) => {
      if (assignedIds.has(s.id)) return false;
      if (room.gender === "female" && s.gender !== "female") return false;
      if (room.gender === "male"   && s.gender !== "male")   return false;
      return true;
    });
  }

  // ── Room CRUD ─────────────────────────────────────────────────────────────────

  function confirmAddRoom() {
    if (!newRoom.name.trim()) return;
    const updated = [...rooms, { ...newRoom, id: crypto.randomUUID() }];
    update(updated);
    setAddingRoom(false);
    setNewRoom(makeRoom());
  }

  function removeRoom(roomId: string) {
    update(rooms.filter((r) => r.id !== roomId));
  }

  function updateRoom(roomId: string, patch: Partial<Room>) {
    update(rooms.map((r) => r.id === roomId ? { ...r, ...patch } : r));
  }

  // ── Student assignment ────────────────────────────────────────────────────────

  function addStudentToRoom(roomId: string) {
    const val = (selectors[roomId] ?? "").trim();
    if (!val) return;

    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    const eligible = eligibleForRoom(room);
    const s = eligible.find((s) => `${s.lastName} ${s.firstName} (${s.class})` === val);

    if (!s) {
      setSelectorErrors((prev) => ({ ...prev, [roomId]: "לא נמצא — יש לבחור מהרשימה" }));
      return;
    }
    if (room.capacity > 0 && room.studentIds.length >= room.capacity) {
      setSelectorErrors((prev) => ({ ...prev, [roomId]: `החדר מלא (${room.capacity} מקומות)` }));
      return;
    }

    setSelectorErrors((prev) => ({ ...prev, [roomId]: "" }));
    setSelectors((prev) => ({ ...prev, [roomId]: "" }));

    const updated = rooms.map((r) =>
      r.id === roomId ? { ...r, studentIds: [...r.studentIds, s.id] } : r
    );
    update(updated);
  }

  function removeStudentFromRoom(roomId: string, studentId: string) {
    const updated = rooms.map((r) =>
      r.id === roomId ? { ...r, studentIds: r.studentIds.filter((id) => id !== studentId) } : r
    );
    update(updated);
  }

  // ── Print HTML ────────────────────────────────────────────────────────────────

  function getHTML() {
    const roomSections = rooms.map((room) => {
      const studs = room.studentIds
        .map((id) => studentById[id])
        .filter(Boolean);

      const rows = studs.map((s, i) => `
        <tr style="${i % 2 === 0 ? "" : "background:#f0f7f4"}">
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px;text-align:center">${i + 1}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px">${s.lastName} ${s.firstName}</td>
          <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px;text-align:center">${s.class}</td>
        </tr>`).join("");

      const capacityStr = room.capacity > 0 ? ` (${studs.length}/${room.capacity})` : ` (${studs.length})`;

      return `
        <div style="margin-bottom:18px;break-inside:avoid">
          <div style="font-size:11px;font-weight:bold;padding:5px 8px;background:#e8f4f0;border:1px solid #c8e4dc;border-radius:3px;margin-bottom:0">
            ${room.name} — ${GENDER_LABELS[room.gender]}${capacityStr}
          </div>
          <table style="width:100%;border-collapse:collapse;margin-top:0">
            <thead><tr style="background:#f5f5f5">
              <th style="width:28px;padding:4px 8px;border:1px solid #ddd;font-size:10px;text-align:center">מס׳</th>
              <th style="padding:4px 8px;border:1px solid #ddd;font-size:10px;text-align:right">שם התלמיד/ה</th>
              <th style="width:55px;padding:4px 8px;border:1px solid #ddd;font-size:10px;text-align:center">כיתה</th>
            </tr></thead>
            <tbody>${rows || `<tr><td colspan="3" style="padding:8px;text-align:center;color:#aaa;font-size:10px">אין תלמידים</td></tr>`}</tbody>
          </table>
        </div>`;
    }).join("");

    const unassignedRows = unassigned.map((s, i) => `
      <tr style="${i % 2 === 0 ? "" : "background:#fff8f0"}">
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px">${s.lastName} ${s.firstName}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px;text-align:center">${s.class}</td>
      </tr>`).join("");

    return `
      <div class="header">
        <div class="ministry">משרד החינוך — מינהל חברה ונוער — של"ח וידיעת הארץ</div>
        <div class="title">חלוקת חדרים</div>
        ${trip ? `<div class="ministry">${trip.name ?? ""} | ${trip.schoolName ?? ""}</div>` : ""}
      </div>
      ${roomSections}
      ${unassigned.length > 0 ? `
        <div style="margin-top:16px;break-inside:avoid">
          <div style="font-size:11px;font-weight:bold;padding:5px 8px;background:#fff3cd;border:1px solid #ffc107;border-radius:3px">
            לא שובצו (${unassigned.length})
          </div>
          <table style="width:100%;border-collapse:collapse">
            <tbody>${unassignedRows}</tbody>
          </table>
        </div>` : ""}
    `;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const assignedCount = assignedIds.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">חלוקת חדרים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rooms.length} חדרים · {assignedCount} שובצו · {unassigned.length} ממתינים
          </p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {/* No students */}
      {students.length === 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center">
          <p className="text-muted-foreground text-sm">ייבא רשימת תלמידים כדי לשבץ חדרים</p>
        </div>
      )}

      {/* Add room button / form */}
      {students.length > 0 && (
        <>
          {!addingRoom ? (
            <Button variant="outline" size="sm" onClick={() => setAddingRoom(true)} type="button">
              <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              הוסף חדר
            </Button>
          ) : (
            <div className="bg-white rounded-[var(--radius)] border border-primary/30 shadow-[var(--shadow-card)] p-4">
              <p className="text-sm font-medium mb-3">חדר חדש</p>
              <div className="flex flex-wrap gap-3 items-end">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">שם / מספר חדר</label>
                  <input
                    autoFocus
                    type="text"
                    value={newRoom.name}
                    onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && confirmAddRoom()}
                    placeholder='חדר 101 / "בנות א׳"'
                    className="text-sm border border-border rounded-[var(--radius-sm)] px-3 py-1.5 focus:outline-none focus:border-primary w-44"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">סוג</label>
                  <div className="flex gap-1">
                    {(["female", "male", "mixed"] as RoomGender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setNewRoom({ ...newRoom, gender: g })}
                        className={`text-xs px-3 py-1.5 rounded-[var(--radius-sm)] border transition-colors ${
                          newRoom.gender === g
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {GENDER_LABELS[g]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Capacity */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">קיבולת (0 = ללא הגבלה)</label>
                  <input
                    type="number"
                    min={0}
                    value={newRoom.capacity}
                    onChange={(e) => setNewRoom({ ...newRoom, capacity: parseInt(e.target.value) || 0 })}
                    className="text-sm border border-border rounded-[var(--radius-sm)] px-3 py-1.5 focus:outline-none focus:border-primary w-24"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button size="sm" onClick={confirmAddRoom} disabled={!newRoom.name.trim()}>הוסף</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingRoom(false); setNewRoom(makeRoom()); }}>ביטול</Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Rooms list */}
      <div className="space-y-4">
        {rooms.map((room) => {
          const eligible   = eligibleForRoom(room);
          const studs      = room.studentIds.map((id) => studentById[id]).filter(Boolean);
          const isFull     = room.capacity > 0 && studs.length >= room.capacity;
          const listId     = `room-sel-${room.id}`;

          return (
            <div key={room.id} className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)]">
              {/* Room header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={room.name}
                    onChange={(e) => updateRoom(room.id, { name: e.target.value })}
                    className="font-medium text-sm bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none transition-colors"
                  />
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${GENDER_COLORS[room.gender]}`}>
                    {GENDER_LABELS[room.gender]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {studs.length}{room.capacity > 0 ? `/${room.capacity}` : ""} תלמידים
                  </span>
                  {isFull && (
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">מלא</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Gender toggle */}
                  <div className="flex gap-1">
                    {(["female", "male", "mixed"] as RoomGender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => updateRoom(room.id, { gender: g })}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                          room.gender === g
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {GENDER_LABELS[g]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => removeRoom(room.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Students chips */}
              <div className="px-4 py-3">
                {studs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {studs.map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1"
                      >
                        {s.lastName} {s.firstName}
                        <span className="text-muted-foreground/60">({s.class})</span>
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
                ) : (
                  <p className="text-xs text-muted-foreground/50 mb-3">אין תלמידים בחדר</p>
                )}

                {/* Student selector */}
                {!isFull && eligible.length > 0 && (
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        list={listId}
                        value={selectors[room.id] ?? ""}
                        onChange={(e) => {
                          setSelectors((prev) => ({ ...prev, [room.id]: e.target.value }));
                          setSelectorErrors((prev) => ({ ...prev, [room.id]: "" }));
                        }}
                        onKeyDown={(e) => e.key === "Enter" && addStudentToRoom(room.id)}
                        placeholder="הקלד שם לחיפוש..."
                        className="w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-1.5 focus:outline-none focus:border-primary"
                      />
                      <datalist id={listId}>
                        {eligible.map((s) => (
                          <option key={s.id} value={`${s.lastName} ${s.firstName} (${s.class})`} />
                        ))}
                      </datalist>
                      {selectorErrors[room.id] && (
                        <p className="text-xs text-destructive">{selectorErrors[room.id]}</p>
                      )}
                    </div>
                    <button
                      onClick={() => addStudentToRoom(room.id)}
                      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors shrink-0"
                    >
                      הוסף
                    </button>
                  </div>
                )}

                {isFull && (
                  <p className="text-xs text-amber-600">החדר מלא</p>
                )}
                {!isFull && eligible.length === 0 && going.length > 0 && (
                  <p className="text-xs text-muted-foreground/50">
                    {room.gender !== "mixed"
                      ? `אין ${GENDER_LABELS[room.gender]} לא משובצים`
                      : "כל התלמידים שובצו"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unassigned students */}
      {unassigned.length > 0 && rooms.length > 0 && (
        <div className="bg-amber-50 rounded-[var(--radius)] border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-800 mb-2">לא שובצו ({unassigned.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((s) => (
              <span key={s.id} className="text-xs bg-white border border-amber-200 rounded-full px-2.5 py-1 text-amber-900">
                {s.lastName} {s.firstName}
                <span className="text-amber-600 mr-1">({s.class})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {rooms.length === 0 && students.length > 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center">
          <p className="text-muted-foreground text-sm">טרם נוספו חדרים</p>
          <p className="text-xs text-muted-foreground/70 mt-1">לחץ/י על "הוסף חדר" כדי להתחיל</p>
        </div>
      )}

      <AppendixActions title="חלוקת חדרים" filename="חלוקת-חדרים" getHTML={getHTML} />
    </div>
  );
}

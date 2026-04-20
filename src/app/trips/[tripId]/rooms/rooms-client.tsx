"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { useStudents } from "@/hooks/use-students";
import { useTrip } from "@/hooks/use-trip";
import { AppendixActions } from "@/components/appendix-actions";
import { createRoomFillToken, listRoomFillTokensForTrip } from "@/lib/firestore/room-fill-tokens";
import type { RoomFillToken } from "@/lib/firestore/room-fill-tokens";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoomSpec   = { count: number; size: number };
type StaffRoom  = { id: string; number: string; capacity: number };
type StaffGroup = { id: string; label: string; rooms: StaffRoom[] };

type Room = {
  id: string;
  number: string;
  gender: "male" | "female";
  studentIds: string[];
  capacity?: number;   // set when created from hostel spec
  classLabel?: string; // set when auto-allocated by class (before students are assigned)
};

// Dialog uses specs (count × size) rather than expanded rooms
type DlgStaffGroup = { id: string; label: string; specs: RoomSpec[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function specsTotal(specs: RoomSpec[]) {
  return specs.reduce((sum, s) => sum + s.count * s.size, 0);
}

function makeRoom(gender: "male" | "female"): Room {
  return { id: crypto.randomUUID(), number: "", gender, studentIds: [] };
}

// Greedy bin-packing: fill `n` spots using rooms from `pool` (largest-first).
// When no room fits exactly, use the smallest available room (overflow allowed).
function allocateRoomsForCount(n: number, pool: { size: number; remaining: number }[]): number[] {
  const result: number[] = [];
  let left = n;
  const sorted = [...pool].sort((a, b) => b.size - a.size);
  while (left > 0) {
    const fit = sorted.find((p) => p.remaining > 0 && p.size <= left);
    if (fit) {
      fit.remaining--;
      result.push(fit.size);
      left -= fit.size;
    } else {
      // No room fits — use smallest available (overflow)
      const overflow = [...sorted].reverse().find((p) => p.remaining > 0);
      if (!overflow) break;
      overflow.remaining--;
      result.push(overflow.size);
      left -= overflow.size;
    }
  }
  return result;
}

// ─── SpecEditor ───────────────────────────────────────────────────────────────

function SpecEditor({ specs, onChange }: { specs: RoomSpec[]; onChange: (s: RoomSpec[]) => void }) {
  return (
    <div className="space-y-1.5">
      {specs.map((spec, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={99}
            value={spec.count}
            onChange={(e) => {
              const updated = [...specs];
              updated[i] = { ...spec, count: Math.max(1, parseInt(e.target.value) || 1) };
              onChange(updated);
            }}
            className="w-14 text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1 text-center focus:outline-none focus:border-primary"
          />
          <span className="text-sm text-muted-foreground">חדרים של</span>
          <input
            type="number"
            min={1}
            max={20}
            value={spec.size}
            onChange={(e) => {
              const updated = [...specs];
              updated[i] = { ...spec, size: Math.max(1, parseInt(e.target.value) || 1) };
              onChange(updated);
            }}
            className="w-14 text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1 text-center focus:outline-none focus:border-primary"
          />
          <span className="text-sm text-muted-foreground">מקומות</span>
          <button
            onClick={() => onChange(specs.filter((_, j) => j !== i))}
            className="text-muted-foreground hover:text-destructive transition-colors text-lg leading-none px-1"
          >✕</button>
        </div>
      ))}
      <button
        onClick={() => onChange([...specs, { count: 1, size: 4 }])}
        className="text-xs text-primary hover:text-primary/80 transition-colors"
      >
        + הוסף שורה
      </button>
    </div>
  );
}

// ─── HostelDialog ─────────────────────────────────────────────────────────────

type HostelDialogProps = {
  open: boolean;
  onClose: () => void;
  boyCount: number;
  girlCount: number;
  initialBoySpecs: RoomSpec[];
  initialGirlSpecs: RoomSpec[];
  initialStaffGroups: DlgStaffGroup[];
  onSave: (boySpecs: RoomSpec[], girlSpecs: RoomSpec[], staffGroups: DlgStaffGroup[]) => void;
};

function HostelDialog({
  open, onClose, boyCount, girlCount,
  initialBoySpecs, initialGirlSpecs, initialStaffGroups,
  onSave,
}: HostelDialogProps) {
  const [boySpecs,     setBoySpecs]     = useState<RoomSpec[]>(initialBoySpecs);
  const [girlSpecs,    setGirlSpecs]    = useState<RoomSpec[]>(initialGirlSpecs);
  const [staffGroups,  setStaffGroups]  = useState<DlgStaffGroup[]>(initialStaffGroups);

  // Sync when dialog opens
  useEffect(() => {
    if (open) {
      setBoySpecs(initialBoySpecs.length ? initialBoySpecs : []);
      setGirlSpecs(initialGirlSpecs.length ? initialGirlSpecs : []);
      setStaffGroups(initialStaffGroups);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function addStaffGroup() {
    setStaffGroups([...staffGroups, { id: crypto.randomUUID(), label: "", specs: [{ count: 1, size: 3 }] }]);
  }

  function removeStaffGroup(id: string) {
    setStaffGroups(staffGroups.filter((g) => g.id !== id));
  }

  function updateStaffGroup(id: string, patch: Partial<DlgStaffGroup>) {
    setStaffGroups(staffGroups.map((g) => g.id === id ? { ...g, ...patch } : g));
  }

  const boyTotal  = specsTotal(boySpecs);
  const girlTotal = specsTotal(girlSpecs);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-[var(--radius)] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-semibold text-base">קיבולת אכסנייה</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>

        <div className="px-5 py-5 space-y-6">

          {/* Boys */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-blue-700">בנים</h3>
              <span className={`text-xs ${boyTotal === boyCount ? "text-green-600 font-medium" : "text-amber-600"}`}>
                {boyTotal} מקומות · {boyCount} בנים
                {boyTotal === boyCount ? " ✓" : boyTotal < boyCount ? " — חסר " + (boyCount - boyTotal) : " — עודף " + (boyTotal - boyCount)}
              </span>
            </div>
            <SpecEditor specs={boySpecs} onChange={setBoySpecs} />
          </div>

          {/* Girls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-pink-700">בנות</h3>
              <span className={`text-xs ${girlTotal === girlCount ? "text-green-600 font-medium" : "text-amber-600"}`}>
                {girlTotal} מקומות · {girlCount} בנות
                {girlTotal === girlCount ? " ✓" : girlTotal < girlCount ? " — חסר " + (girlCount - girlTotal) : " — עודף " + (girlTotal - girlCount)}
              </span>
            </div>
            <SpecEditor specs={girlSpecs} onChange={setGirlSpecs} />
          </div>

          {/* Staff */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground border-t border-border pt-4">אנשי צוות</h3>
            {staffGroups.length === 0 && (
              <p className="text-xs text-muted-foreground">לא הוגדרו קבוצות צוות</p>
            )}
            {staffGroups.map((group) => (
              <div key={group.id} className="border border-border rounded-[var(--radius-sm)] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="שם הקבוצה (למשל: מורות)"
                    value={group.label}
                    onChange={(e) => updateStaffGroup(group.id, { label: e.target.value })}
                    className="flex-1 text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1.5 focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => removeStaffGroup(group.id)}
                    className="text-muted-foreground hover:text-destructive text-xl leading-none px-1 flex-shrink-0"
                  >✕</button>
                </div>
                <SpecEditor
                  specs={group.specs}
                  onChange={(specs) => updateStaffGroup(group.id, { specs })}
                />
              </div>
            ))}
            <button
              onClick={addStaffGroup}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              + הוסף קבוצת צוות
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-border px-5 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 border border-border rounded-[var(--radius-sm)] text-muted-foreground hover:bg-muted transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={() => { onSave(boySpecs, girlSpecs, staffGroups); onClose(); }}
            className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors"
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AddRoomButton ────────────────────────────────────────────────────────────

type SlotInfo = { size: number; total: number; used: number; remaining: number };

function AddRoomButton({
  specs, slots, open, onToggle, onAdd,
}: {
  gender: "male" | "female";
  specs: RoomSpec[];
  slots: SlotInfo[];
  open: boolean;
  onToggle: () => void;
  onAdd: (capacity?: number) => void;
}) {
  // No specs defined — plain button
  if (specs.length === 0) {
    return (
      <button
        onClick={() => onAdd(undefined)}
        className="text-xs text-primary border border-primary/30 rounded px-2 py-0.5 hover:bg-primary/5 transition-colors"
      >
        + הוסף חדר
      </button>
    );
  }

  const allFull = slots.every((s) => s.remaining <= 0);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        disabled={allFull}
        className="text-xs text-primary border border-primary/30 rounded px-2 py-0.5 hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + הוסף חדר {open ? "▲" : "▼"}
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-10" onClick={onToggle} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-border rounded-[var(--radius-sm)] shadow-lg min-w-[200px] overflow-hidden" dir="rtl">
            {slots.map((slot) => (
              <button
                key={slot.size}
                disabled={slot.remaining <= 0}
                onClick={() => onAdd(slot.size)}
                className="w-full text-right px-3 py-2 text-sm flex items-center justify-between gap-4 hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>חדר של <strong>{slot.size}</strong></span>
                <span className={`text-xs ${slot.remaining <= 0 ? "text-muted-foreground" : slot.remaining <= 2 ? "text-amber-600" : "text-green-600"}`}>
                  {slot.remaining > 0 ? `נותרו ${slot.remaining}/${slot.total}` : "מלא"}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── RoomCard ─────────────────────────────────────────────────────────────────

type Student = { id: string; firstName: string; lastName: string; class: string; gender: string };

type RoomCardProps = {
  room: Room;
  genderRooms: Room[];
  studentById: Record<string, Student>;
  unassigned: Student[];
  dragOverRoom: string | null;
  draggingId: string | null;
  onMoveRoom: (id: string, dir: -1 | 1) => void;
  onDeleteRoom: (id: string) => void;
  onSetNumber: (id: string, num: string) => void;
  onRemoveStudent: (roomId: string, studentId: string) => void;
  onAssignStudent: (studentId: string, roomId: string) => void;
  onMoveStudent: (studentId: string, fromRoom: string | null, toRoom: string) => void;
  setDragOverRoom: (id: string | null) => void;
  setDraggingId: (id: string | null) => void;
};

function RoomCard({
  room, genderRooms, studentById, unassigned,
  dragOverRoom, draggingId,
  onMoveRoom, onDeleteRoom, onSetNumber, onRemoveStudent, onAssignStudent, onMoveStudent,
  setDragOverRoom, setDraggingId,
}: RoomCardProps) {
  const studs      = room.studentIds.map((id) => studentById[id]).filter(Boolean);
  const classLabel = studs.length > 0
    ? [...new Set(studs.map((s) => s.class).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")).join(" + ")
    : (room.classLabel ?? "");
  const isGirl     = room.gender === "female";
  const chipBg     = isGirl ? "bg-pink-50"      : "bg-blue-50";
  const chipBorder = isGirl ? "border-pink-200"  : "border-blue-200";
  const chipText   = isGirl ? "text-pink-800"    : "text-blue-800";
  const eligible   = unassigned.filter((s) => s.gender === room.gender);
  const gIdx       = genderRooms.findIndex((r) => r.id === room.id);
  const overCap    = room.capacity !== undefined && studs.length > room.capacity;

  return (
    <div className={`bg-white border rounded-[var(--radius)] shadow-[var(--shadow-card)] ${overCap ? "border-amber-400" : "border-border"}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <div className="flex flex-col gap-0.5">
          <button onClick={() => onMoveRoom(room.id, -1)} disabled={gIdx === 0}
            className="border border-border rounded px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 leading-tight">▲</button>
          <button onClick={() => onMoveRoom(room.id, 1)} disabled={gIdx === genderRooms.length - 1}
            className="border border-border rounded px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 leading-tight">▼</button>
        </div>

        <label className="text-xs text-muted-foreground whitespace-nowrap">מס׳ חדר:</label>
        <input
          type="text"
          value={room.number}
          onChange={(e) => onSetNumber(room.id, e.target.value)}
          placeholder="ממתין לאכסנייה"
          className="text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1 focus:outline-none focus:border-primary w-28"
          dir="ltr"
        />

        {classLabel && (
          <span className="text-xs bg-[var(--primary-light,#e8f5e9)] text-primary rounded-full px-2 py-0.5">{classLabel}</span>
        )}

        {room.capacity !== undefined && (
          <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5 whitespace-nowrap">של {room.capacity}</span>
        )}

        <span className={`mr-auto text-xs ${overCap ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
          {studs.length}{room.capacity !== undefined ? `/${room.capacity}` : ""} תלמידים
        </span>

        <button onClick={() => onDeleteRoom(room.id)} className="text-muted-foreground hover:text-destructive transition-colors text-lg leading-none px-1" title="מחק חדר">✕</button>
      </div>

      {/* Students — drop zone */}
      <div
        className={`px-3 py-3 min-h-[64px] border-b border-dashed transition-colors ${
          dragOverRoom === room.id ? "bg-primary/5 border-primary" : "border-border"
        }`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverRoom(room.id); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverRoom(null); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverRoom(null);
          const studentId = e.dataTransfer.getData("studentId");
          const fromRoom  = e.dataTransfer.getData("fromRoom");
          if (!studentId) return;
          if (fromRoom) onMoveStudent(studentId, fromRoom, room.id);
          else onAssignStudent(studentId, room.id);
        }}
      >
        {dragOverRoom === room.id && studs.length === 0 && (
          <div className="text-xs text-primary/50 text-center py-1">שחרר כאן</div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {studs.length === 0 && dragOverRoom !== room.id && (
            <span className="text-xs text-muted-foreground/40 italic">גרור תלמיד/ה לכאן</span>
          )}
          {studs.map((s) => (
            <span
              key={s.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("studentId", s.id);
                e.dataTransfer.setData("fromRoom", room.id);
                e.dataTransfer.effectAllowed = "move";
                setDraggingId(s.id);
              }}
              onDragEnd={() => { setDraggingId(null); setDragOverRoom(null); }}
              className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 border cursor-grab active:cursor-grabbing transition-opacity ${chipBg} ${chipBorder} ${chipText} ${draggingId === s.id ? "opacity-40" : ""}`}
            >
              {s.firstName} {s.lastName}
              <span className="text-muted-foreground text-[10px]">({s.class})</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveStudent(room.id, s.id); }}
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

      {/* Add student */}
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
              if (s) { onAssignStudent(s.id, room.id); (e.target as HTMLInputElement).value = ""; }
            }}
            onChange={(e) => {
              const val = e.target.value.trim();
              const s = eligible.find((s) => `${s.lastName} ${s.firstName} (${s.class})` === val);
              if (s) { onAssignStudent(s.id, room.id); e.target.value = ""; }
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

// ─── Main component ───────────────────────────────────────────────────────────

export function RoomsClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { students } = useStudents(tripId);
  const { trip }     = useTrip(tripId);

  const [rooms,        setRooms]        = useState<Room[]>([]);
  const [boySpecs,     setBoySpecs]     = useState<RoomSpec[]>([]);
  const [girlSpecs,    setGirlSpecs]    = useState<RoomSpec[]>([]);
  const [staffGroups,  setStaffGroups]  = useState<StaffGroup[]>([]);
  const [preferredSize, setPreferredSize] = useState(5);
  const [status,       setStatus]       = useState<"idle" | "saving" | "saved">("idle");
  const [classFilter,  setClassFilter]  = useState("all");
  const [genderView,   setGenderView]   = useState<"all" | "male" | "female">("all");
  const [assigningId,  setAssigningId]  = useState<string | null>(null);
  const [hostelOpen,   setHostelOpen]   = useState(false);
  const [draggingId,   setDraggingId]   = useState<string | null>(null);
  const [dragOverRoom, setDragOverRoom] = useState<string | null>(null);
  const [addMenuOpen,    setAddMenuOpen]    = useState<"male" | "female" | null>(null);
  const [shareOpen,      setShareOpen]      = useState(false);
  const [roomTokens,     setRoomTokens]     = useState<RoomFillToken[]>([]);
  const [generatingClass, setGeneratingClass] = useState<string | null>(null);
  const [copiedToken,    setCopiedToken]    = useState<string | null>(null);
  const [shareError,     setShareError]     = useState<string | null>(null);

  const saveTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending  = useRef(false);

  // ── Persist ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "rooms", (raw) => {
      if (isPending.current) return;
      if (raw?.rooms)        setRooms(raw.rooms as Room[]);
      if (raw?.preferredSize) setPreferredSize(raw.preferredSize as number);
      if (raw?.boySpecs)     setBoySpecs(raw.boySpecs as RoomSpec[]);
      if (raw?.girlSpecs)    setGirlSpecs(raw.girlSpecs as RoomSpec[]);
      if (raw?.staffGroups)  setStaffGroups(raw.staffGroups as StaffGroup[]);
    });
    return () => unsub();
  }, [tripId]);

  function persist(
    nextRooms:       Room[]       = rooms,
    nextBoySpecs:    RoomSpec[]   = boySpecs,
    nextGirlSpecs:   RoomSpec[]   = girlSpecs,
    nextStaffGroups: StaffGroup[] = staffGroups,
    nextSize:        number       = preferredSize,
    delay                        = 1200,
  ) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "rooms", {
        rooms:        nextRooms,
        preferredSize: nextSize,
        boySpecs:     nextBoySpecs,
        girlSpecs:    nextGirlSpecs,
        staffGroups:  nextStaffGroups,
      });
      isPending.current = false;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, delay);
  }

  function updateRooms(updated: Room[]) {
    setRooms(updated);
    persist(updated);
  }

  // ── Hostel config ─────────────────────────────────────────────────────────────

  function saveHostelConfig(newBoySpecs: RoomSpec[], newGirlSpecs: RoomSpec[], dlgGroups: DlgStaffGroup[]) {
    // Expand DlgStaffGroup (specs) → StaffGroup (rooms), preserving existing room numbers
    const newStaffGroups: StaffGroup[] = dlgGroups.map((dg) => {
      const existing = staffGroups.find((g) => g.id === dg.id);
      const prevRooms = existing?.rooms ?? [];
      const expanded: StaffRoom[] = [];
      dg.specs.forEach((spec) => {
        for (let i = 0; i < spec.count; i++) {
          const prev = prevRooms[expanded.length];
          expanded.push({
            id:       prev?.id       ?? crypto.randomUUID(),
            number:   prev?.number   ?? "",
            capacity: spec.size,
          });
        }
      });
      return { id: dg.id, label: dg.label, rooms: expanded };
    });

    setBoySpecs(newBoySpecs);
    setGirlSpecs(newGirlSpecs);
    setStaffGroups(newStaffGroups);
    persist(rooms, newBoySpecs, newGirlSpecs, newStaffGroups, preferredSize, 400);
  }

  function updateStaffRoomNumber(groupId: string, roomId: string, number: string) {
    const updated = staffGroups.map((g) =>
      g.id === groupId
        ? { ...g, rooms: g.rooms.map((r) => r.id === roomId ? { ...r, number } : r) }
        : g
    );
    setStaffGroups(updated);
    persist(rooms, boySpecs, girlSpecs, updated);
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const going = students
    .filter((s) => s.isGoing)
    .sort((a, b) => {
      const c = a.class.localeCompare(b.class, "he");
      return c !== 0 ? c : a.lastName.localeCompare(b.lastName, "he");
    });

  const allClasses   = [...new Set(going.map((s) => s.class).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
  const assignedIds  = new Set(rooms.flatMap((r) => r.studentIds));
  const unassigned   = going.filter((s) => !assignedIds.has(s.id));
  const studentById  = Object.fromEntries(going.map((s) => [s.id, s]));
  const boyRooms     = rooms.filter((r) => r.gender === "male");
  const girlRooms    = rooms.filter((r) => r.gender === "female");
  const goingBoys    = going.filter((s) => s.gender === "male");
  const goingGirls   = going.filter((s) => s.gender === "female");

  function roomMatchesFilter(room: Room) {
    if (classFilter === "all") return true;
    if (room.classLabel) return room.classLabel === classFilter;
    if (room.studentIds.length === 0) return true;
    return room.studentIds.some((id) => studentById[id]?.class === classFilter);
  }

  const filteredUnassigned = unassigned.filter((s) => {
    if (classFilter !== "all" && s.class !== classFilter) return false;
    if (genderView !== "all" && s.gender !== genderView) return false;
    return true;
  });

  // ── Auto-assign ───────────────────────────────────────────────────────────────

  function autoAssign() {
    const newRooms: Room[] = [];

    function assignGroup(group: typeof going, gender: "male" | "female", specs: RoomSpec[]) {
      const sorted = [...group].sort((a, b) => {
        const c = a.class.localeCompare(b.class, "he");
        return c !== 0 ? c : a.lastName.localeCompare(b.lastName, "he");
      });

      if (specs.length > 0) {
        let idx = 0;
        for (const spec of specs) {
          for (let i = 0; i < spec.count; i++) {
            newRooms.push({
              id: crypto.randomUUID(),
              number: "",
              gender,
              studentIds: sorted.slice(idx, idx + spec.size).map((s) => s.id),
              capacity: spec.size,
            });
            idx += spec.size;
          }
        }
      } else {
        // Fallback: chunk by preferredSize
        const byClass: Record<string, typeof going> = {};
        sorted.forEach((s) => {
          const k = s.class || "ללא כיתה";
          if (!byClass[k]) byClass[k] = [];
          byClass[k].push(s);
        });
        Object.keys(byClass).sort((a, b) => a.localeCompare(b, "he")).forEach((cls) => {
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
    }

    assignGroup(goingBoys,  "male",   boySpecs);
    assignGroup(goingGirls, "female", girlSpecs);
    updateRooms(newRooms);
  }

  function autoAllocateClasses() {
    if (!confirm("לנקות חדרים קיימים ולחלק לפי כיתות (ללא שיבוץ תלמידים)?")) return;
    const newRooms: Room[] = [];

    function allocateGender(gender: "male" | "female", specs: RoomSpec[]) {
      const byClass = new Map<string, number>();
      going.filter((s) => s.gender === gender).forEach((s) => {
        byClass.set(s.class, (byClass.get(s.class) ?? 0) + 1);
      });
      const classes = [...byClass.entries()].sort((a, b) => a[0].localeCompare(b[0], "he"));
      const pool = specs.map((s) => ({ size: s.size, remaining: s.count }));
      for (const [className, count] of classes) {
        const sizes = allocateRoomsForCount(count, pool);
        for (const size of sizes) {
          newRooms.push({
            id: crypto.randomUUID(),
            number: "",
            gender,
            studentIds: [],
            capacity: size,
            classLabel: className,
          });
        }
      }
    }

    allocateGender("male",   boySpecs);
    allocateGender("female", girlSpecs);
    updateRooms(newRooms);
  }

  async function openShareDialog() {
    setShareOpen(true);
    const existing = await listRoomFillTokensForTrip(tripId);
    setRoomTokens(existing);
  }

  async function generateRoomToken(className: string) {
    setGeneratingClass(className);
    setShareError(null);
    try {
      // Include rooms tagged with classLabel OR rooms that have students from this class
      const classRooms = rooms
        .filter((r) =>
          r.classLabel === className ||
          r.studentIds.some((id) => studentById[id]?.class === className)
        )
        .map((r) => ({ id: r.id, number: r.number, capacity: r.capacity, gender: r.gender }));
      const token = await createRoomFillToken(
        tripId, className, trip?.name ?? "", trip?.schoolName ?? "", classRooms
      );
      setRoomTokens((prev) => {
        const filtered = prev.filter((t) => t.class !== className);
        return [...filtered, { token, tripId, class: className, tripName: trip?.name ?? "", schoolName: trip?.schoolName ?? "", rooms: classRooms, createdAt: null as any, expiresAt: null as any }];
      });
    } catch (e) {
      console.error("generateRoomToken error:", e);
      setShareError("שגיאה ביצירת הקישור. ודא שהחיבור לרשת תקין.");
    } finally {
      setGeneratingClass(null);
    }
  }

  function copyRoomLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/room-fill/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  function shareRoomWhatsApp(token: string, className: string) {
    const url = `${window.location.origin}/room-fill/${token}`;
    const msg = `*תיק טיול — שיבוץ תלמידים לחדרים*\nשלום, אנא שבצי את תלמידי כיתה ${className} לחדרים עבור טיול "${trip?.name ?? ""}".\nלחץ/י על הקישור:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function clearAll() {
    if (!confirm("לנקות את כל חלוקת החדרים?")) return;
    updateRooms([]);
  }

  // ── Room actions ──────────────────────────────────────────────────────────────

  function addRoom(gender: "male" | "female", capacity?: number) {
    updateRooms([...rooms, { ...makeRoom(gender), ...(capacity !== undefined ? { capacity } : {}) }]);
  }

  function remainingSlots(gender: "male" | "female") {
    const specs = gender === "male" ? boySpecs : girlSpecs;
    const gRooms = rooms.filter((r) => r.gender === gender);
    return specs.map((spec) => ({
      size:      spec.size,
      total:     spec.count,
      used:      gRooms.filter((r) => r.capacity === spec.size).length,
      remaining: spec.count - gRooms.filter((r) => r.capacity === spec.size).length,
    }));
  }

  function deleteRoom(roomId: string) {
    if (!confirm("למחוק חדר זה? התלמידים יחזרו לרשימת לא משובצים.")) return;
    updateRooms(rooms.filter((r) => r.id !== roomId));
  }

  function setRoomNumber(roomId: string, number: string) {
    const updated = rooms.map((r) => r.id === roomId ? { ...r, number } : r);
    setRooms(updated);
    persist(updated);
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
    updateRooms(rooms.map((r) =>
      r.id === roomId ? { ...r, studentIds: r.studentIds.filter((id) => id !== studentId) } : r
    ));
  }

  function assignStudentToRoom(studentId: string, roomId: string) {
    setAssigningId(null);
    if (!roomId) return;
    updateRooms(rooms.map((r) =>
      r.id === roomId ? { ...r, studentIds: [...r.studentIds, studentId] } : r
    ));
  }

  function moveStudent(studentId: string, fromRoomId: string | null, toRoomId: string) {
    if (fromRoomId === toRoomId) return;
    updateRooms(rooms.map((r) => {
      if (r.id === fromRoomId) return { ...r, studentIds: r.studentIds.filter((id) => id !== studentId) };
      if (r.id === toRoomId)   return { ...r, studentIds: [...r.studentIds, studentId] };
      return r;
    }));
  }

  // ── Convert StaffGroup → DlgStaffGroup for dialog ────────────────────────────

  function staffGroupsToDlg(groups: StaffGroup[]): DlgStaffGroup[] {
    return groups.map((g) => {
      const specs: RoomSpec[] = [];
      for (const room of g.rooms) {
        const last = specs[specs.length - 1];
        if (last && last.size === room.capacity) last.count++;
        else specs.push({ count: 1, size: room.capacity });
      }
      return { id: g.id, label: g.label, specs };
    });
  }

  // ── Print ─────────────────────────────────────────────────────────────────────

  function getHTML() {
    const sections = (["male", "female"] as const).map((gender) => {
      const gRooms = rooms.filter((r) => r.gender === gender);
      if (gRooms.length === 0) return "";
      const label = gender === "female" ? "בנות" : "בנים";
      const bgColor = gender === "female" ? "#fce4ec" : "#e3f2fd";
      const chipColor = bgColor;
      const chipBorder = gender === "female" ? "#f48fb1" : "#90caf9";

      const cards = gRooms.map((room) => {
        const studs = room.studentIds.map((id) => studentById[id]).filter(Boolean);
        const chips = studs.map((s) =>
          `<span style="background:${chipColor};border:1px solid ${chipBorder};border-radius:12px;padding:2px 8px;font-size:10px;display:inline-block;margin:2px">${s.lastName} ${s.firstName} <span style="color:#999;font-size:9px">(${s.class})</span></span>`
        ).join("");
        const classLabel = [...new Set(studs.map((s) => s.class).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")).join(" + ");
        const capLabel = room.capacity !== undefined ? ` · ${room.capacity} מקומות` : "";
        return `
          <div style="background:white;border:1.5px solid #e0e0e0;border-radius:8px;padding:10px;margin-bottom:10px;break-inside:avoid">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:11px">
              <strong>חדר ${room.number || "—"}</strong>
              ${classLabel ? `<span style="background:#e8f5e9;color:#2d6a4f;border-radius:8px;padding:1px 7px;font-size:10px">${classLabel}</span>` : ""}
              <span style="margin-right:auto;color:#888">${studs.length} תלמידים${capLabel}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;min-height:24px">${chips || '<span style="color:#bbb;font-size:10px">ריק</span>'}</div>
          </div>`;
      }).join("");

      return `
        <div style="margin-bottom:20px">
          <div style="font-size:13px;font-weight:bold;padding:6px 10px;background:${bgColor};border-radius:6px;margin-bottom:10px">${label} — ${gRooms.length} חדרים</div>
          ${cards}
        </div>`;
    }).join("");

    const staffHTML = staffGroups.length > 0
      ? `<div style="margin-top:24px;border-top:2px solid #eee;padding-top:16px">
          <div style="font-size:14px;font-weight:bold;margin-bottom:12px">אנשי צוות</div>
          ${staffGroups.map((group) => `
            <div style="margin-bottom:16px">
              <div style="font-size:13px;font-weight:bold;padding:6px 10px;background:#f5f5f5;border-radius:6px;margin-bottom:8px">${group.label} — ${group.rooms.length} חדרים</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px">
                ${group.rooms.map((room) => `
                  <div style="background:white;border:1.5px solid #e0e0e0;border-radius:8px;padding:8px 12px;font-size:11px;break-inside:avoid">
                    <strong>חדר ${room.number || "—"}</strong>
                    <span style="color:#888;margin-right:6px">${room.capacity} מקומות</span>
                  </div>`).join("")}
              </div>
            </div>`).join("")}
        </div>`
      : "";

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
      ${staffHTML}
      ${unassignedHTML}
    `;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const hasSpecs = boySpecs.length > 0 || girlSpecs.length > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">חלוקת חדרים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">חלוקת תלמידים לחדרים באכסנייה — הפרדה בין בנים לבנות</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-green-600" : "text-muted-foreground"}`}>
            {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
          </span>
          {allClasses.length > 0 && (
            <button
              onClick={openShareDialog}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-primary text-primary rounded-[var(--radius-sm)] hover:bg-[var(--brand-light)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              שתף לשיבוץ
            </button>
          )}
        </div>
      </div>

      {students.length === 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center">
          <p className="text-muted-foreground text-sm">ייבא רשימת תלמידים כדי לשבץ חדרים</p>
        </div>
      )}

      {students.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3">

            {/* Hostel capacity button */}
            <button
              onClick={() => setHostelOpen(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-border rounded-[var(--radius-sm)] hover:bg-muted transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {hasSpecs
                ? <span className="text-foreground">{specsTotal(boySpecs)} בנים · {specsTotal(girlSpecs)} בנות{staffGroups.length > 0 ? ` · ${staffGroups.length} קבוצות צוות` : ""}</span>
                : <span className="text-muted-foreground">הגדר קיבולת אכסנייה</span>
              }
            </button>

            {/* Preferred size — only when no specs set */}
            {!hasSpecs && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">גודל חדר:</label>
                <div className="flex gap-1">
                  {[4, 5, 6].map((n) => (
                    <label key={n} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="room-size"
                        checked={preferredSize === n}
                        onChange={() => {
                          setPreferredSize(n);
                          persist(rooms, boySpecs, girlSpecs, staffGroups, n);
                        }}
                        className="accent-primary"
                      />
                      <span className="text-sm">{n}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-assign */}
            <button
              onClick={autoAssign}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors"
            >
              ⚡ חלק אוטומטית
            </button>

            {/* Class-based allocation — only when hostel specs are set */}
            {hasSpecs && (
              <button
                onClick={autoAllocateClasses}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm border border-primary text-primary rounded-[var(--radius-sm)] hover:bg-[var(--brand-light)] transition-colors"
              >
                🏫 חלק לפי כיתות
              </button>
            )}

            {/* Class filter */}
            {allClasses.length > 1 && (
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="text-sm border border-border rounded-[var(--radius-sm)] px-2 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="all">כל הכיתות</option>
                {allClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {/* Gender view */}
            <div className="flex rounded-[var(--radius-sm)] border border-border overflow-hidden text-sm">
              {(["all", "male", "female"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setGenderView(opt)}
                  className={`px-3 py-1.5 transition-colors ${
                    genderView === opt
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {opt === "all" ? "הכל" : opt === "male" ? "בנים" : "בנות"}
                </button>
              ))}
            </div>

            {rooms.length > 0 && (
              <button onClick={clearAll} className="mr-auto text-sm text-destructive hover:text-destructive/80 transition-colors">
                נקה הכל
              </button>
            )}
          </div>

          {/* Unassigned students */}
          {filteredUnassigned.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-[var(--radius)] p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                תלמידים ללא חדר ({filteredUnassigned.length}
                {(() => {
                  const boys  = filteredUnassigned.filter((s) => s.gender === "male").length;
                  const girls = filteredUnassigned.filter((s) => s.gender === "female").length;
                  if (boys > 0 && girls > 0) return ` — ${boys} בנים, ${girls} בנות`;
                  if (boys > 0) return ` — ${boys} בנים`;
                  if (girls > 0) return ` — ${girls} בנות`;
                  return "";
                })()}
                ) — לחץ/י על תלמיד/ה לשיבוץ
              </p>
              <div className="flex flex-wrap gap-2">
                {filteredUnassigned.map((s) => {
                  const isGirl = s.gender === "female";
                  const chipBg = isGirl ? "bg-pink-100 border-pink-300 text-pink-900" : "bg-blue-100 border-blue-300 text-blue-900";
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
                                {` (${r.studentIds.length}${r.capacity !== undefined ? `/${r.capacity}` : ""})`}
                              </option>
                            ))}
                          </select>
                          <button onClick={() => setAssigningId(null)} className="text-xs text-muted-foreground">✕</button>
                        </div>
                      ) : (
                        <button
                          draggable={targetRooms.length > 0}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("studentId", s.id);
                            e.dataTransfer.setData("fromRoom", "");
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingId(s.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          onClick={() => {
                            if (targetRooms.length === 0) return;
                            if (targetRooms.length === 1) assignStudentToRoom(s.id, targetRooms[0].id);
                            else setAssigningId(s.id);
                          }}
                          title={targetRooms.length === 0 ? `הוסף חדר ${isGirl ? "בנות" : "בנים"} תחילה` : "גרור לחדר או לחץ לשיבוץ"}
                          className={`text-xs rounded-full px-2.5 py-1 border transition-all ${chipBg} ${
                            targetRooms.length === 0
                              ? "opacity-50 cursor-not-allowed"
                              : draggingId === s.id
                                ? "opacity-40 scale-95"
                                : "hover:opacity-80 cursor-grab active:cursor-grabbing"
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

          {/* Boys / Girls columns */}
          <div className={`grid gap-6 ${genderView === "all" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-2xl"}`}>
            {/* Boys */}
            {(genderView === "all" || genderView === "male") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-sm text-blue-700 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-200 inline-block" />
                    בנים — {boyRooms.length} חדרים
                    {goingBoys.length > 0 && <span className="text-muted-foreground font-normal">({goingBoys.length})</span>}
                  </h2>
                  <AddRoomButton gender="male" specs={boySpecs} slots={remainingSlots("male")}
                    open={addMenuOpen === "male"} onToggle={() => setAddMenuOpen(addMenuOpen === "male" ? null : "male")}
                    onAdd={(cap) => { addRoom("male", cap); setAddMenuOpen(null); }} />
                </div>
                {boyRooms.filter(roomMatchesFilter).length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8 bg-blue-50/50 rounded-[var(--radius)] border border-blue-100">
                    {classFilter !== "all" ? "אין חדרי בנים לכיתה זו" : "אין חדרי בנים — לחץ ⚡ או + הוסף חדר"}
                  </div>
                ) : (
                  boyRooms.filter(roomMatchesFilter).map((room) => (
                    <RoomCard key={room.id} room={room} genderRooms={boyRooms}
                      studentById={studentById} unassigned={unassigned}
                      dragOverRoom={dragOverRoom} draggingId={draggingId}
                      onMoveRoom={moveRoom} onDeleteRoom={deleteRoom} onSetNumber={setRoomNumber}
                      onRemoveStudent={removeStudentFromRoom} onAssignStudent={assignStudentToRoom}
                      onMoveStudent={moveStudent} setDragOverRoom={setDragOverRoom} setDraggingId={setDraggingId}
                    />
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
                    {goingGirls.length > 0 && <span className="text-muted-foreground font-normal">({goingGirls.length})</span>}
                  </h2>
                  <AddRoomButton gender="female" specs={girlSpecs} slots={remainingSlots("female")}
                    open={addMenuOpen === "female"} onToggle={() => setAddMenuOpen(addMenuOpen === "female" ? null : "female")}
                    onAdd={(cap) => { addRoom("female", cap); setAddMenuOpen(null); }} />
                </div>
                {girlRooms.filter(roomMatchesFilter).length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8 bg-pink-50/50 rounded-[var(--radius)] border border-pink-100">
                    {classFilter !== "all" ? "אין חדרי בנות לכיתה זו" : "אין חדרי בנות — לחץ ⚡ או + הוסף חדר"}
                  </div>
                ) : (
                  girlRooms.filter(roomMatchesFilter).map((room) => (
                    <RoomCard key={room.id} room={room} genderRooms={girlRooms}
                      studentById={studentById} unassigned={unassigned}
                      dragOverRoom={dragOverRoom} draggingId={draggingId}
                      onMoveRoom={moveRoom} onDeleteRoom={deleteRoom} onSetNumber={setRoomNumber}
                      onRemoveStudent={removeStudentFromRoom} onAssignStudent={assignStudentToRoom}
                      onMoveStudent={moveStudent} setDragOverRoom={setDragOverRoom} setDraggingId={setDraggingId}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Staff rooms */}
          {staffGroups.length > 0 && (
            <div className="space-y-4 border-t border-border pt-6">
              <h2 className="font-medium text-sm text-foreground">
                אנשי צוות
                <button onClick={() => setHostelOpen(true)} className="mr-2 text-xs text-primary hover:text-primary/80 transition-colors font-normal">(ערוך)</button>
              </h2>
              {staffGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <h3 className="text-sm text-muted-foreground">{group.label} — {group.rooms.length} חדרים</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {group.rooms.map((room) => (
                      <div key={room.id} className="bg-white border border-border rounded-[var(--radius-sm)] px-3 py-2 flex items-center gap-2 shadow-[var(--shadow-card)]">
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{room.capacity} מק׳</span>
                        <input
                          type="text"
                          value={room.number}
                          onChange={(e) => updateStaffRoomNumber(group.id, room.id, e.target.value)}
                          placeholder="מס' חדר"
                          className="flex-1 min-w-0 text-xs border border-border rounded px-1.5 py-1 focus:outline-none focus:border-primary"
                          dir="ltr"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <AppendixActions title="חלוקת חדרים" filename="חלוקת-חדרים" getHTML={getHTML} />

      <HostelDialog
        open={hostelOpen}
        onClose={() => setHostelOpen(false)}
        boyCount={goingBoys.length}
        girlCount={goingGirls.length}
        initialBoySpecs={boySpecs}
        initialGirlSpecs={girlSpecs}
        initialStaffGroups={staffGroupsToDlg(staffGroups)}
        onSave={saveHostelConfig}
      />

      {/* Share room-fill links dialog */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShareOpen(false)} />
          <div className="relative bg-white rounded-[var(--radius)] shadow-xl w-full max-w-md p-6 space-y-4" dir="rtl">
            <div>
              <h2 className="text-base font-semibold">שתף קישור שיבוץ לכיתה</h2>
              <p className="text-sm text-muted-foreground mt-1">
                שלח/י לכל מחנך/ת קישור — הם יוכלו לשבץ את תלמידיהם לחדרים שהוגדרו לכיתתם.
                השיבוץ יועבר אליך לאישור לפני עדכון המערכת.
              </p>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {allClasses.map((className) => {
                const existing      = roomTokens.find((t) => t.class === className);
                const isGenerating  = generatingClass === className;
                const classRoomCount = rooms.filter((r) =>
                  r.classLabel === className ||
                  r.studentIds.some((id) => studentById[id]?.class === className)
                ).length;
                const url = existing ? `${window.location.origin}/room-fill/${existing.token}` : null;
                return (
                  <div key={className} className="flex items-center gap-2 border border-border rounded-[var(--radius-sm)] px-3 py-2">
                    <div className="flex flex-col flex-shrink-0 w-20">
                      <span className="text-sm font-medium">כיתה {className}</span>
                      <span className="text-xs text-muted-foreground">{classRoomCount} חדרים</span>
                    </div>
                    {url ? (
                      <>
                        <input
                          readOnly
                          value={url}
                          dir="ltr"
                          className="flex-1 text-xs border border-border rounded px-2 py-1 bg-muted/30 focus:outline-none truncate"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={() => copyRoomLink(existing!.token)}
                          className="text-xs px-2 py-1 border border-border rounded hover:bg-muted/50 transition-colors whitespace-nowrap flex-shrink-0"
                        >
                          {copiedToken === existing!.token ? "הועתק ✓" : "העתק"}
                        </button>
                        <button
                          onClick={() => shareRoomWhatsApp(existing!.token, className)}
                          className="text-green-600 hover:text-green-700 transition-colors flex-shrink-0"
                          title="שתף בוואטסאפ"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => generateRoomToken(className)}
                          disabled={isGenerating}
                          title="חדש קישור"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          ↺
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => generateRoomToken(className)}
                        disabled={isGenerating || classRoomCount === 0}
                        className="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                      >
                        {isGenerating ? "יוצר קישור..." : classRoomCount === 0 ? "אין חדרים לכיתה זו" : "צור קישור ↗"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {shareError && (
              <p className="text-xs text-destructive">{shareError}</p>
            )}
            <div className="flex justify-end pt-2 border-t border-border">
              <button
                onClick={() => setShareOpen(false)}
                className="text-sm px-4 py-2 border border-border rounded-[var(--radius-sm)] hover:bg-muted transition-colors"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

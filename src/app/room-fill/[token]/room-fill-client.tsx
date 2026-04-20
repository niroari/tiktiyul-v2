"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getRoomFillToken } from "@/lib/firestore/room-fill-tokens";
import { getStudents } from "@/lib/firestore/students";
import { submitPendingUpdate } from "@/lib/firestore/pending-updates";
import type { RoomFillToken, RoomForToken } from "@/lib/firestore/room-fill-tokens";
import type { Student } from "@/lib/types";

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ tokenDoc, children }: { tokenDoc: RoomFillToken | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6faf8] px-4 py-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center space-y-1">
          <div className="text-xs text-muted-foreground">משרד החינוך — מינהל חברה ונוער</div>
          <h1 className="text-xl font-bold text-[#1b4332]">שיבוץ תלמידים לחדרים</h1>
          {tokenDoc && (
            <p className="text-sm text-muted-foreground">
              {tokenDoc.schoolName} · כיתה {tokenDoc.class} · {tokenDoc.tripName}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type State = "loading" | "ready" | "invalid" | "expired" | "submitting" | "done";

export function RoomFillClient() {
  const { token } = useParams<{ token: string }>();

  const [tokenDoc, setTokenDoc]     = useState<RoomFillToken | null>(null);
  const [students, setStudents]     = useState<Student[]>([]);
  const [state, setState]           = useState<State>("loading");
  const [submitError, setSubmitError] = useState("");

  // roomId → studentId[]
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [draggingId, setDraggingId]   = useState<string | null>(null);
  const [dragOverRoom, setDragOverRoom] = useState<string | null>(null);
  // click-to-assign: which student chip was clicked
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const doc = await getRoomFillToken(token);
        if (!doc) { setState("invalid"); return; }
        if (doc.expiresAt?.toDate() < new Date()) { setState("expired"); return; }
        setTokenDoc(doc);

        const studs = await getStudents(doc.tripId);
        const classStudents = studs
          .filter((s) => s.class === doc.class && s.isGoing)
          .sort((a, b) => a.lastName.localeCompare(b.lastName, "he"));
        setStudents(classStudents);

        const init: Record<string, string[]> = {};
        for (const room of doc.rooms) {
          init[room.id] = [];
        }
        setAssignments(init);

        setState("ready");
      } catch (e) {
        console.error("room-fill load error:", e);
        setState("invalid");
      }
    }
    load();
  }, [token]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const assignedIds  = new Set(Object.values(assignments).flat());
  const unassigned   = students.filter((s) => !assignedIds.has(s.id));
  const studentById  = Object.fromEntries(students.map((s) => [s.id, s]));

  // ── Actions ───────────────────────────────────────────────────────────────────

  function assignStudent(studentId: string, roomId: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      for (const rId of Object.keys(next)) {
        next[rId] = next[rId].filter((id) => id !== studentId);
      }
      next[roomId] = [...(next[roomId] ?? []), studentId];
      return next;
    });
    setAssigningId(null);
  }

  function removeStudent(studentId: string, roomId: string) {
    setAssignments((prev) => ({
      ...prev,
      [roomId]: prev[roomId].filter((id) => id !== studentId),
    }));
  }

  async function handleSubmit() {
    if (!tokenDoc) return;
    setState("submitting");
    setSubmitError("");
    try {
      await submitPendingUpdate(tokenDoc.tripId, {
        type: "room-assignment",
        tripId: tokenDoc.tripId,
        token,
        studentClass: tokenDoc.class,
        proposedRooms: Object.entries(assignments).map(([roomId, studentIds]) => ({
          roomId,
          studentIds,
        })),
      });
      setState("done");
    } catch {
      setSubmitError("שגיאה בשליחה. נסה/י שוב.");
      setState("ready");
    }
  }

  // ── Render states ─────────────────────────────────────────────────────────────

  if (state === "loading") return (
    <Shell tokenDoc={null}>
      <div className="text-center py-16 text-muted-foreground text-sm">טוען...</div>
    </Shell>
  );

  if (state === "invalid") return (
    <Shell tokenDoc={null}>
      <div className="bg-white rounded-xl border border-border p-8 text-center space-y-2">
        <div className="text-2xl">⚠️</div>
        <p className="font-medium">הקישור אינו תקף</p>
        <p className="text-sm text-muted-foreground">בקש/י קישור חדש מאחראי/ת הטיול.</p>
      </div>
    </Shell>
  );

  if (state === "expired") return (
    <Shell tokenDoc={null}>
      <div className="bg-white rounded-xl border border-border p-8 text-center space-y-2">
        <div className="text-2xl">⏰</div>
        <p className="font-medium">פג תוקף הקישור</p>
        <p className="text-sm text-muted-foreground">בקש/י קישור מעודכן מאחראי/ת הטיול.</p>
      </div>
    </Shell>
  );

  if (state === "done") return (
    <Shell tokenDoc={tokenDoc}>
      <div className="bg-white rounded-xl border border-green-200 p-8 text-center space-y-3">
        <div className="text-4xl">✅</div>
        <p className="text-lg font-bold text-green-700">השיבוץ נשלח לאישור</p>
        <p className="text-sm text-muted-foreground">אחראי/ת הטיול יאשר/תאשר את השיבוץ.</p>
      </div>
    </Shell>
  );

  const rooms = tokenDoc!.rooms;
  const totalAssigned = assignedIds.size;

  return (
    <Shell tokenDoc={tokenDoc}>
      {/* Save reminder */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex gap-3 items-start">
        <span className="text-2xl flex-shrink-0">⚠️</span>
        <div>
          <p className="font-bold text-amber-800 text-sm">חשוב — אל תשכחי ללחוץ על כפתור השליחה!</p>
          <p className="text-amber-700 text-sm mt-0.5">
            לאחר שיבוץ התלמידים, גלול/י למטה וללחוץ על{" "}
            <span className="font-bold">״שלח שיבוץ לאישור״</span>.
          </p>
        </div>
      </div>

      {/* Unassigned students */}
      {unassigned.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800">
            תלמידים ממתינים לשיבוץ ({unassigned.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((s) => {
              const isGirl    = s.gender === "female";
              const chipBg    = isGirl ? "bg-pink-100 border-pink-300 text-pink-900" : "bg-blue-100 border-blue-300 text-blue-900";
              const eligible  = rooms.filter((r) => !r.gender || r.gender === s.gender);
              return (
                <div key={s.id} className="relative">
                  {assigningId === s.id ? (
                    <div className="flex items-center gap-1">
                      <select
                        autoFocus
                        className="text-xs border border-border rounded-full px-2 py-0.5 focus:outline-none focus:border-primary"
                        onChange={(e) => e.target.value && assignStudent(s.id, e.target.value)}
                        onBlur={() => setAssigningId(null)}
                      >
                        <option value="">בחר חדר...</option>
                        {eligible.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.number ? `חדר ${r.number}` : `חדר ${rooms.indexOf(r) + 1}`}
                            {r.capacity ? ` (${(assignments[r.id] ?? []).length}/${r.capacity})` : ""}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => setAssigningId(null)} className="text-xs text-muted-foreground">✕</button>
                    </div>
                  ) : (
                    <button
                      draggable={eligible.length > 0}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("studentId", s.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(s.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => {
                        if (eligible.length === 0) return;
                        if (eligible.length === 1) assignStudent(s.id, eligible[0].id);
                        else setAssigningId(s.id);
                      }}
                      title={eligible.length === 0 ? "אין חדרים מתאימים" : "לחץ/י לשיבוץ או גרור לחדר"}
                      className={`text-xs rounded-full px-2.5 py-1 border transition-all ${chipBg} ${
                        eligible.length === 0
                          ? "opacity-50 cursor-not-allowed"
                          : draggingId === s.id
                            ? "opacity-40 scale-95"
                            : "hover:opacity-80 cursor-grab active:cursor-grabbing"
                      }`}
                    >
                      {s.firstName} {s.lastName}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unassigned.length === 0 && students.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-700 font-medium">
          ✓ כל {students.length} התלמידים שובצו לחדרים
        </div>
      )}

      {/* Room cards */}
      <div className="space-y-3">
        {rooms.map((room, idx) => {
          const studs      = (assignments[room.id] ?? []).map((id) => studentById[id]).filter(Boolean);
          const isGirl     = room.gender === "female";
          const overCap    = room.capacity !== undefined && studs.length > room.capacity;
          const chipBg     = isGirl ? "bg-pink-50 border-pink-200 text-pink-800" : "bg-blue-50 border-blue-200 text-blue-800";
          const isOver     = dragOverRoom === room.id;

          return (
            <div
              key={room.id}
              className={`bg-white rounded-xl border transition-colors ${overCap ? "border-amber-400" : isOver ? "border-primary ring-1 ring-primary/20" : "border-border"}`}
            >
              {/* Room header */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
                <span className="font-medium text-sm">
                  {room.number ? `חדר ${room.number}` : `חדר ${idx + 1}`}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isGirl ? "bg-pink-50 text-pink-700" : "bg-blue-50 text-blue-700"}`}>
                  {isGirl ? "בנות" : "בנים"}
                </span>
                {room.capacity !== undefined && (
                  <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                    של {room.capacity}
                  </span>
                )}
                <span className={`mr-auto text-xs ${overCap ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                  {studs.length}{room.capacity !== undefined ? `/${room.capacity}` : ""} תלמידים
                </span>
              </div>

              {/* Drop zone */}
              <div
                className={`px-4 py-3 min-h-[56px] transition-colors ${isOver ? "bg-primary/5" : ""}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverRoom(room.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverRoom(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverRoom(null);
                  const studentId = e.dataTransfer.getData("studentId");
                  if (!studentId) return;
                  const s = studentById[studentId];
                  if (!s) return;
                  if (room.gender && s.gender && s.gender !== room.gender) return;
                  assignStudent(studentId, room.id);
                }}
              >
                {studs.length === 0 && !isOver && (
                  <span className="text-xs text-muted-foreground/40 italic">גרור תלמיד/ה לכאן</span>
                )}
                {isOver && studs.length === 0 && (
                  <span className="text-xs text-primary/50">שחרר כאן</span>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {studs.map((s) => (
                    <span
                      key={s.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("studentId", s.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(s.id);
                      }}
                      onDragEnd={() => { setDraggingId(null); setDragOverRoom(null); }}
                      className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 border cursor-grab active:cursor-grabbing ${chipBg} ${draggingId === s.id ? "opacity-40" : ""}`}
                    >
                      {s.firstName} {s.lastName}
                      <button
                        onClick={() => removeStudent(s.id, room.id)}
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
            </div>
          );
        })}
      </div>

      {rooms.length === 0 && (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
          לא הוגדרו חדרים לכיתה זו. פנה/י לאחראי/ת הטיול.
        </div>
      )}

      {submitError && <p className="text-sm text-destructive text-center">{submitError}</p>}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={state === "submitting" || rooms.length === 0}
        className="w-full py-3.5 text-sm font-medium bg-[#1b4332] text-white rounded-xl hover:bg-[#1b4332]/90 transition-colors disabled:opacity-50"
      >
        {state === "submitting"
          ? "שולח..."
          : totalAssigned > 0
            ? `שלח שיבוץ לאישור (${totalAssigned} תלמידים)`
            : "שלח שיבוץ לאישור"}
      </button>
    </Shell>
  );
}

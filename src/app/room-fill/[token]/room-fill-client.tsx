"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getRoomFillToken } from "@/lib/firestore/room-fill-tokens";
import { getStudents } from "@/lib/firestore/students";
import { submitPendingUpdate } from "@/lib/firestore/pending-updates";
import { StudentAssignSheet } from "@/components/rooms/student-assign-sheet";
import type { RoomFillToken } from "@/lib/firestore/room-fill-tokens";
import type { Student } from "@/lib/types";

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ tokenDoc, children }: { tokenDoc: RoomFillToken | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6faf8] px-4 py-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center space-y-1">
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
  const [selectedStudentForSheet, setSelectedStudentForSheet] = useState<{
    student: Student;
    currentRoomId: string | null;
  } | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isMultiSheetOpen, setIsMultiSheetOpen] = useState(false);

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
        <div className="bg-white rounded-xl border border-amber-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-amber-800">
                תלמידים ממתינים לשיבוץ ({unassigned.length})
              </p>
              <p className="text-xs text-amber-700/80">
                {multiSelectMode
                  ? "בחר תלמידים לשיבוץ יחד"
                  : "לחץ/י על תלמיד/ה לשיבוץ מהיר או גרור/י לחדר"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {multiSelectMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedStudentIds.length === 0) {
                        setSelectedStudentIds(unassigned.map((s) => s.id));
                      } else {
                        setSelectedStudentIds([]);
                      }
                    }}
                    className="text-xs px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-md text-amber-900 font-medium hover:bg-amber-100/60 transition-colors"
                  >
                    {selectedStudentIds.length === 0 ? "בחר הכל" : "נקה בחירה"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMultiSelectMode(false);
                      setSelectedStudentIds([]);
                    }}
                    className="text-xs px-2.5 py-1 bg-white border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ביטול
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setMultiSelectMode(true)}
                  className="text-xs px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-md text-amber-900 font-medium hover:bg-amber-100/60 transition-all shadow-xs"
                >
                  ☑ בחירה מרובה
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {unassigned.map((s) => {
              const isGirl = s.gender === "female";
              const isSelected = selectedStudentIds.includes(s.id);
              const chipBg = isGirl
                ? isSelected
                  ? "bg-pink-200 border-pink-500 text-pink-950 font-semibold ring-2 ring-pink-400/50"
                  : "bg-pink-100 border-pink-300 text-pink-900"
                : isSelected
                ? "bg-blue-200 border-blue-500 text-blue-950 font-semibold ring-2 ring-blue-400/50"
                : "bg-blue-100 border-blue-300 text-blue-900";
              const eligible = rooms.filter((r) => !r.gender || r.gender === s.gender);

              return (
                <button
                  key={s.id}
                  type="button"
                  draggable={!multiSelectMode && eligible.length > 0}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("studentId", s.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(s.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => {
                    if (multiSelectMode) {
                      setSelectedStudentIds((prev) =>
                        prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                      );
                    } else {
                      setSelectedStudentForSheet({ student: s, currentRoomId: null });
                    }
                  }}
                  title={
                    multiSelectMode
                      ? isSelected ? "בטל בחירה" : "בחר תלמיד/ה"
                      : eligible.length === 0
                      ? "אין חדרים מתאימים"
                      : "לחץ/י לשיבוץ או גרור/י לחדר"
                  }
                  className={`text-xs rounded-full px-2.5 py-1 border transition-all flex items-center gap-1 ${chipBg} ${
                    eligible.length === 0 && !multiSelectMode
                      ? "opacity-50 cursor-not-allowed"
                      : draggingId === s.id
                      ? "opacity-40 scale-95"
                      : "hover:opacity-90 cursor-pointer active:scale-95"
                  }`}
                >
                  {multiSelectMode && (
                    <span className="text-[10px] w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center mr-0.5">
                      {isSelected ? "✓" : ""}
                    </span>
                  )}
                  <span>{s.firstName} {s.lastName}</span>
                </button>
              );
            })}
          </div>

          {/* Multi-select action bar */}
          {multiSelectMode && selectedStudentIds.length > 0 && (
            <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-amber-900">
                נבחרו {selectedStudentIds.length} תלמידים
              </span>
              <button
                type="button"
                onClick={() => setIsMultiSheetOpen(true)}
                className="text-xs bg-primary text-primary-foreground font-medium px-4 py-1.5 rounded-lg shadow-sm hover:bg-primary/90 transition-all active:scale-95"
              >
                שבץ {selectedStudentIds.length} תלמידים לחדר...
              </button>
            </div>
          )}
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
                      onClick={() => setSelectedStudentForSheet({ student: s, currentRoomId: room.id })}
                      title="לחץ/י להעברה או הסרה, או גרור/י"
                      className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 border cursor-pointer hover:shadow-xs active:scale-95 transition-all ${chipBg} ${draggingId === s.id ? "opacity-40" : ""}`}
                    >
                      {s.firstName} {s.lastName}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeStudent(s.id, room.id);
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors mr-0.5 p-0.5 rounded-full hover:bg-black/5"
                        title="הסר מהחדר"
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

      {/* Student Assign Sheet */}
      <StudentAssignSheet
        open={!!selectedStudentForSheet || isMultiSheetOpen}
        onClose={() => {
          setSelectedStudentForSheet(null);
          setIsMultiSheetOpen(false);
        }}
        students={
          isMultiSheetOpen
            ? unassigned.filter((s) => selectedStudentIds.includes(s.id))
            : selectedStudentForSheet
            ? [selectedStudentForSheet.student]
            : []
        }
        currentRoomId={selectedStudentForSheet?.currentRoomId ?? null}
        rooms={rooms.map((r, idx) => {
          const studs = (assignments[r.id] ?? []).map((id) => studentById[id]).filter(Boolean);
          return {
            id: r.id,
            number: r.number || `${idx + 1}`,
            capacity: r.capacity,
            gender: r.gender,
            studentNames: studs.map((s) => `${s.firstName} ${s.lastName}`),
            currentCount: studs.length,
          };
        })}
        onAssignToRoom={(ids, targetRoomId) => {
          ids.forEach((id) => {
            assignStudent(id, targetRoomId);
          });
          setSelectedStudentIds([]);
          setMultiSelectMode(false);
        }}
        onRemoveFromRoom={(ids, fromRoomId) => {
          ids.forEach((id) => {
            removeStudent(id, fromRoomId);
          });
        }}
      />
    </Shell>
  );
}

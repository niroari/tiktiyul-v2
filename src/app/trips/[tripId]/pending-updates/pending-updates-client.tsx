"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useStudents } from "@/hooks/use-students";
import { subscribeToPendingUpdates, resolvePendingUpdate } from "@/lib/firestore/pending-updates";
import { updateStudent } from "@/lib/firestore/students";
import { getAppendix, saveAppendix } from "@/lib/firestore/appendix";
import type { PendingUpdate, Student } from "@/lib/types";

// ── Diff helpers ───────────────────────────────────────────────────────────────

type DiffRow = { field: string; before: string; after: string };

function computeDiff(update: PendingUpdate, current: Student | undefined): DiffRow[] {
  if (!current || update.type === "room-assignment") return [];
  const rows: DiffRow[] = [];

  if (update.proposedIsGoing !== current.isGoing) {
    rows.push({
      field: "יוצא לטיול",
      before: current.isGoing ? "כן" : "לא",
      after: update.proposedIsGoing ? "כן" : "לא",
    });
  }

  const dietLabels: Record<string, string> = { vegetarian: "צמחוני", vegan: "טבעוני", glutenFree: "ללא גלוטן" };
  for (const flag of ["vegetarian", "vegan", "glutenFree"] as const) {
    const before = current.dietaryFlags?.[flag] ?? false;
    const after  = update.proposedDietaryFlags?.[flag] ?? false;
    if (before !== after) {
      rows.push({ field: `מזון — ${dietLabels[flag]}`, before: before ? "✓" : "—", after: after ? "✓" : "—" });
    }
  }

  const beforeNotes = (current.medicalNotes ?? "").trim();
  const afterNotes  = (update.proposedMedicalNotes ?? "").trim();
  if (beforeNotes !== afterNotes) {
    rows.push({ field: "הערות רפואיות", before: beforeNotes || "—", after: afterNotes || "—" });
  }

  const beforeGeneral = (current.notes ?? "").trim();
  const afterGeneral  = (update.proposedNotes ?? "").trim();
  if (beforeGeneral !== afterGeneral) {
    rows.push({ field: "הערות", before: beforeGeneral || "—", after: afterGeneral || "—" });
  }

  return rows;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PendingUpdatesClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { students } = useStudents(tripId);
  const [updates, setUpdates] = useState<PendingUpdate[]>([]);
  const [resolving, setResolving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return subscribeToPendingUpdates(tripId, setUpdates);
  }, [tripId]);

  const studentById = Object.fromEntries(students.map((s) => [s.id, s]));

  async function approveRoomAssignment(update: PendingUpdate) {
    const raw = await getAppendix(tripId, "rooms");
    const currentRooms = ((raw?.rooms ?? []) as Array<{ id: string; studentIds: string[]; [k: string]: unknown }>);
    const updatedRooms = currentRooms.map((room) => {
      const proposed = update.proposedRooms?.find((r) => r.roomId === room.id);
      return proposed ? { ...room, studentIds: proposed.studentIds } : room;
    });
    await saveAppendix(tripId, "rooms", { ...(raw ?? {}), rooms: updatedRooms });
    await resolvePendingUpdate(tripId, update.id, "approved");
  }

  async function approve(update: PendingUpdate) {
    if (update.type === "room-assignment") {
      setResolving((r) => ({ ...r, [update.id]: true }));
      try { await approveRoomAssignment(update); }
      finally { setResolving((r) => ({ ...r, [update.id]: false })); }
      return;
    }
    setResolving((r) => ({ ...r, [update.id]: true }));
    try {
      await updateStudent(tripId, update.studentId!, {
        isGoing: update.proposedIsGoing,
        dietaryFlags: update.proposedDietaryFlags,
        medicalNotes: update.proposedMedicalNotes,
        notes: update.proposedNotes ?? "",
      });
      await resolvePendingUpdate(tripId, update.id, "approved");

      // If medical notes are non-empty, ensure the student appears in appendix yod
      if ((update.proposedMedicalNotes ?? "").trim()) {
        const yod = await getAppendix(tripId, "yod");
        const currentRows = ((yod?.rows ?? []) as { studentId: string }[]);
        if (!currentRows.find((r) => r.studentId === update.studentId)) {
          await saveAppendix(tripId, "yod", {
            rows: [
              ...currentRows,
              {
                id: crypto.randomUUID(),
                studentId: update.studentId,
                lastName: update.studentLastName,
                firstName: update.studentFirstName,
                class: update.studentClass,
                issue: update.proposedMedicalNotes,
                notes: "",
                certUrl: "",
                certName: "",
              },
            ],
          });
        }
      }
    } finally {
      setResolving((r) => ({ ...r, [update.id]: false }));
    }
  }

  async function reject(update: PendingUpdate) {
    setResolving((r) => ({ ...r, [update.id]: true }));
    try {
      await resolvePendingUpdate(tripId, update.id, "rejected");
    } finally {
      setResolving((r) => ({ ...r, [update.id]: false }));
    }
  }

  async function approveAll() {
    for (const u of updates) await approve(u);
  }

  // Split types
  const studentUpdates = updates.filter((u) => !u.type || u.type === "student");
  const roomUpdates    = updates.filter((u) => u.type === "room-assignment");

  // Group student updates by class
  const byClass: Record<string, PendingUpdate[]> = {};
  for (const u of studentUpdates) {
    if (!byClass[u.studentClass]) byClass[u.studentClass] = [];
    byClass[u.studentClass].push(u);
  }
  const sortedClasses = Object.keys(byClass).sort((a, b) => a.localeCompare(b, "he"));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">עדכונים ממתינים לאישור</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {updates.length > 0
              ? `${updates.length} עדכונים ממחנכים — בדוק/י ואשר/י`
              : "אין עדכונים ממתינים"}
          </p>
        </div>
        {updates.length > 1 && (
          <button
            onClick={approveAll}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors"
          >
            אשר הכל ({updates.length})
          </button>
        )}
      </div>

      {updates.length === 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-muted-foreground text-sm">כל העדכונים טופלו. אין ממתינים.</p>
        </div>
      )}

      {/* Room assignment proposals */}
      {roomUpdates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground px-1">הצעות שיבוץ חדרים</h2>
          {roomUpdates.map((update) => {
            const busy = resolving[update.id];
            return (
              <div key={update.id} className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                  <div>
                    <span className="font-medium text-foreground">שיבוץ חדרים — כיתה {update.studentClass}</span>
                    <span className="mr-2 text-xs text-muted-foreground">{update.proposedRooms?.length ?? 0} חדרים</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(update)}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 border border-border rounded-[var(--radius-sm)] text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-40"
                    >
                      דחה
                    </button>
                    <button
                      onClick={() => approve(update)}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors disabled:opacity-40"
                    >
                      {busy ? "מעדכן..." : "אשר ועדכן"}
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {(update.proposedRooms ?? []).map((room) => {
                    const roomStudents = room.studentIds
                      .map((id) => studentById[id])
                      .filter(Boolean);
                    return (
                      <div key={room.roomId} className="flex items-start gap-3 text-sm">
                        <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 w-24">
                          חדר (מזהה {room.roomId.slice(-4)})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {roomStudents.length === 0
                            ? <span className="text-xs text-muted-foreground/50 italic">ריק</span>
                            : roomStudents.map((s) => (
                              <span key={s!.id} className={`text-xs rounded-full px-2 py-0.5 border ${
                                s!.gender === "female" ? "bg-pink-50 border-pink-200 text-pink-800" : "bg-blue-50 border-blue-200 text-blue-800"
                              }`}>
                                {s!.lastName} {s!.firstName}
                              </span>
                            ))
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sortedClasses.map((className) => (
        <div key={className} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground px-1">כיתה {className}</h2>
          {byClass[className].map((update) => {
            const current = studentById[update.studentId!];
            const diff = computeDiff(update, current);
            const busy = resolving[update.id];

            return (
              <div key={update.id} className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
                {/* Student header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                  <div>
                    <span className="font-medium text-foreground">
                      {update.studentLastName} {update.studentFirstName}
                    </span>
                    <span className="mr-2 text-xs text-muted-foreground">כיתה {update.studentClass}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(update)}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 border border-border rounded-[var(--radius-sm)] text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-40"
                    >
                      דחה
                    </button>
                    <button
                      onClick={() => approve(update)}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors disabled:opacity-40"
                    >
                      {busy ? "מעדכן..." : "אשר ועדכן"}
                    </button>
                  </div>
                </div>

                {/* Diff table */}
                {diff.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">לא זוהו שינויים לעומת המידע הקיים.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/20 border-b border-border">
                      <tr>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs w-40">שדה</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">לפני</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">אחרי</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.field}</td>
                          <td className="px-4 py-2.5 text-muted-foreground line-through text-xs">{row.before}</td>
                          <td className="px-4 py-2.5 font-medium text-foreground text-xs">{row.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

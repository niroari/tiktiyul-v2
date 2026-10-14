"use client";

import { useEffect, useState, useMemo, useCallback } from "react";

export type AssignSheetRoom = {
  id: string;
  number: string;
  capacity?: number;
  classLabel?: string;
  gender?: "male" | "female";
  studentNames: string[];
  currentCount: number;
};

export type StudentAssignSheetProps = {
  open: boolean;
  onClose: () => void;
  students: {
    id: string;
    firstName: string;
    lastName: string;
    class: string;
    gender: string;
  }[];
  currentRoomId: string | null;
  rooms: AssignSheetRoom[];
  onAssignToRoom: (studentIds: string[], roomId: string) => void;
  onRemoveFromRoom?: (studentIds: string[], roomId: string) => void;
};

export function StudentAssignSheet({
  open,
  onClose,
  students,
  currentRoomId,
  rooms,
  onAssignToRoom,
  onRemoveFromRoom,
}: StudentAssignSheetProps) {
  const [search, setSearch] = useState("");

  const handleClose = useCallback(() => {
    setSearch("");
    onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  const targetGender = students[0]?.gender;
  const isMulti = students.length > 1;

  // Filter rooms matching student gender (if gender defined) and search text
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (targetGender && r.gender && r.gender !== targetGender) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const numMatch = (r.number || "").toLowerCase().includes(q);
      const classMatch = (r.classLabel || "").toLowerCase().includes(q);
      const studentMatch = r.studentNames.some((name) => name.toLowerCase().includes(q));
      return numMatch || classMatch || studentMatch;
    });
  }, [rooms, targetGender, search]);

  if (!open || students.length === 0) return null;

  const currentRoom = rooms.find((r) => r.id === currentRoomId);
  const studentIds = students.map((s) => s.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir="rtl">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sheet / Modal Container */}
      <div className="relative w-full sm:max-w-lg bg-card text-card-foreground border border-border shadow-2xl rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col z-10 animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Mobile Pull Bar Indicator */}
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 pt-3 pb-3 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold">
                {isMulti ? (
                  <span>שיבוץ {students.length} תלמידים</span>
                ) : (
                  <span>
                    {students[0].firstName} {students[0].lastName}
                  </span>
                )}
              </h2>

              {!isMulti && (
                <>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {students[0].class}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      students[0].gender === "female"
                        ? "bg-pink-100 text-pink-800 border border-pink-200"
                        : "bg-blue-100 text-blue-800 border border-blue-200"
                    }`}
                  >
                    {students[0].gender === "female" ? "בת" : "בן"}
                  </span>
                </>
              )}
            </div>

            {/* Current status line */}
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              {currentRoom ? (
                <>
                  <span>
                    משובץ כרגע ב:{" "}
                    <strong className="text-foreground">
                      {currentRoom.number ? `חדר ${currentRoom.number}` : "חדר ללא מספר"}
                    </strong>
                    {currentRoom.capacity ? ` (${currentRoom.currentCount}/${currentRoom.capacity})` : ""}
                  </span>
                  {onRemoveFromRoom && (
                    <button
                      type="button"
                      onClick={() => {
                        onRemoveFromRoom(studentIds, currentRoom.id);
                        onClose();
                      }}
                      className="text-destructive hover:underline font-medium inline-flex items-center gap-1 mr-1"
                    >
                      ✕ הוצא ללא משובצים
                    </button>
                  )}
                </>
              ) : (
                <span className="text-amber-600 font-medium">טרם שובץ/ה לחדר</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        {/* Search filter if there are several rooms */}
        {rooms.length > 4 && (
          <div className="px-5 pt-3 pb-1 shrink-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש לפי מספר חדר, כיתה או שם שותף..."
              className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:border-primary"
            />
          </div>
        )}

        {/* Room List - Scrollable */}
        <div className="px-5 py-3 overflow-y-auto space-y-2.5 flex-1 min-h-[160px]">
          <p className="text-xs font-medium text-muted-foreground">
            בחר חדר יעד לשיבוץ:
          </p>

          {filteredRooms.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              לא נמצאו חדרים מתאימים.
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isCurrent = room.id === currentRoomId;
              const isFull = room.capacity !== undefined && room.currentCount >= room.capacity;
              const willOverflow =
                room.capacity !== undefined &&
                room.currentCount + (isCurrent ? 0 : students.length) > room.capacity;

              return (
                <button
                  key={room.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => {
                    if (isCurrent) return;
                    onAssignToRoom(studentIds, room.id);
                    onClose();
                  }}
                  className={`w-full text-right p-3 rounded-xl border transition-all text-xs flex flex-col gap-1.5 ${
                    isCurrent
                      ? "border-primary bg-primary/5 cursor-default opacity-90 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary hover:bg-muted/40 active:scale-[0.99] cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {room.number ? `חדר ${room.number}` : "חדר ללא מספר"}
                      </span>
                      {room.classLabel && (
                        <span className="text-[11px] bg-primary/10 text-primary rounded-full px-2 py-0.5">
                          {room.classLabel}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[11px] bg-primary text-primary-foreground font-medium rounded-full px-2 py-0.5">
                          החדר הנוכחי
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-medium px-2 py-0.5 rounded text-[11px] ${
                          willOverflow
                            ? "bg-amber-100 text-amber-800"
                            : isFull
                            ? "bg-muted text-muted-foreground"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {room.currentCount}
                        {room.capacity !== undefined ? `/${room.capacity}` : ""} מקומות
                        {willOverflow && !isCurrent ? " (חריגה)" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Roommates preview */}
                  <div className="text-[11px] text-muted-foreground truncate w-full">
                    {room.studentNames.length > 0 ? (
                      <span>
                        <strong className="font-medium text-foreground/80">בחדר: </strong>
                        {room.studentNames.join(", ")}
                      </span>
                    ) : (
                      <span className="italic opacity-60">החדר ריק כרגע</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 rounded-b-2xl flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors font-medium"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

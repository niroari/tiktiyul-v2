"use client";

import { useState, useMemo } from "react";
import type { Student } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PART_LABELS = ["חלק א׳", "חלק ב׳", "חלק ג׳", "חלק ד׳"];

interface SplitStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  dayLabel?: string;
  students: Student[]; // All active/going students in this class
  partsCount: number;  // 2, 3, or 4
  initialPartStudents: string[][]; // array of student IDs per part
  onSave: (newPartStudents: string[][]) => void;
}

export function SplitStudentsDialog({
  open,
  onOpenChange,
  className,
  dayLabel,
  students,
  partsCount,
  initialPartStudents,
  onSave,
}: SplitStudentsDialogProps) {
  // Normalize initial assignments
  const [assignments, setAssignments] = useState<string[][]>(() => {
    const res: string[][] = [];
    for (let i = 0; i < partsCount; i++) {
      res.push(initialPartStudents[i] ? [...initialPartStudents[i]] : []);
    }
    return res;
  });

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | number | "unassigned">("all");

  // Reset internal state when dialog opens or initialPartStudents changes
  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    const res: string[][] = [];
    for (let i = 0; i < partsCount; i++) {
      res.push(initialPartStudents[i] ? [...initialPartStudents[i]] : []);
    }
    setAssignments(res);
    setSearch("");
    setActiveTab("all");
    setPrevOpen(true);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  // Map each student ID to their assigned part index (-1 if unassigned)
  const studentPartMap = useMemo(() => {
    const map = new Map<string, number>();
    assignments.forEach((ids, pi) => {
      ids.forEach((id) => map.set(id, pi));
    });
    return map;
  }, [assignments]);

  // Sort students alphabetically (Hebrew: last name, first name)
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const l = (a.lastName || "").localeCompare(b.lastName || "", "he");
      if (l !== 0) return l;
      return (a.firstName || "").localeCompare(b.firstName || "", "he");
    });
  }, [students]);

  // Filtered by search & active tab
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedStudents.filter((s) => {
      const fullName = `${s.firstName || ""} ${s.lastName || ""}`.toLowerCase();
      if (q && !fullName.includes(q)) return false;

      const part = studentPartMap.get(s.id) ?? -1;
      if (activeTab === "all") return true;
      if (activeTab === "unassigned") return part === -1;
      return part === activeTab;
    });
  }, [sortedStudents, search, activeTab, studentPartMap]);

  // Assign or reassign a student
  function assignStudent(studentId: string, targetPart: number | -1) {
    setAssignments((prev) => {
      const next = prev.map((list) => list.filter((id) => id !== studentId));
      if (targetPart >= 0 && targetPart < partsCount) {
        next[targetPart].push(studentId);
      }
      return next;
    });
  }

  // Quick 50/50 or equal split alphabetically
  function splitEvenlyAlphabetical() {
    const total = sortedStudents.length;
    if (total === 0) return;

    const chunkSize = Math.ceil(total / partsCount);
    const next: string[][] = Array.from({ length: partsCount }, () => []);

    sortedStudents.forEach((s, idx) => {
      const partIdx = Math.min(Math.floor(idx / chunkSize), partsCount - 1);
      next[partIdx].push(s.id);
    });

    setAssignments(next);
  }

  // Clear all
  function clearAll() {
    setAssignments(Array.from({ length: partsCount }, () => []));
  }

  function handleSave() {
    onSave(assignments);
    onOpenChange(false);
  }

  const unassignedCount = students.filter((s) => !studentPartMap.has(s.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:max-w-2xl" dir="rtl">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                פיצול תלמידי כיתה {className}{dayLabel ? ` — ${dayLabel}` : ""}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                שיוך שמות התלמידים לפי חלקי הכיתה (הכמויות יתעדכנו אוטומטית בטבלת השליטה)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={splitEvenlyAlphabetical}
                className="text-xs h-8 text-primary hover:text-primary hover:bg-primary/5"
                title="מחלק את התלמידים שווה בשווה לפי סדר הא״ב"
              >
                חלוקה שווה לפי א-ב
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs h-8 text-muted-foreground hover:text-destructive"
              >
                איפוס
              </Button>
            </div>
          </div>

          {/* Parts Counter Summary Pills */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                activeTab === "all"
                  ? "bg-foreground text-background font-medium border-transparent"
                  : "bg-white text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              הכל ({students.length})
            </button>
            {assignments.map((ids, pi) => (
              <button
                key={pi}
                type="button"
                onClick={() => setActiveTab(pi)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  activeTab === pi
                    ? "bg-primary text-white font-medium border-primary"
                    : "bg-white text-foreground border-border hover:border-primary/50"
                }`}
              >
                {PART_LABELS[pi]}: <strong>{ids.length}</strong>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveTab("unassigned")}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                activeTab === "unassigned"
                  ? "bg-amber-600 text-white font-medium border-amber-600"
                  : unassignedCount > 0
                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  : "bg-white text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              לא שובצו ({unassignedCount})
            </button>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 py-2.5 border-b border-border bg-white shrink-0">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש תלמיד לפי שם..."
            className="text-xs h-8 bg-muted/30 focus-visible:bg-white"
          />
        </div>

        {/* Student list */}
        <div className="p-4 overflow-y-auto flex-1 space-y-1.5 min-h-[260px] max-h-[460px]">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs">
              {search ? "לא נמצאו תלמידים התואמים לחיפוש" : "אין תלמידים בקטגוריה זו"}
            </div>
          ) : (
            filteredStudents.map((s) => {
              const currentPart = studentPartMap.get(s.id) ?? -1;

              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-[var(--radius-sm)] border border-border bg-white hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">
                      {s.firstName} {s.lastName}
                    </span>
                    {s.gender && (
                      <span className="text-[10px] text-muted-foreground/70 shrink-0">
                        {s.gender === "male" ? "👦" : "👧"}
                      </span>
                    )}
                  </div>

                  {/* Part selection segmented buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: partsCount }, (_, pi) => {
                      const isSelected = currentPart === pi;
                      return (
                        <button
                          key={pi}
                          type="button"
                          onClick={() => assignStudent(s.id, isSelected ? -1 : pi)}
                          className={`text-xs px-2.5 py-1 rounded-[var(--radius-sm)] transition-all ${
                            isSelected
                              ? "bg-[#1b4332] text-white font-medium shadow-xs"
                              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {PART_LABELS[pi]}
                        </button>
                      );
                    })}
                    {currentPart !== -1 && (
                      <button
                        type="button"
                        onClick={() => assignStudent(s.id, -1)}
                        className="text-xs text-muted-foreground hover:text-destructive px-1.5 py-1 rounded hover:bg-destructive/10 transition-colors"
                        title="הסר שיבוץ"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border bg-muted/10 shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            משובצים: {students.length - unassignedCount} מתוך {students.length} תלמידים
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              ביטול
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="text-xs bg-[#1b4332] hover:bg-[#1b4332]/90 text-white"
            >
              שמור שיבוץ
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

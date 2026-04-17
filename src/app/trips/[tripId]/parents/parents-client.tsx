"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useParents } from "@/hooks/use-parents";
import { useStudents } from "@/hooks/use-students";
import { addParent, updateParent, deleteParent } from "@/lib/firestore/parents";
import { Parent } from "@/lib/types";
import type { Gender } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type FormData = { name: string; phone: string; gender: Gender | ""; childName: string; childClass: string };
const EMPTY: FormData = { name: "", phone: "", gender: "", childName: "", childClass: "" };

export function ParentsClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { parents, loading } = useParents(tripId);
  const { students } = useStudents(tripId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Parent | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [childSuggestOpen, setChildSuggestOpen] = useState(false);

  // Build student suggestions from going students
  const goingStudents = students.filter((s) => s.isGoing);
  const childSuggestions = goingStudents.filter((s) => {
    const q = form.childName.trim().toLowerCase();
    if (!q) return true;
    const full = `${s.firstName} ${s.lastName}`.toLowerCase();
    const fullRev = `${s.lastName} ${s.firstName}`.toLowerCase();
    return full.includes(q) || fullRev.includes(q);
  });

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(parent: Parent) {
    setEditing(parent);
    setForm({ name: parent.name, phone: parent.phone, gender: parent.gender ?? "", childName: parent.childName, childClass: parent.childClass });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = { ...form, gender: form.gender || undefined };
      if (editing) {
        await updateParent(tripId, editing.id, data);
      } else {
        await addParent(tripId, data);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(parent: Parent) {
    if (!confirm(`למחוק את ${parent.name}?`)) return;
    await deleteParent(tripId, parent.id);
  }

  function selectChild(firstName: string, lastName: string, cls: string) {
    setForm({ ...form, childName: `${firstName} ${lastName}`, childClass: cls });
    setChildSuggestOpen(false);
  }

  // Group by class for display
  const byClass: Record<string, Parent[]> = {};
  for (const p of parents) {
    const key = p.childClass || "ללא כיתה";
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(p);
  }
  const sortedClasses = Object.keys(byClass).sort((a, b) => a.localeCompare(b, "he"));

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">הורים מלווים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {parents.length > 0 ? `${parents.length} הורים` : "אין הורים מלווים עדיין"}
          </p>
        </div>
        <Button onClick={openAdd}>
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          הוסף הורה מלווה
        </Button>
      </div>

      {/* List */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">טוען...</div>
        ) : parents.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-muted-foreground text-sm mb-3">אין הורים מלווים עדיין</p>
            <Button variant="outline" onClick={openAdd}>הוסף הורה ראשון</Button>
          </div>
        ) : (
          <div>
            {sortedClasses.map((cls, i) => (
              <div key={cls}>
                {/* Class header */}
                <div className={`px-5 py-2 bg-muted/40 border-b border-border ${i > 0 ? "border-t" : ""}`}>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    כיתה {cls}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {byClass[cls].map((parent) => (
                    <li key={parent.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-[var(--brand-light)] text-primary font-semibold text-sm flex items-center justify-center flex-shrink-0">
                        {parent.name.charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground text-sm">{parent.name}</p>
                          {parent.gender && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0
                              ${parent.gender === "male" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"}`}>
                              {parent.gender === "male" ? "אב" : "אם"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          הורה של{" "}
                          <span className="font-medium text-foreground">{parent.childName}</span>
                          {parent.childClass && ` · כיתה ${parent.childClass}`}
                        </p>
                      </div>

                      {/* Phone */}
                      <a
                        href={`tel:${parent.phone}`}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors hidden sm:block flex-shrink-0"
                      >
                        {parent.phone || "—"}
                      </a>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(parent)}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(parent)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "עריכת הורה מלווה" : "הוספת הורה מלווה"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>שם ההורה</Label>
              <Input
                placeholder="ישראל ישראלי"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>טלפון</Label>
              <Input
                placeholder="050-0000000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                type="tel"
              />
            </div>

            <div className="space-y-1.5">
              <Label>מגדר</Label>
              <div className="flex gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm({ ...form, gender: form.gender === g ? "" : g })}
                    className={`flex-1 py-2 text-sm rounded-[var(--radius-sm)] border transition-colors
                      ${form.gender === g
                        ? g === "male"
                          ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                          : "bg-pink-50 border-pink-300 text-pink-700 font-medium"
                        : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    {g === "male" ? "אב" : "אם"}
                  </button>
                ))}
              </div>
            </div>

            {/* Child name with autocomplete from students */}
            <div className="space-y-1.5 relative">
              <Label>ילד/ה מלווה</Label>
              <Input
                placeholder="שם התלמיד/ה"
                value={form.childName}
                onChange={(e) => {
                  setForm({ ...form, childName: e.target.value, childClass: "" });
                  setChildSuggestOpen(true);
                }}
                onFocus={() => setChildSuggestOpen(true)}
                onBlur={() => setTimeout(() => setChildSuggestOpen(false), 150)}
              />
              {childSuggestOpen && goingStudents.length > 0 && childSuggestions.length > 0 && (
                <ul className="absolute z-10 right-0 left-0 top-full mt-1 bg-white border border-border rounded-[var(--radius-sm)] shadow-[var(--shadow-dropdown)] overflow-hidden max-h-44 overflow-y-auto">
                  {childSuggestions.slice(0, 10).map((s) => (
                    <li
                      key={s.id}
                      onMouseDown={() => selectChild(s.firstName, s.lastName, s.class)}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors flex items-center justify-between"
                    >
                      <span>{s.firstName} {s.lastName}</span>
                      <span className="text-xs text-muted-foreground">{s.class}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>כיתה</Label>
              <Input
                placeholder="ז׳1"
                value={form.childClass}
                onChange={(e) => setForm({ ...form, childClass: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.childName.trim()}>
              {saving ? "שומר..." : editing ? "עדכן" : "הוסף"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

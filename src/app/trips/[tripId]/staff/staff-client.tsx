"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useStaff } from "@/hooks/use-staff";
import { addStaffMember, updateStaffMember, deleteStaffMember } from "@/lib/firestore/staff";
import { StaffMember } from "@/lib/types";
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

const ROLE_SUGGESTIONS = [
  "מנהל טיול",
  "רכז טיול",
  "מחנך",
  "מורה מלווה",
  "אחות",
  "נהג",
  "מדריך",
];

import type { Gender } from "@/lib/types";

type FormData = { name: string; role: string; phone: string; gender: Gender | "" };
const EMPTY: FormData = { name: "", role: "", phone: "", gender: "" };

export function StaffClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { staff, loading } = useStaff(tripId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(member: StaffMember) {
    setEditing(member);
    setForm({ name: member.name, role: member.role, phone: member.phone, gender: member.gender ?? "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = { ...form, gender: form.gender || undefined };
      if (editing) {
        await updateStaffMember(tripId, editing.id, data);
      } else {
        await addStaffMember(tripId, data);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: StaffMember) {
    if (!confirm(`למחוק את ${member.name}?`)) return;
    await deleteStaffMember(tripId, member.id);
  }

  const filteredSuggestions = ROLE_SUGGESTIONS.filter(
    (r) => r.includes(form.role) && r !== form.role
  );

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">צוות הטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {staff.length} אנשי צוות
          </p>
        </div>
        <Button onClick={openAdd}>
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          הוסף איש צוות
        </Button>
      </div>

      {/* Staff list */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">טוען...</div>
        ) : staff.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-muted-foreground text-sm mb-3">אין אנשי צוות עדיין</p>
            <Button variant="outline" onClick={openAdd}>הוסף איש צוות ראשון</Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {staff.map((member) => (
              <li key={member.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-[var(--brand-light)] text-primary font-semibold text-sm flex items-center justify-center flex-shrink-0">
                  {member.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{member.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                    {member.gender && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                        ${member.gender === "male" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"}`}>
                        {member.gender === "male" ? "זכר" : "נקבה"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Phone */}
                <a
                  href={`tel:${member.phone}`}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors hidden sm:block"
                >
                  {member.phone || "—"}
                </a>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(member)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(member)}
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
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "עריכת איש צוות" : "הוספת איש צוות"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>שם מלא</Label>
              <Input
                placeholder="ישראל ישראלי"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-1.5 relative">
              <Label>תפקיד</Label>
              <Input
                placeholder="מנהל טיול, מחנך..."
                value={form.role}
                onChange={(e) => { setForm({ ...form, role: e.target.value }); setRoleOpen(true); }}
                onFocus={() => setRoleOpen(true)}
                onBlur={() => setTimeout(() => setRoleOpen(false), 150)}
              />
              {roleOpen && filteredSuggestions.length > 0 && (
                <ul className="absolute z-10 right-0 left-0 top-full mt-1 bg-white border border-border rounded-[var(--radius-sm)] shadow-[var(--shadow-dropdown)] overflow-hidden">
                  {filteredSuggestions.map((r) => (
                    <li
                      key={r}
                      onMouseDown={() => { setForm({ ...form, role: r }); setRoleOpen(false); }}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              )}
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
                    {g === "male" ? "זכר" : "נקבה"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "שומר..." : editing ? "עדכן" : "הוסף"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

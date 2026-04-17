"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useParents } from "@/hooks/use-parents";
import { useStudents } from "@/hooks/use-students";
import { useTrip } from "@/hooks/use-trip";
import { addParent, updateParent, deleteParent } from "@/lib/firestore/parents";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { Parent, Trip } from "@/lib/types";
import type { Gender } from "@/lib/types";
import { RemoteSignature } from "@/components/remote-signature";
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

// ─── Volunteer form HTML generator ───────────────────────────────────────────

function formatDateHe(iso: string | undefined) {
  if (!iso) return "____";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}

function daysBetween(start: string | undefined, end: string | undefined): number {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

type ReferrerConfig = { date: string; referrerName: string; referrerRole: string };

function getVolunteerFormHTML(parent: Parent, trip: Trip | null, idNumber?: string, address?: string, signature?: string, referrer?: ReferrerConfig): string {
  const name      = parent.name || "___";
  const phone     = parent.phone || "___";
  const tripName  = trip?.name || "___";
  const school    = trip?.schoolName || "___";
  const startDate = formatDateHe(trip?.startDate);
  const endDate   = formatDateHe(trip?.endDate);
  const days      = trip?.startDate && trip?.endDate ? daysBetween(trip.startDate, trip.endDate) : "__";

  const idDigits = idNumber
    ? idNumber.padStart(9, " ").split("")
    : Array(9).fill(" ");
  // Wrap in dir="ltr" so boxes flow left-to-right even inside the RTL document
  const idBoxes = `<span dir="ltr" style="display:inline-block;">${
    idDigits.map((d) =>
      `<span style="display:inline-block;width:22px;height:22px;border:1px solid #000;margin-right:2px;text-align:center;line-height:22px;font-weight:bold;">${d.trim() || "&nbsp;"}</span>`
    ).join("")
  }</span>`;

  return `
<div dir="rtl" style="font-family: 'David', 'Arial', sans-serif; max-width: 700px; margin: 0 auto; padding: 32px; font-size: 14px; line-height: 1.8; color: #000;">
  <div style="text-align: center; margin-bottom: 24px;">
    <p style="font-weight: bold;">נספח ט'</p>
    <p style="font-weight: bold; font-size: 16px; text-decoration: underline;">טופס ביטוח למתנדב</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
    <tr>
      <td style="padding: 4px 0; width: 60%;">
        <span>הרינו לאשר בזה כי המתנדב/ת </span>
        <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 200px; font-weight: bold;">&nbsp;${name}&nbsp;</span>
      </td>
    </tr>
  </table>

  <div style="margin-bottom: 12px;">
    <span>מס' ת.ז &nbsp;</span>
    ${idBoxes}
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
    <tr>
      <td style="padding: 4px 0; width: 50%;">
        <span>כתובת </span>
        <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 180px; font-weight: ${address ? "bold" : "normal"};">&nbsp;${address || ""}&nbsp;</span>
      </td>
      <td style="padding: 4px 0;">
        <span>מס' טלפון </span>
        <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 120px; font-weight: bold;">&nbsp;${phone}&nbsp;</span>
      </td>
    </tr>
  </table>

  <div style="margin-bottom: 8px;">
    <span>התנדב לעבוד בתפקיד </span>
    <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 300px;">&nbsp;הורה מלווה&nbsp;</span>
  </div>

  <div style="margin-bottom: 8px;">
    <span>למען </span>
    <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 380px;">&nbsp;${tripName} — ${school}&nbsp;</span>
  </div>

  <p style="font-size: 12px; color: #444; margin-bottom: 16px;">
    (יש לציין את זהות הגוף או האדם שהפעולה נשנית למענו וכן את מקום הפעולה)
  </p>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <tr>
      <td style="padding: 4px 0; width: 33%;">
        <span>מתאריך </span>
        <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 90px;">&nbsp;${startDate}&nbsp;</span>
      </td>
      <td style="padding: 4px 0; width: 33%;">
        <span>עד תאריך </span>
        <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 90px;">&nbsp;${endDate}&nbsp;</span>
      </td>
      <td style="padding: 4px 0;">
        <span>לתקופה של </span>
        <span style="border-bottom: 1px solid #000; display: inline-block; min-width: 40px;">&nbsp;${days}&nbsp;</span>
        <span> ימים</span>
      </td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 32px;">
    <thead>
      <tr style="background: #f5f5f5;">
        <th style="border: 1px solid #000; padding: 6px; text-align: right;">תאריך</th>
        <th style="border: 1px solid #000; padding: 6px; text-align: right;">שם נותן ההפניה</th>
        <th style="border: 1px solid #000; padding: 6px; text-align: right;">תפקידו</th>
        <th style="border: 1px solid #000; padding: 6px; text-align: right;">חותמת ביה"ס וחתימה</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #000; padding: 8px 6px; vertical-align: top;">${referrer?.date || "&nbsp;"}</td>
        <td style="border: 1px solid #000; padding: 8px 6px; vertical-align: top; font-weight: bold;">${referrer?.referrerName || "&nbsp;"}</td>
        <td style="border: 1px solid #000; padding: 8px 6px; vertical-align: top;">${referrer?.referrerRole || "&nbsp;"}</td>
        <td style="border: 1px solid #000; padding: 24px 6px;">&nbsp;</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-bottom: 24px; text-align: left;">
    <p style="font-weight: bold; text-align: right; margin-bottom: 16px;">אישור המתנדב לקבלת התפקיד</p>
    <table style="width: 60%; margin-right: auto; border-collapse: collapse;">
      <tr>
        <td style="padding: 0 16px 0 16px; text-align: center; width: 50%;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="height: 44px; vertical-align: bottom; text-align: center; padding-bottom: 4px; border-bottom: 1px solid #000;">
                <span style="font-weight: bold;">${name}</span>
              </td>
            </tr>
            <tr>
              <td style="text-align: center; padding-top: 4px; font-size: 12px;">שם</td>
            </tr>
          </table>
        </td>
        <td style="padding: 0 16px 0 16px; text-align: center; width: 50%;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="height: 72px; vertical-align: bottom; text-align: center; padding-bottom: 4px; border-bottom: 1px solid #000;">
                ${signature ? `<img src="${signature}" style="max-height:64px;max-width:180px;display:block;margin:0 auto;" />` : "&nbsp;"}
              </td>
            </tr>
            <tr>
              <td style="text-align: center; padding-top: 4px; font-size: 12px;">חתימה</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>

  <p style="font-size: 12px; color: #444;">העתק : תיק טיולים של ביה"ס.</p>
</div>`;
}

// ─── Form data ────────────────────────────────────────────────────────────────

type FormData = { name: string; phone: string; gender: Gender | ""; childName: string; childClass: string };
const EMPTY: FormData = { name: "", phone: "", gender: "", childName: "", childClass: "" };

// ─── Component ────────────────────────────────────────────────────────────────

export function ParentsClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { parents, loading } = useParents(tripId);
  const { students } = useStudents(tripId);
  const { trip } = useTrip(tripId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Parent | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [childSuggestOpen, setChildSuggestOpen] = useState(false);
  const [expandedSig, setExpandedSig] = useState<string | null>(null); // parentId

  // Referrer config (pre-fills the authorisation table on every form)
  const EMPTY_REF: ReferrerConfig = { date: "", referrerName: "", referrerRole: "" };
  const [referrer, setReferrer] = useState<ReferrerConfig>(EMPTY_REF);
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [refForm, setRefForm] = useState<ReferrerConfig>(EMPTY_REF);
  const [refSaving, setRefSaving] = useState(false);

  useEffect(() => {
    return subscribeToAppendix(tripId, "volunteer-config", (data) => {
      if (data) {
        setReferrer({
          date:         String(data.date ?? ""),
          referrerName: String(data.referrerName ?? ""),
          referrerRole: String(data.referrerRole ?? ""),
        });
      }
    });
  }, [tripId]);

  async function saveReferrer() {
    setRefSaving(true);
    try {
      await saveAppendix(tripId, "volunteer-config", refForm);
      setReferrer(refForm);
      setRefDialogOpen(false);
    } finally {
      setRefSaving(false);
    }
  }

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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">הורים מלווים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {parents.length > 0 ? `${parents.length} הורים` : "אין הורים מלווים עדיין"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRefForm(referrer); setRefDialogOpen(true); }}
            className="flex items-center gap-1.5 text-sm px-3 py-2 border border-border rounded-[var(--radius-sm)] text-muted-foreground hover:bg-muted transition-colors"
            title="הגדרת נותן ההפניה לטפסי ביטוח"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {referrer.referrerName
              ? <span>נותן הפניה: <strong>{referrer.referrerName}</strong></span>
              : <span className="text-amber-600">הגדר נותן הפניה ↗</span>
            }
          </button>
          <Button onClick={openAdd}>
            <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            הוסף הורה מלווה
          </Button>
        </div>
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
                    <li key={parent.id}>
                      {/* Main row */}
                      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors">
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

                        {/* Signature button */}
                        <button
                          onClick={() => setExpandedSig(expandedSig === parent.id ? null : parent.id)}
                          title="טופס ביטוח למתנדב"
                          className={`p-1.5 rounded transition-colors flex-shrink-0
                            ${expandedSig === parent.id
                              ? "text-primary bg-[var(--brand-light)]"
                              : "text-muted-foreground hover:text-primary"
                            }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>

                        {/* Edit / Delete */}
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
                      </div>

                      {/* Signature panel — expands inline */}
                      {expandedSig === parent.id && (
                        <div className="px-5 pb-4 pt-1 border-t border-border bg-muted/20">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">טופס ביטוח למתנדב — נספח ט׳</p>
                          <RemoteSignature
                            tripId={tripId}
                            role={`volunteer_${parent.id}`}
                            roleName="הורה מלווה"
                            tripName={trip?.name ?? ""}
                            schoolName={trip?.schoolName ?? ""}
                            leaderName={parent.name}
                            label=""
                            requiresId={true}
                            getPreviewHTML={() => getVolunteerFormHTML(parent, trip ?? null, undefined, undefined, undefined, referrer)}
                            getPrintHTML={(idNum, addr, sig) => getVolunteerFormHTML(parent, trip ?? null, idNum, addr, sig, referrer)}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referrer Config Dialog */}
      <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>נותן ההפניה לטפסי ביטוח</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>שם נותן ההפניה</Label>
              <Input
                placeholder="שם מלא"
                value={refForm.referrerName}
                onChange={(e) => setRefForm({ ...refForm, referrerName: e.target.value })}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>תפקידו</Label>
              <Input
                placeholder="מנהל/ת בית הספר"
                value={refForm.referrerRole}
                onChange={(e) => setRefForm({ ...refForm, referrerRole: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>תאריך</Label>
              <Input
                type="date"
                value={refForm.date}
                onChange={(e) => setRefForm({ ...refForm, date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRefDialogOpen(false)}>ביטול</Button>
            <Button onClick={saveReferrer} disabled={refSaving || !refForm.referrerName.trim()}>
              {refSaving ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useStudents } from "@/hooks/use-students";
import { useTrip } from "@/hooks/use-trip";
import { addStudent, updateStudent, deleteStudent, deleteAllStudents } from "@/lib/firestore/students";
import { createClassToken, listClassTokensForTrip } from "@/lib/firestore/class-tokens";
import { ExcelImport } from "@/components/excel-import";
import { Student, Gender, ClassToken } from "@/lib/types";

type DietaryFlags = Student["dietaryFlags"];
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StudentFormData = {
  firstName: string;
  lastName: string;
  class: string;
  gender: Gender;
  phone: string;
  isGoing: boolean;
  dietaryFlags: DietaryFlags;
};

const EMPTY_DIETARY: DietaryFlags = { vegetarian: false, vegan: false, glutenFree: false };

const EMPTY_FORM: StudentFormData = {
  firstName: "",
  lastName: "",
  class: "",
  gender: "female",
  phone: "",
  isGoing: true,
  dietaryFlags: EMPTY_DIETARY,
};

export function StudentsClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { students, loading } = useStudents(tripId);
  const { trip } = useTrip(tripId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [tokens, setTokens] = useState<ClassToken[]>([]);
  const [generatingClass, setGeneratingClass] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const going = students.filter((s) => s.isGoing).length;
  const notGoing = students.length - going;
  const classes = [...new Set(students.map((s) => s.class).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.class.toLowerCase().includes(q)
    );
  });

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(student: Student) {
    setEditing(student);
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      class: student.class,
      gender: student.gender,
      phone: student.phone ?? "",
      isGoing: student.isGoing,
      dietaryFlags: student.dietaryFlags ?? EMPTY_DIETARY,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data: Omit<Student, "id"> = { ...form };
      if (editing) {
        await updateStudent(tripId, editing.id, data);
      } else {
        await addStudent(tripId, data);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(student: Student) {
    if (!confirm(`למחוק את ${student.firstName} ${student.lastName}?`)) return;
    await deleteStudent(tripId, student.id);
  }

  async function toggleGoing(student: Student) {
    await updateStudent(tripId, student.id, { isGoing: !student.isGoing });
  }

  async function openShareDialog() {
    setShareDialogOpen(true);
    const existing = await listClassTokensForTrip(tripId);
    setTokens(existing);
  }

  async function generateToken(className: string) {
    setGeneratingClass(className);
    try {
      const token = await createClassToken(tripId, className, trip?.name ?? "", trip?.schoolName ?? "");
      setTokens((prev) => {
        const filtered = prev.filter((t) => t.class !== className);
        return [...filtered, { token, tripId, class: className, tripName: trip?.name ?? "", schoolName: trip?.schoolName ?? "", createdAt: null as any, expiresAt: null as any }];
      });
    } finally {
      setGeneratingClass(null);
    }
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/class-edit/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  function shareWhatsApp(token: string, className: string) {
    const url = `${window.location.origin}/class-edit/${token}`;
    const msg = `*תיק טיול — עדכון פרטי תלמידים*\nשלום, אנא עדכני את פרטי תלמידי כיתה ${className} לטיול "${trip?.name ?? ""}".\nלחץ/י על הקישור:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function handleClearAll() {
    setClearing(true);
    try {
      await deleteAllStudents(tripId);
      setClearDialogOpen(false);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">רשימת תלמידים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {students.length} תלמידים · {going} יוצאים · {notGoing} לא יוצאים
          </p>
        </div>
        <div className="flex gap-2">
          {students.length > 0 && (
            <Button variant="outline" onClick={openShareDialog}>
              <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              שתף לעדכון
            </Button>
          )}
          {students.length > 0 && (
            <Button variant="outline" onClick={() => setClearDialogOpen(true)} className="text-destructive hover:text-destructive">
              נקה נתונים
            </Button>
          )}
          <ExcelImport
            onImport={async (students) => {
              for (const s of students) {
                await addStudent(tripId, s);
              }
            }}
          />
          <Button onClick={openAdd}>
            <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            הוסף תלמיד
          </Button>
        </div>
      </div>

      {/* Excel format instructions */}
      <div className="mb-5 rounded-[var(--radius)] border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">פורמט קובץ Excel לייבוא</p>
        <p className="mb-2">הקובץ צריך לכלול שורת כותרות עם העמודות הבאות (סדר העמודות לא משנה):</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { name: "ת.ז", required: true },
            { name: "שם משפחה", required: true },
            { name: "שם פרטי", required: true },
            { name: "כיתה", required: true },
            { name: "מקבילה", required: true },
            { name: "מין", required: false },
            { name: "טלפון נייד", required: false },
          ].map(({ name, required }) => (
            <span
              key={name}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${
                required
                  ? "bg-white border-border text-foreground"
                  : "bg-white border-dashed border-border text-muted-foreground"
              }`}
            >
              {name}
              {!required && <span className="mr-1 text-[10px]">(אופציונלי)</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="חיפוש לפי שם או כיתה..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-sm mb-3">
              {search ? "לא נמצאו תלמידים" : "אין תלמידים עדיין"}
            </p>
            {!search && (
              <Button variant="outline" onClick={openAdd}>הוסף תלמיד ראשון</Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם משפחה</TableHead>
                <TableHead className="text-right">שם פרטי</TableHead>
                <TableHead className="text-right">כיתה</TableHead>
                <TableHead className="text-right">מגדר</TableHead>
                <TableHead className="text-right">טלפון</TableHead>
                <TableHead className="text-right">יוצא</TableHead>
                <TableHead className="text-right w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => (
                <TableRow key={student.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{student.lastName}</TableCell>
                  <TableCell>{student.firstName}</TableCell>
                  <TableCell>{student.class}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                      ${student.gender === "female"
                        ? "bg-pink-50 text-pink-700"
                        : "bg-blue-50 text-blue-700"
                      }`}>
                      {student.gender === "female" ? "בת" : "בן"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.phone || "—"}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleGoing(student)}
                      className={`w-8 h-5 rounded-full transition-colors relative ${
                        student.isGoing ? "bg-[var(--success)]" : "bg-border"
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                        student.isGoing ? "right-0.5" : "left-0.5"
                      }`} />
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(student)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(student)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Clear All Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>נקה רשימת תלמידים</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            פעולה זו תמחק את כל {students.length} התלמידים ברשימה. לא ניתן לבטל פעולה זו.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>ביטול</Button>
            <Button variant="destructive" onClick={handleClearAll} disabled={clearing}>
              {clearing ? "מוחק..." : "מחק הכל"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share for teacher update dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>שתף קישור עדכון לכיתה</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            שלח/י לכל מחנך/ת קישור ייחודי — היא תוכל לעדכן יציאה, תזונה והערות רפואיות. השינויים יועברו אליך לאישור לפני עדכון המערכת.
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {classes.map((className) => {
              const existing = tokens.find((t) => t.class === className);
              const isGenerating = generatingClass === className;
              const editUrl = existing ? `${window.location.origin}/class-edit/${existing.token}` : null;
              return (
                <div key={className} className="flex items-center gap-2 border border-border rounded-[var(--radius-sm)] px-3 py-2">
                  <span className="text-sm font-medium w-14 flex-shrink-0">כיתה {className}</span>
                  {editUrl ? (
                    <>
                      <input
                        readOnly
                        value={editUrl}
                        dir="ltr"
                        className="flex-1 text-xs border border-border rounded px-2 py-1 bg-muted/30 focus:outline-none truncate"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        onClick={() => copyLink(existing!.token)}
                        className="text-xs px-2 py-1 border border-border rounded hover:bg-muted/50 transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        {copiedToken === existing!.token ? "הועתק ✓" : "העתק"}
                      </button>
                      <button
                        onClick={() => shareWhatsApp(existing!.token, className)}
                        className="text-green-600 hover:text-green-700 transition-colors flex-shrink-0"
                        title="שתף בוואטסאפ"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => generateToken(className)}
                      disabled={isGenerating}
                      className="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? "יוצר קישור..." : "צור קישור ↗"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "עריכת תלמיד" : "הוספת תלמיד"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>שם משפחה</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="כהן"
                />
              </div>
              <div className="space-y-1.5">
                <Label>שם פרטי</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="דניאל"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>כיתה</Label>
                <Input
                  value={form.class}
                  onChange={(e) => setForm({ ...form, class: e.target.value })}
                  placeholder="ט׳1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>מגדר</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => setForm({ ...form, gender: v as Gender })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">בת</SelectItem>
                    <SelectItem value="male">בן</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>טלפון (אופציונלי)</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="050-0000000"
                type="tel"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, isGoing: !form.isGoing })}
                className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                  form.isGoing ? "bg-[var(--success)]" : "bg-border"
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  form.isGoing ? "right-1" : "left-1"
                }`} />
              </button>
              <span className="text-sm text-foreground">
                {form.isGoing ? "יוצא לטיול" : "לא יוצא לטיול"}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label>העדפות מזון</Label>
              <div className="flex flex-wrap gap-2">
                {(["vegetarian", "vegan", "glutenFree"] as const).map((flag) => {
                  const labels = { vegetarian: "צמחוני", vegan: "טבעוני", glutenFree: "ללא גלוטן" };
                  const active = form.dietaryFlags[flag];
                  return (
                    <button
                      key={flag}
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        dietaryFlags: { ...form.dietaryFlags, [flag]: !active },
                      })}
                      className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {labels[flag]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleSave} disabled={saving || !form.firstName || !form.lastName}>
              {saving ? "שומר..." : editing ? "עדכן" : "הוסף"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

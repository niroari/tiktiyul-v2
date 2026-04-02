"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useStudents } from "@/hooks/use-students";
import { addStudent, updateStudent, deleteStudent } from "@/lib/firestore/students";
import { ExcelImport } from "@/components/excel-import";
import { Student, Gender } from "@/lib/types";
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
};

const EMPTY_FORM: StudentFormData = {
  firstName: "",
  lastName: "",
  class: "",
  gender: "female",
  phone: "",
  isGoing: true,
};

export function StudentsClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { students, loading } = useStudents(tripId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const going = students.filter((s) => s.isGoing).length;
  const notGoing = students.length - going;

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
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data: Omit<Student, "id"> = {
        ...form,
        dietaryFlags: editing?.dietaryFlags ?? {
          vegetarian: false,
          vegan: false,
          glutenFree: false,
        },
      };
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

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TripClass } from "@/lib/types";
import { saveTripMetadata } from "@/lib/firestore/trips";
import { useTrip } from "@/hooks/use-trip";

type FormData = {
  name: string;
  schoolName: string;
  startDate: string;
  endDate: string;
  classes: TripClass[];
  accommodation: string;
  transport: string;
};

const INITIAL: FormData = {
  name: "",
  schoolName: "",
  startDate: "",
  endDate: "",
  classes: [{ name: "", studentCount: 0 }],
  accommodation: "",
  transport: "",
};

export function TripMetadataForm() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip } = useTrip(tripId);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [seeded, setSeeded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed form from Firestore once on first load
  useEffect(() => {
    if (!trip || seeded) return;
    setForm({
      name:          trip.name ?? "",
      schoolName:    trip.schoolName ?? "",
      startDate:     trip.startDate ?? "",
      endDate:       trip.endDate ?? "",
      classes:       trip.classes?.length ? trip.classes : [{ name: "", studentCount: 0 }],
      accommodation: trip.accommodation ?? "",
      transport:     trip.transport ?? "",
    });
    setSeeded(true);
  }, [trip, seeded]);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function setClass(index: number, field: keyof TripClass, value: string | number) {
    const updated = form.classes.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    );
    setField("classes", updated);
  }

  function addClass() {
    setField("classes", [...form.classes, { name: "", studentCount: 0 }]);
  }

  function removeClass(index: number) {
    setField("classes", form.classes.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveTripMetadata(tripId, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError("שמירה נכשלה — נסה שוב");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-6 space-y-6">

      {/* Basic info */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">פרטים בסיסיים</h2>

        <div className="space-y-1.5">
          <Label htmlFor="name">שם הטיול</Label>
          <Input
            id="name"
            placeholder="לדוגמה: טיול שנתי — כיתות ט׳"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="school">שם בית הספר</Label>
          <Input
            id="school"
            placeholder="לדוגמה: בי״ס בן גוריון, הרצליה"
            value={form.schoolName}
            onChange={(e) => setField("schoolName", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">תאריך יציאה</Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => setField("startDate", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">תאריך חזרה</Label>
            <Input
              id="endDate"
              type="date"
              value={form.endDate}
              onChange={(e) => setField("endDate", e.target.value)}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Classes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">כיתות</h2>
          <Button type="button" variant="ghost" size="sm" onClick={addClass} className="text-primary">
            <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            הוסף כיתה
          </Button>
        </div>

        <div className="space-y-2">
          {form.classes.map((cls, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="שם הכיתה — לדוגמה: ט׳1"
                value={cls.name}
                onChange={(e) => setClass(i, "name", e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                placeholder="מספר תלמידים"
                value={cls.studentCount || ""}
                onChange={(e) => setClass(i, "studentCount", Number(e.target.value))}
                className="w-36 text-center"
              />
              <button
                type="button"
                onClick={() => removeClass(i)}
                disabled={form.classes.length === 1}
                className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Logistics */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">לוגיסטיקה</h2>

        <div className="space-y-1.5">
          <Label htmlFor="accommodation">לינה</Label>
          <Input
            id="accommodation"
            placeholder="לדוגמה: אכסניית נוער, מלון, שטח"
            value={form.accommodation}
            onChange={(e) => setField("accommodation", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="transport">תחבורה</Label>
          <Input
            id="transport"
            placeholder="לדוגמה: אוטובוסים, רכב פרטי"
            value={form.transport}
            onChange={(e) => setField("transport", e.target.value)}
          />
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center justify-between pt-2">
        <Button onClick={handleSave} disabled={saving} className="min-w-24">
          {saving ? "שומר..." : saved ? (
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              נשמר
            </span>
          ) : "שמור"}
        </Button>
        {saved && <p className="text-sm text-muted-foreground">השינויים נשמרו בהצלחה</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

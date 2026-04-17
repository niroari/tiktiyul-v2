"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getClassToken } from "@/lib/firestore/class-tokens";
import { getStudents } from "@/lib/firestore/students";
import { submitPendingUpdate } from "@/lib/firestore/pending-updates";
import type { ClassToken, Student } from "@/lib/types";

type DraftStudent = {
  student: Student;
  isGoing: boolean;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  medicalNotes: string;
  dirty: boolean;
};

function Shell({ tokenDoc, children }: { tokenDoc: ClassToken | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6faf8] px-4 py-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center space-y-1">
          <div className="text-xs text-muted-foreground">משרד החינוך — מינהל חברה ונוער</div>
          <h1 className="text-xl font-bold text-[#1b4332]">עדכון פרטי תלמידים</h1>
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

export function ClassEditClient() {
  const { token } = useParams<{ token: string }>();

  const [tokenDoc, setTokenDoc]   = useState<ClassToken | null>(null);
  const [drafts, setDrafts]       = useState<DraftStudent[]>([]);
  const [state, setState]         = useState<"loading" | "ready" | "invalid" | "expired" | "submitting" | "done">("loading");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const doc = await getClassToken(token);
        if (!doc) { setState("invalid"); return; }
        const expired = doc.expiresAt?.toDate() < new Date();
        if (expired) { setState("expired"); return; }
        setTokenDoc(doc);

        const students = await getStudents(doc.tripId);
        const classStudents = students
          .filter((s) => s.class === doc.class)
          .sort((a, b) => a.lastName.localeCompare(b.lastName, "he"));
        setDrafts(classStudents.map((s) => ({
          student: s,
          isGoing: s.isGoing,
          vegetarian: s.dietaryFlags?.vegetarian ?? false,
          vegan: s.dietaryFlags?.vegan ?? false,
          glutenFree: s.dietaryFlags?.glutenFree ?? false,
          medicalNotes: s.medicalNotes ?? "",
          dirty: false,
        })));
        setState("ready");
      } catch (e) {
        console.error("class-edit load error:", e);
        setState("invalid");
      }
    }
    load();
  }, [token]);

  function update<K extends keyof DraftStudent>(studentId: string, field: K, value: DraftStudent[K]) {
    setDrafts((prev) =>
      prev.map((d) =>
        d.student.id === studentId ? { ...d, [field]: value, dirty: true } : d
      )
    );
  }

  async function handleSubmit() {
    const changed = drafts.filter((d) => d.dirty);
    if (changed.length === 0) return;
    setState("submitting");
    setSubmitError("");
    try {
      await Promise.all(
        changed.map((d) =>
          submitPendingUpdate(tokenDoc!.tripId, {
            tripId: tokenDoc!.tripId,
            token,
            studentId: d.student.id,
            studentFirstName: d.student.firstName,
            studentLastName: d.student.lastName,
            studentClass: d.student.class,
            proposedIsGoing: d.isGoing,
            proposedDietaryFlags: { vegetarian: d.vegetarian, vegan: d.vegan, glutenFree: d.glutenFree },
            proposedMedicalNotes: d.medicalNotes,
          })
        )
      );
      setState("done");
    } catch {
      setSubmitError("שגיאה בשליחה. נסה/י שוב.");
      setState("ready");
    }
  }

  // ── States ─────────────────────────────────────────────────────────────────

  if (state === "loading") return <Shell tokenDoc={null}><div className="text-center py-16 text-muted-foreground text-sm">טוען...</div></Shell>;

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
        <p className="text-lg font-bold text-green-700">הפרטים נשלחו לאישור</p>
        <p className="text-sm text-muted-foreground">אחראי/ת הטיול יאשר/תאשר את השינויים.</p>
      </div>
    </Shell>
  );

  const dirtyCount = drafts.filter((d) => d.dirty).length;

  return (
    <Shell tokenDoc={tokenDoc}>
      {/* Save reminder — prominent */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex gap-3 items-start">
        <span className="text-2xl flex-shrink-0">⚠️</span>
        <div>
          <p className="font-bold text-amber-800 text-sm">חשוב — אל תשכחי ללחוץ על כפתור השליחה!</p>
          <p className="text-amber-700 text-sm mt-0.5">
            לאחר עדכון הפרטים, יש לגלול למטה וללחוץ על{" "}
            <span className="font-bold">״שלח עדכונים לאישור״</span>{" "}
            — רק אז השינויים יישמרו.
          </p>
        </div>
      </div>

      <div className="bg-white/60 rounded-xl border border-border p-4 text-sm text-muted-foreground">
        שינויים יועברו לאישור אחראי/ת הטיול לפני שיעודכנו במערכת.
      </div>

      <div className="space-y-3">
        {drafts.map((d) => (
          <div
            key={d.student.id}
            className={`bg-white rounded-xl border p-4 space-y-4 transition-colors ${d.dirty ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}
          >
            {/* Name + going toggle */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{d.student.lastName} {d.student.firstName}</p>
                <p className="text-xs text-muted-foreground">{d.student.class}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm text-muted-foreground">יוצא/ת לטיול</span>
                <button
                  onClick={() => update(d.student.id, "isGoing", !d.isGoing)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${d.isGoing ? "bg-[#1b4332]" : "bg-border"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${d.isGoing ? "right-1" : "left-1"}`} />
                </button>
              </div>
            </div>

            {/* Dietary flags */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">העדפות מזון</p>
              <div className="flex flex-wrap gap-2">
                {(["vegetarian", "vegan", "glutenFree"] as const).map((flag) => {
                  const labels = { vegetarian: "צמחוני", vegan: "טבעוני", glutenFree: "ללא גלוטן" };
                  const active = d[flag];
                  return (
                    <button
                      key={flag}
                      onClick={() => update(d.student.id, flag, !active)}
                      className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                        active ? "bg-[#1b4332] text-white border-[#1b4332]" : "border-border text-muted-foreground"
                      }`}
                    >
                      {labels[flag]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Medical notes */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">הערות רפואיות</p>
              <textarea
                value={d.medicalNotes}
                onChange={(e) => update(d.student.id, "medicalNotes", e.target.value)}
                placeholder="אלרגיות, תרופות, מגבלות..."
                rows={2}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
        ))}
      </div>

      {drafts.length === 0 && (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
          לא נמצאו תלמידים בכיתה זו.
        </div>
      )}

      {submitError && <p className="text-sm text-destructive text-center">{submitError}</p>}

      <button
        onClick={handleSubmit}
        disabled={state === "submitting" || dirtyCount === 0}
        className="w-full py-3.5 text-sm font-medium bg-[#1b4332] text-white rounded-xl hover:bg-[#1b4332]/90 transition-colors disabled:opacity-50"
      >
        {state === "submitting"
          ? "שולח..."
          : dirtyCount > 0
            ? `שלח ${dirtyCount} עדכונים לאישור`
            : "לא בוצעו שינויים"}
      </button>
    </Shell>
  );
}

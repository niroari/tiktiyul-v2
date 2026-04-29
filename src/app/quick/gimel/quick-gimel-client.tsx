"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  saveQuickForm,
  subscribeToQuickForm,
  saveNamedForm,
  updateNamedForm,
  subscribeToNamedForm,
} from "@/lib/firestore/quick-forms";
import { sigDocId, subscribeToSignature } from "@/lib/firestore/signatures";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppendixActions, esc, safeSigUrl } from "@/components/appendix-actions";
import { RemoteSignature } from "@/components/remote-signature";

type FormData = {
  date: string;
  leaderName: string;
  principalName: string;
  area: string;
  schoolName: string;
  classes: string;
  tripDateFrom: string;
  tripDateTo: string;
};

const INITIAL: FormData = {
  date: "", leaderName: "", principalName: "", area: "",
  schoolName: "", classes: "", tripDateFrom: "", tripDateTo: "",
};

function formatDateHe(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

function todayLabel() {
  return new Date().toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}

export function QuickGimelClient({ savedId }: { savedId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const isDraft = !savedId;
  const syntheticTripId = uid ? `q_${uid}` : "";

  const [form, setForm] = useState<FormData>(INITIAL);
  const [formName, setFormName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [principalSig, setPrincipalSig] = useState<string | null>(null);

  // Save-as dialog state
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [saveAsPending, setSaveAsPending] = useState(false);

  useEffect(() => {
    if (!syntheticTripId) return;
    return subscribeToSignature(sigDocId(syntheticTripId, "c_principal"), (doc) => {
      setPrincipalSig(doc?.status === "signed" ? (doc.signature ?? null) : null);
    });
  }, [syntheticTripId]);

  useEffect(() => {
    if (!uid) return;
    const handler = (raw: Record<string, unknown> | null) => {
      if (raw) {
        setForm({
          date:          String(raw.date ?? ""),
          leaderName:    String(raw.leaderName ?? ""),
          principalName: String(raw.principalName ?? ""),
          area:          String(raw.area ?? ""),
          schoolName:    String(raw.schoolName ?? ""),
          classes:       String(raw.classes ?? ""),
          tripDateFrom:  String(raw.tripDateFrom ?? ""),
          tripDateTo:    String(raw.tripDateTo ?? ""),
        });
        if (raw.name) setFormName(String(raw.name));
      }
    };
    const unsub = isDraft
      ? subscribeToQuickForm(uid, "gimel", handler)
      : subscribeToNamedForm(savedId!, handler);
    return () => unsub();
  }, [uid, isDraft, savedId]);

  function setField(key: keyof FormData, value: string) {
    const updated = { ...form, [key]: value };
    setForm(updated);
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (isDraft) {
        await saveQuickForm(uid, "gimel", updated as unknown as Record<string, unknown>);
      } else {
        await updateNamedForm(savedId!, { ...(updated as unknown as Record<string, unknown>), uid, type: "gimel" });
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function getHTML() {
    const dr = form.tripDateFrom && form.tripDateTo
      ? `${formatDateHe(form.tripDateFrom)} עד ${formatDateHe(form.tripDateTo)}`
      : form.tripDateFrom ? formatDateHe(form.tripDateFrom) : "—";
    return `
      <div class="header">
        <div class="title">נספח ג׳ — כתב מינוי לאחראי/ת טיול</div>
        <div class="ministry">בחתימת מנהל/ת ביה"ס</div>
      </div>
      <div class="meta"><span>תאריך: <strong>${form.date ? formatDateHe(form.date) : ""}</strong></span></div>
      <div class="letter-body">
        <p>אל: <strong>${esc(form.leaderName)}</strong></p>
        <br/>
        <p>הריני ממנה אותך לאחראי/ת טיול לתלמידי כית/ות <strong>${esc(form.classes)}</strong>
        שיתקיים בתאריכים <strong>${esc(dr)}</strong>
        במקום/באזור <strong>${esc(form.area)}</strong>.</p>
        <br/>
        <p>בכבוד רב,</p>
        <p><strong>${esc(form.principalName)}</strong></p>
        <p>מנהל/ת ביה"ס — ${esc(form.schoolName)}</p>
        <br/>
        <p>חתימה:</p>
        ${safeSigUrl(principalSig)
          ? `<img src="${safeSigUrl(principalSig)}" style="max-height:70px;max-width:200px;object-fit:contain;display:block;margin-top:4px">`
          : `<div style="border-bottom:1px solid #555;width:200px;margin-top:8px"></div>`}
      </div>
    `;
  }

  function openSaveAs() {
    setSaveAsName(`כתב מינוי — ${todayLabel()}`);
    setSaveAsOpen(true);
  }

  async function confirmSaveAs() {
    if (!saveAsName.trim()) return;
    setSaveAsPending(true);
    try {
      await saveNamedForm(uid, "gimel", saveAsName.trim(), form as unknown as Record<string, unknown>);
      router.push("/quick");
    } finally {
      setSaveAsPending(false);
    }
  }

  const dateRange = form.tripDateFrom && form.tripDateTo
    ? `${formatDateHe(form.tripDateFrom)} עד ${formatDateHe(form.tripDateTo)}`
    : form.tripDateFrom ? formatDateHe(form.tripDateFrom) : "—";

  return (
    <div className="min-h-screen bg-muted">
      <header className="sticky top-0 z-10 bg-white border-b border-border shadow-[var(--shadow-card)]">
        <div className="h-14 flex items-center justify-between px-6 gap-4">
          <Link href={isDraft ? "/trips" : "/quick"} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isDraft ? "הטיולים שלי" : "טפסים שמורים"}
          </Link>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`text-xs ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
              {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
            </span>
            {isDraft && (
              <button onClick={openSaveAs}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors">
                שמור
              </button>
            )}
          </div>
        </div>

        {saveAsOpen && (
          <div className="border-t border-border px-6 py-3 flex items-center gap-3 bg-muted/30">
            <span className="text-xs text-muted-foreground flex-shrink-0">שם:</span>
            <input
              autoFocus
              className="flex-1 text-sm border border-border rounded-[var(--radius-sm)] px-3 py-1.5 focus:outline-none focus:border-primary bg-white"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmSaveAs(); if (e.key === "Escape") setSaveAsOpen(false); }}
            />
            <button onClick={confirmSaveAs} disabled={saveAsPending || !saveAsName.trim()}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0">
              {saveAsPending ? "שומר..." : "אשר"}
            </button>
            <button onClick={() => setSaveAsOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">✕</button>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ג׳ — כתב מינוי לאחראי/ת טיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isDraft ? "מילוי מהיר ללא טיול" : (formName || "...")}
          </p>
        </div>

        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>תאריך הכתב</Label>
              <Input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>שם בית הספר</Label>
              <Input value={form.schoolName} onChange={(e) => setField("schoolName", e.target.value)} placeholder="לדוגמה: בי״ס בן גוריון" />
            </div>
            <div className="space-y-1.5">
              <Label>שם האחראי/ת על הטיול</Label>
              <Input value={form.leaderName} onChange={(e) => setField("leaderName", e.target.value)} placeholder="שם מלא" />
            </div>
            <div className="space-y-1.5">
              <Label>שם מנהל/ת ביה"ס</Label>
              <Input value={form.principalName} onChange={(e) => setField("principalName", e.target.value)} placeholder="שם מלא" />
            </div>
            <div className="space-y-1.5">
              <Label>כיתות</Label>
              <Input value={form.classes} onChange={(e) => setField("classes", e.target.value)} placeholder="לדוגמה: ט׳1, ט׳2" />
            </div>
            <div className="space-y-1.5">
              <Label>אזור / יעד הטיול</Label>
              <Input value={form.area} onChange={(e) => setField("area", e.target.value)} placeholder="לדוגמה: מדבר יהודה" />
            </div>
            <div className="space-y-1.5">
              <Label>תאריך תחילת הטיול</Label>
              <Input type="date" value={form.tripDateFrom} onChange={(e) => setField("tripDateFrom", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>תאריך סיום הטיול</Label>
              <Input type="date" value={form.tripDateTo} onChange={(e) => setField("tripDateTo", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">נוסח כתב המינוי</h2>
          <div className="bg-muted/30 border border-border rounded-[var(--radius-sm)] p-6 text-sm leading-loose space-y-4">
            <p>
              <span className="text-muted-foreground">תאריך: </span>
              <strong>{form.date ? formatDateHe(form.date) : "—"}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">אל: </span>
              <strong>{form.leaderName || "—"}</strong>
            </p>
            <p>
              הריני ממנה אותך לאחראי/ת טיול לתלמידי כית/ות{" "}
              <strong>{form.classes || "—"}</strong>{" "}
              שיתקיים בתאריכים{" "}
              <strong>{dateRange}</strong>{" "}
              במקום/באזור{" "}
              <strong>{form.area || "—"}</strong>.
            </p>
            <div className="pt-4 border-t border-border">
              <p className="text-muted-foreground text-xs mb-1">בכבוד רב,</p>
              <p className="font-semibold">{form.principalName || "—"}</p>
              <p className="text-xs text-muted-foreground">מנהל/ת ביה"ס{form.schoolName ? ` — ${form.schoolName}` : ""}</p>
            </div>
          </div>
        </div>

        <AppendixActions title="נספח ג׳ — כתב מינוי לאחראי/ת טיול" filename="נספח-ג" getHTML={getHTML} />

        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">חתימת מנהל/ת ביה"ס</h2>
          {syntheticTripId && (
            <RemoteSignature
              tripId={syntheticTripId}
              role="c_principal"
              roleName='מנהל/ת ביה"ס'
              label='חתימת מנהל/ת ביה"ס'
              tripName={form.area || "טיול"}
              schoolName={form.schoolName}
              leaderName={form.leaderName}
              getPreviewHTML={getHTML}
            />
          )}
        </div>
      </main>
    </div>
  );
}

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
import { SignatureCanvas, SignatureCanvasHandle } from "@/components/signature-canvas";
import { printHTML, sharePDF, esc, safeSigUrl } from "@/components/appendix-actions";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHECK_ITEMS = [
  "אישור על היעדר רישום עבירות מין החתום מין חברת ההסעה או באופן אישי",
  "אישור קצין בטיחות בתעבורה בתוקף",
  "ותק רישיון הנהיגה של הנהג לנהיגה באוטובוס של שנתיים לפחות",
  "ציוד עזרה ראשונה, כולל אלונקה",
  "מים לשתייה, כ-60 ליטר",
  "מיקרופון תקין",
  "חגורות המותקנות בכל מושב באוטובוס",
  "ביצוע בדיקת תאי המטען ופנים האוטובוס על ידי נהג האוטובוס",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckVal = "ok" | "fail" | "";

type BusEntry = {
  id: string;
  busNum: string;
  area: string;
  gradeClass: string;
  date: string;
  driverName: string;
  driverPhone: string;
  companyName: string;
  companyPhone: string;
  licenseNum: string;
  busAge: CheckVal;
  checks: CheckVal[];
  inspectorName: string;
  inspectorRole: string;
  inspectorPhone: string;
  signature: string;
};

function emptyBus(num: string): BusEntry {
  return {
    id: crypto.randomUUID(),
    busNum: num,
    area: "", gradeClass: "", date: "",
    driverName: "", driverPhone: "",
    companyName: "", companyPhone: "", licenseNum: "", busAge: "",
    checks: Array(CHECK_ITEMS.length).fill(""),
    inspectorName: "", inspectorRole: "", inspectorPhone: "",
    signature: "",
  };
}

function todayLabel() {
  return new Date().toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}

// ─── Sub-components (module scope) ────────────────────────────────────────────

function CheckToggle({ val, onChange }: { val: CheckVal; onChange: (v: CheckVal) => void }) {
  return (
    <div className="flex gap-2 justify-center">
      <button
        onClick={() => onChange(val === "ok" ? "" : "ok")}
        className={`px-2.5 py-1 text-xs rounded-[var(--radius-sm)] border transition-colors ${val === "ok" ? "bg-[var(--success)] text-white border-transparent" : "border-border text-muted-foreground hover:border-[var(--success)] hover:text-[var(--success)]"}`}
      >
        תקין
      </button>
      <button
        onClick={() => onChange(val === "fail" ? "" : "fail")}
        className={`px-2.5 py-1 text-xs rounded-[var(--radius-sm)] border transition-colors ${val === "fail" ? "bg-destructive text-white border-transparent" : "border-border text-muted-foreground hover:border-destructive hover:text-destructive"}`}
      >
        לא תקין
      </button>
    </div>
  );
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildBusHTML(bus: BusEntry): string {
  const checkRow = (label: string, val: CheckVal) => `
    <tr>
      <td style="font-size:10px;padding:5px 8px">${esc(label)}</td>
      <td style="width:60px;text-align:center;font-size:10px;padding:5px 8px">
        ${val === "ok" ? "✓ תקין" : val === "fail" ? "✗ לא תקין" : ""}
      </td>
    </tr>`;

  return `
    <div class="header">
      <div class="title">נספח ט"ו — בדיקת אוטובוס לפני היציאה לטיול</div>
    </div>
    <div class="meta" style="margin-bottom:16px">
      <span>אזור הטיול: <strong>${esc(bus.area)}</strong></span>
      <span>שכבת הגיל/כיתה: <strong>${esc(bus.gradeClass)}</strong></span>
      <span>תאריך: <strong>${esc(bus.date)}</strong></span>
      ${bus.busNum ? `<span>אוטובוס מס׳: <strong>${esc(bus.busNum)}</strong></span>` : ""}
    </div>

    <div class="section-title">פרטי הנהג</div>
    <table style="margin-bottom:12px">
      <tr><th style="width:160px">שם</th><td>${esc(bus.driverName)}</td></tr>
      <tr><th>מספר טלפון נייד</th><td style="direction:ltr;text-align:right">${esc(bus.driverPhone)}</td></tr>
    </table>

    <div class="section-title">פרטי חברת ההסעה</div>
    <table style="margin-bottom:12px">
      <tr><th style="width:160px">שם החברה</th><td>${esc(bus.companyName)}</td></tr>
      <tr><th>מספר טלפון במשרד החברה</th><td style="direction:ltr;text-align:right">${esc(bus.companyPhone)}</td></tr>
      <tr><th>מספר הרישוי של הרכב</th><td>${esc(bus.licenseNum)}</td></tr>
      <tr><th>שנתון האוטובוס (לא מעל 10 שנים)</th>
        <td>${bus.busAge === "ok" ? "✓ תקין" : bus.busAge === "fail" ? "✗ לא תקין" : ""}</td></tr>
    </table>

    <div class="section-title">רשימת תיוג</div>
    <table style="margin-bottom:16px">
      <thead><tr>
        <th>נא לוודא את המצאות הפרטים הבאים</th>
        <th style="width:80px;text-align:center">תקין</th>
      </tr></thead>
      <tbody>
        ${CHECK_ITEMS.map((item, i) => checkRow(item, bus.checks[i] ?? "")).join("")}
      </tbody>
    </table>

    <table style="width:100%;border:none;border-collapse:collapse;margin-top:20px">
      <tr>
        <td style="border:none;width:25%;text-align:center;padding-top:8px;font-size:9px">
          <div style="border-top:1px solid #555;padding-top:4px">${esc(bus.inspectorName)}<br>שם הבודק</div>
        </td>
        <td style="border:none;width:25%;text-align:center;padding-top:8px;font-size:9px">
          <div style="border-top:1px solid #555;padding-top:4px">${esc(bus.inspectorRole)}<br>תפקיד</div>
        </td>
        <td style="border:none;width:25%;text-align:center;padding-top:8px;font-size:9px">
          <div style="border-top:1px solid #555;padding-top:4px">${esc(bus.inspectorPhone)}<br>מספר טלפון</div>
        </td>
        <td style="border:none;width:25%;text-align:center;padding-top:8px;font-size:9px">
          ${safeSigUrl(bus.signature)
            ? `<img src="${safeSigUrl(bus.signature)}" style="max-height:50px;max-width:120px;object-fit:contain;display:block;margin:0 auto 4px">`
            : `<div style="border-top:1px solid #555;height:50px"></div>`}
          <span>חתימה</span>
        </td>
      </tr>
    </table>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickBusCheckClient({ savedId }: { savedId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const isDraft = !savedId;

  const [buses, setBuses] = useState<BusEntry[]>([]);
  const [formName, setFormName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pdfLoading, setPdfLoading] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending = useRef(false);
  const sigRefs = useRef<Record<string, SignatureCanvasHandle | null>>({});

  // Save-as dialog state
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [saveAsPending, setSaveAsPending] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!uid) return;
    const handler = (raw: Record<string, unknown> | null) => {
      if (isPending.current) return;
      if (raw?.buses) setBuses(raw.buses as BusEntry[]);
      if (raw?.name) setFormName(String(raw.name));
    };
    const unsub = isDraft
      ? subscribeToQuickForm(uid, "bus-check", handler)
      : subscribeToNamedForm(savedId!, handler);
    return () => unsub();
  }, [uid, isDraft, savedId]);

  // ── Persist ────────────────────────────────────────────────────────────────

  function scheduleSave(updated: BusEntry[]) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (isDraft) {
        await saveQuickForm(uid, "bus-check", { buses: updated });
      } else {
        await updateNamedForm(savedId!, { buses: updated, uid, type: "bus-check" });
      }
      isPending.current = false;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function updateBus(id: string, patch: Partial<BusEntry>) {
    const updated = buses.map((b) => b.id === id ? { ...b, ...patch } : b);
    setBuses(updated);
    scheduleSave(updated);
  }

  function saveSignature(id: string) {
    const handle = sigRefs.current[id];
    if (!handle || handle.isEmpty()) return;
    updateBus(id, { signature: handle.toDataURL() });
  }

  function clearSignature(id: string) {
    sigRefs.current[id]?.clear();
    updateBus(id, { signature: "" });
  }

  function addBus() {
    const updated = [...buses, emptyBus(String(buses.length + 1))];
    setBuses(updated);
    scheduleSave(updated);
  }

  function removeBus(id: string) {
    const updated = buses.filter((b) => b.id !== id);
    setBuses(updated);
    scheduleSave(updated);
  }

  // ── Save as named ──────────────────────────────────────────────────────────

  function openSaveAs() {
    setSaveAsName(`בדיקת אוטובוס — ${todayLabel()}`);
    setSaveAsOpen(true);
  }

  async function confirmSaveAs() {
    if (!saveAsName.trim()) return;
    setSaveAsPending(true);
    try {
      await saveNamedForm(uid, "bus-check", saveAsName.trim(), { buses });
      router.push("/quick");
    } finally {
      setSaveAsPending(false);
    }
  }

  // ── Print ──────────────────────────────────────────────────────────────────

  function printAll() {
    const body = buses.map((b) =>
      `<div style="page-break-after:always">${buildBusHTML(b)}</div>`
    ).join("");
    printHTML(body, 'נספח ט"ו — בדיקת אוטובוס לפני היציאה לטיול');
  }

  async function shareAllPDF() {
    setPdfLoading(true);
    try {
      const body = buses.map((b) =>
        `<div style="page-break-after:always">${buildBusHTML(b)}</div>`
      ).join("");
      await sharePDF(body, 'נספח ט"ו — בדיקת אוטובוס');
    } finally {
      setPdfLoading(false);
    }
  }

  function printOne(bus: BusEntry) {
    printHTML(buildBusHTML(bus), `נספח ט"ו — אוטובוס ${bus.busNum || buses.indexOf(bus) + 1}`);
  }

  // ── Field helpers ──────────────────────────────────────────────────────────

  const inputCls = "w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2 focus:outline-none focus:border-primary";
  const labelCls = "text-xs font-medium text-muted-foreground";

  // ── Render ─────────────────────────────────────────────────────────────────

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
            {buses.length > 0 && (
              <>
                <button onClick={printAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  הדפס
                </button>
                <button onClick={shareAllPDF} disabled={pdfLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors disabled:opacity-50">
                  {pdfLoading ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  )}
                  {pdfLoading ? "מכין..." : "שתף PDF"}
                </button>
              </>
            )}
            {isDraft && (
              <button onClick={openSaveAs}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors">
                שמור
              </button>
            )}
          </div>
        </div>

        {/* Save-as inline panel */}
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

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ט"ו — בדיקת אוטובוס לפני היציאה לטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isDraft ? "מילוי מהיר ללא טיול" : (formName || "...")}
          </p>
        </div>

        {buses.length === 0 && (
          <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center space-y-4">
            <p className="text-sm text-muted-foreground">טרם הוגדרו אוטובוסים</p>
            <button onClick={addBus}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors">
              + הוסף אוטובוס
            </button>
          </div>
        )}

        {buses.map((bus, idx) => (
          <div key={bus.id} className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-[#1b4332] text-white">
              <span className="font-semibold text-sm">אוטובוס {bus.busNum || idx + 1}</span>
              <div className="flex gap-2">
                <button onClick={() => printOne(bus)}
                  className="text-xs px-3 py-1 border border-white/40 rounded hover:bg-white/10 transition-colors flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  הדפס
                </button>
                <button onClick={() => removeBus(bus.id)}
                  className="text-xs px-2 py-1 border border-white/40 rounded hover:bg-white/10 transition-colors">✕</button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className={labelCls}>מספר אוטובוס</label>
                  <input className={inputCls} value={bus.busNum}
                    onChange={(e) => updateBus(bus.id, { busNum: e.target.value })} placeholder="1" />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>אזור הטיול</label>
                  <input className={inputCls} value={bus.area}
                    onChange={(e) => updateBus(bus.id, { area: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>שכבת גיל / כיתה</label>
                  <input className={inputCls} value={bus.gradeClass}
                    onChange={(e) => updateBus(bus.id, { gradeClass: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>תאריך</label>
                  <input type="date" className={inputCls} value={bus.date}
                    onChange={(e) => updateBus(bus.id, { date: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-foreground border-b border-border pb-1">פרטי הנהג</h3>
                  <div className="space-y-1">
                    <label className={labelCls}>שם</label>
                    <input className={inputCls} value={bus.driverName}
                      onChange={(e) => updateBus(bus.id, { driverName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>מספר טלפון נייד</label>
                    <input className={inputCls} dir="ltr" value={bus.driverPhone}
                      onChange={(e) => updateBus(bus.id, { driverPhone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-foreground border-b border-border pb-1">פרטי חברת ההסעה</h3>
                  <div className="space-y-1">
                    <label className={labelCls}>שם החברה</label>
                    <input className={inputCls} value={bus.companyName}
                      onChange={(e) => updateBus(bus.id, { companyName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>מספר טלפון במשרד החברה</label>
                    <input className={inputCls} dir="ltr" value={bus.companyPhone}
                      onChange={(e) => updateBus(bus.id, { companyPhone: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>מספר רישוי הרכב</label>
                    <input className={inputCls} dir="ltr" value={bus.licenseNum}
                      onChange={(e) => updateBus(bus.id, { licenseNum: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>שנתון האוטובוס (לא מעל 10 שנים)</label>
                    <CheckToggle val={bus.busAge}
                      onChange={(v) => updateBus(bus.id, { busAge: v })} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-foreground border-b border-border pb-1 mb-3">רשימת תיוג</h3>
                <div className="space-y-2">
                  {CHECK_ITEMS.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm flex-1">{item}</span>
                      <CheckToggle
                        val={bus.checks[i] ?? ""}
                        onChange={(v) => {
                          const checks = [...bus.checks];
                          checks[i] = v;
                          updateBus(bus.id, { checks });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-foreground border-b border-border pb-1">פרטי הבודק וחתימה</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className={labelCls}>שם הבודק</label>
                    <input className={inputCls} value={bus.inspectorName}
                      onChange={(e) => updateBus(bus.id, { inspectorName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>תפקיד</label>
                    <input className={inputCls} value={bus.inspectorRole}
                      onChange={(e) => updateBus(bus.id, { inspectorRole: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>מספר טלפון</label>
                    <input className={inputCls} dir="ltr" value={bus.inspectorPhone}
                      onChange={(e) => updateBus(bus.id, { inspectorPhone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>חתימה</label>
                  {bus.signature ? (
                    <div className="flex items-center gap-4">
                      <img src={bus.signature} alt="חתימה"
                        className="h-16 border border-border rounded-[var(--radius-sm)] p-1 bg-white" />
                      <button onClick={() => clearSignature(bus.id)}
                        className="text-sm text-destructive hover:text-destructive/80 transition-colors">
                        מחק חתימה
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <SignatureCanvas ref={(el) => { sigRefs.current[bus.id] = el; }} />
                      <button onClick={() => saveSignature(bus.id)}
                        className="px-3 py-1.5 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
                        שמור חתימה
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {buses.length > 0 && (
          <button onClick={addBus}
            className="px-4 py-2 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
            + הוסף אוטובוס
          </button>
        )}
      </main>
    </div>
  );
}

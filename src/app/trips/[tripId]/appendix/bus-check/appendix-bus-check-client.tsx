"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix, getAppendix } from "@/lib/firestore/appendix";
import { useTrip } from "@/hooks/use-trip";
import { SignatureCanvas, SignatureCanvasHandle } from "@/components/signature-canvas";
import { printHTML, esc, safeSigUrl } from "@/components/appendix-actions";

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

export function AppendixBusCheckClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const { trip } = useTrip(tripId);

  const [buses, setBuses] = useState<BusEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending = useRef(false);

  // One sig canvas ref per bus (keyed by bus id)
  const sigRefs = useRef<Record<string, SignatureCanvasHandle | null>>({});

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "bus-check", (raw) => {
      if (isPending.current) return;
      if (raw?.buses) setBuses(raw.buses as BusEntry[]);
    });
    return () => unsub();
  }, [tripId]);

  // ── Save ───────────────────────────────────────────────────────────────────

  function scheduleSave(updated: BusEntry[]) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "bus-check", { buses: updated });
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
    const sig = handle.toDataURL();
    updateBus(id, { signature: sig });
  }

  function clearSignature(id: string) {
    sigRefs.current[id]?.clear();
    updateBus(id, { signature: "" });
  }

  // ── Import from vav ────────────────────────────────────────────────────────

  async function importFromVav() {
    const raw = await getAppendix(tripId, "vav");
    if (!raw?.buses) return;
    const vavBuses = raw.buses as { classSelections?: string[] }[];
    const imported = vavBuses.map((_, i) => emptyBus(String(i + 1)));
    const updated = [...buses, ...imported];
    setBuses(updated);
    scheduleSave(updated);
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

  // ── Print ──────────────────────────────────────────────────────────────────

  function printAll() {
    const body = buses.map((b) =>
      `<div style="page-break-after:always">${buildBusHTML(b)}</div>`
    ).join("");
    printHTML(body, 'נספח ט"ו — בדיקת אוטובוס לפני היציאה לטיול');
  }

  function printOne(bus: BusEntry) {
    printHTML(buildBusHTML(bus), `נספח ט"ו — אוטובוס ${bus.busNum || buses.indexOf(bus) + 1}`);
  }

  // ── Field helpers ──────────────────────────────────────────────────────────

  const inputCls = "w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2 focus:outline-none focus:border-primary";
  const labelCls = "text-xs font-medium text-muted-foreground";

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ט"ו — בדיקת אוטובוס לפני היציאה לטיול</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{trip?.name ?? ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
            {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
          </span>
          {buses.length > 1 && (
            <button onClick={printAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              הדפס הכל
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {buses.length === 0 && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center space-y-4">
          <p className="text-sm text-muted-foreground">טרם הוגדרו אוטובוסים</p>
          <div className="flex justify-center gap-3">
            <button onClick={importFromVav}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              יבא מטבלת שליטה
            </button>
            <button onClick={addBus}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors">
              + הוסף אוטובוס
            </button>
          </div>
        </div>
      )}

      {/* Bus forms */}
      {buses.map((bus, idx) => (
        <div key={bus.id} className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
          {/* Bus header bar */}
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
            {/* Header fields */}
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

            {/* Driver + Company */}
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

            {/* Checklist */}
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

            {/* Inspector + Signature */}
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
                    <SignatureCanvas
                      ref={(el) => { sigRefs.current[bus.id] = el; }}
                    />
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

      {/* Add bus button (when buses exist) */}
      {buses.length > 0 && (
        <div className="flex gap-3">
          <button onClick={addBus}
            className="px-4 py-2 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
            + הוסף אוטובוס
          </button>
          {buses.length === 0 && (
            <button onClick={importFromVav}
              className="px-4 py-2 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
              יבא מטבלת שליטה
            </button>
          )}
        </div>
      )}
    </div>
  );
}

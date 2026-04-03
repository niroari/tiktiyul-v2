"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";

const MAX_LOGO_KB = 200;

type Bus = { id: string; num: string; classes: string };

type SignsData = { logo: string; buses: Bus[] };

// ── Sign HTML builder (matches original site exactly) ─────────────────────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildSignHtml(bus: Bus, logo: string): string {
  const commaCount = (bus.classes.match(/,/g) ?? []).length;
  const fontSize = commaCount >= 2 ? 138 : bus.classes.length > 8 ? 173 : 230;
  const logoHtml = logo
    ? `<img src="${esc(logo)}" style="position:absolute;top:10mm;left:10mm;max-height:88mm;max-width:80mm;object-fit:contain" onerror="this.style.display='none'">`
    : "";

  return `<div class="sign-page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;
    border:8px solid #1b4332;box-sizing:border-box;position:relative;background:white;
    font-family:Arial,'Noto Sans Hebrew',sans-serif;direction:rtl;padding:10mm 16mm">
    ${logoHtml}
    <div style="font-size:76pt;font-weight:bold;color:#444;margin-bottom:18mm;text-align:center;letter-spacing:1px">
      ${esc(bus.num)}
    </div>
    <div style="font-size:${fontSize}pt;font-weight:bold;color:#1b4332;line-height:1;text-align:center">
      ${esc(bus.classes)}
    </div>
  </div>`;
}

function openSignPrintWindow(bodyHtml: string) {
  const win = window.open("", "_blank", "width=1000,height=750");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; background: white; }
    .sign-page { width: 100%; height: 100vh; overflow: hidden; }
    .sign-page + .sign-page { page-break-before: always; }
  </style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); win.close(); };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SignsClient() {
  const { tripId } = useParams<{ tripId: string }>();

  const [data, setData]     = useState<SignsData>({ logo: "", buses: [] });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [busNum, setBusNum]     = useState("");
  const [busClasses, setBusClasses] = useState("");
  const [logoError, setLogoError] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPending = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const numInputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "signs", (raw) => {
      if (isPending.current) return;
      if (raw) {
        setData({
          logo:  (raw.logo  as string) ?? "",
          buses: (raw.buses as Bus[])  ?? [],
        });
      }
    });
    return () => unsub();
  }, [tripId]);

  function scheduleAutoSave(updated: SignsData) {
    isPending.current = true;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "signs", updated as unknown as Record<string, unknown>);
      isPending.current = false;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function updateData(patch: Partial<SignsData>) {
    const updated = { ...data, ...patch };
    setData(updated);
    scheduleAutoSave(updated);
  }

  // ── Logo ──────────────────────────────────────────────────────────────────

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError("");

    if (file.size > MAX_LOGO_KB * 1024) {
      setLogoError(`הקובץ גדול מדי (${(file.size/1024).toFixed(0)} KB). המגבלה היא ${MAX_LOGO_KB} KB.`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      updateData({ logo: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function clearLogo() {
    updateData({ logo: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Buses ─────────────────────────────────────────────────────────────────

  function addBus() {
    if (!busNum.trim() && !busClasses.trim()) return;
    const updated: SignsData = {
      ...data,
      buses: [...data.buses, { id: crypto.randomUUID(), num: busNum.trim(), classes: busClasses.trim() }],
    };
    setData(updated);
    scheduleAutoSave(updated);
    setBusNum("");
    setBusClasses("");
    setTimeout(() => numInputRef.current?.focus(), 50);
  }

  function removeBus(id: string) {
    updateData({ buses: data.buses.filter((b) => b.id !== id) });
  }

  function printOne(bus: Bus) {
    openSignPrintWindow(buildSignHtml(bus, data.logo));
  }

  function printAll() {
    if (!data.buses.length) return;
    openSignPrintWindow(data.buses.map((b) => buildSignHtml(b, data.logo)).join(""));
  }

  // ── Sign preview (live, in-page) ──────────────────────────────────────────

  function SignPreview({ bus }: { bus: Bus }) {
    const commaCount = (bus.classes.match(/,/g) ?? []).length;
    const fontSize   = commaCount >= 2 ? 46 : bus.classes.length > 8 ? 58 : 76;
    return (
      <div
        className="relative flex flex-col items-center justify-center border-4 border-[#1b4332] bg-white rounded"
        style={{ aspectRatio: "297/210", padding: "6% 8%", fontFamily: "Arial, sans-serif", direction: "rtl" }}
      >
        {data.logo && (
          <img src={data.logo} alt="לוגו" className="absolute top-2 left-2 max-h-16 max-w-20 object-contain" />
        )}
        <div className="font-bold text-center text-[#444] mb-4" style={{ fontSize: `${Math.round(fontSize * 0.35)}pt` }}>
          {bus.num}
        </div>
        <div className="font-bold text-center text-[#1b4332] leading-none" style={{ fontSize: `${Math.round(fontSize * 0.35)}pt` }}>
          {bus.classes}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">שילוט אוטובוסים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">שלטי A4 לתליה על אוטובוסים</p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {/* Logo section */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-3">
        <h2 className="text-sm font-semibold border-b border-border pb-2">לוגו בית הספר (אופציונלי)</h2>
        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-2 flex-1 min-w-48">
            <label className="text-xs text-muted-foreground">העלאת קובץ (עד {MAX_LOGO_KB} KB)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoFile}
              className="text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-border file:text-sm file:bg-muted file:text-foreground file:cursor-pointer cursor-pointer"
            />
            {logoError && <p className="text-xs text-destructive">{logoError}</p>}
          </div>

          {data.logo && (
            <div className="flex items-center gap-3">
              <img src={data.logo} alt="לוגו" className="max-h-16 max-w-32 object-contain border border-border rounded p-1" />
              <button
                onClick={clearLogo}
                className="text-sm text-destructive hover:text-destructive/80 transition-colors"
              >
                הסר
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add bus form */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-3">
        <h2 className="text-sm font-semibold border-b border-border pb-2">הוסף אוטובוס</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">מספר אוטובוס</label>
            <input
              ref={numInputRef}
              type="text"
              value={busNum}
              onChange={(e) => setBusNum(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBus()}
              placeholder="1"
              className="text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2 focus:outline-none focus:border-primary w-24"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-40">
            <label className="text-xs text-muted-foreground">כיתות</label>
            <input
              type="text"
              value={busClasses}
              onChange={(e) => setBusClasses(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBus()}
              placeholder="ט׳1, ט׳2"
              className="w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2 focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={addBus}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors shrink-0"
          >
            הוסף
          </button>
        </div>
      </div>

      {/* Bus list */}
      {data.buses.length === 0 ? (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-10 text-center">
          <p className="text-muted-foreground text-sm">טרם נוספו אוטובוסים</p>
          <p className="text-xs text-muted-foreground/70 mt-1">הוסף/י אוטובוס בטופס למעלה</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.buses.map((bus) => (
            <div key={bus.id} className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <span className="text-sm font-medium">
                  אוטובוס {bus.num} &mdash; <span className="text-muted-foreground">{bus.classes}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => printOne(bus)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    הדפס שלט
                  </button>
                  <button
                    onClick={() => removeBus(bus.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Live preview (scaled down) */}
              <div className="max-w-xs mx-auto">
                <SignPreview bus={bus} />
              </div>
            </div>
          ))}

          {/* Print all */}
          {data.buses.length > 1 && (
            <button
              onClick={printAll}
              className="w-full py-2.5 text-sm border-2 border-primary text-primary rounded-[var(--radius)] hover:bg-primary/5 transition-colors font-medium"
            >
              🖨️ הדפס את כל השילוטים ({data.buses.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

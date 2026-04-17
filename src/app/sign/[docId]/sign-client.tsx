"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  getSignatureRequest,
  submitSignature,
  type SignatureDoc,
} from "@/lib/firestore/signatures";
import { SignatureCanvas, type SignatureCanvasHandle } from "@/components/signature-canvas";

const DOC_RENDER_WIDTH = 820; // px — matches the print layout width

function buildDocHtml(innerHtml: string) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Times New Roman', serif; direction: rtl; text-align: right;
       padding: 20px; font-size: 11px; color: #111; background: #fff; }
table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
th, td { border: 1px solid #999; padding: 4px 6px; text-align: right; font-size: 10px; }
th { background: #1b4332; color: white; font-weight: 600; }
.header { text-align: center; border-bottom: 2px solid #1b4332; padding-bottom: 8px; margin-bottom: 12px; }
.header .ministry { font-size: 8px; color: #555; }
.header .title { font-size: 15px; font-weight: bold; margin-top: 4px; }
.meta { display: flex; gap: 24px; font-size: 9.5px; margin-bottom: 8px; flex-wrap: wrap; }
.section-title { font-weight: bold; font-size: 12px; margin: 14px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
.letter-body { border: 1px solid #ddd; border-radius: 6px; padding: 16px 20px; line-height: 2.2; font-size: 12px; margin: 10px 0; }
img { max-width: 100%; }
</style>
</head>
<body>${innerHtml}</body>
</html>`;
}

function DocumentPreview({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const IFRAME_HEIGHT = 880;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.offsetWidth / DOC_RENDER_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-lg border border-border bg-white">
      <iframe
        srcDoc={buildDocHtml(html)}
        sandbox="allow-same-origin"
        scrolling="no"
        style={{
          width: DOC_RENDER_WIDTH,
          height: IFRAME_HEIGHT,
          border: "none",
          display: "block",
          transform: `scale(${scale})`,
          transformOrigin: "top right",
          marginBottom: IFRAME_HEIGHT * (scale - 1),
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export function SignClient() {
  const { docId } = useParams<{ docId: string }>();

  const [sigDoc, setSigDoc]   = useState<SignatureDoc | null>(null);
  const [state, setState]     = useState<"loading" | "ready" | "invalid" | "expired" | "already_signed" | "submitting" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [idNumber, setIdNumber] = useState("");

  const canvasRef = useRef<SignatureCanvasHandle>(null);

  useEffect(() => {
    getSignatureRequest(docId).then((doc) => {
      if (!doc) { setState("invalid"); return; }

      const expired = doc.expiresAt?.toDate() < new Date();
      if (expired) { setState("expired"); return; }

      if (doc.status === "signed") { setSigDoc(doc); setState("already_signed"); return; }

      setSigDoc(doc);
      setState("ready");
    }).catch(() => setState("invalid"));
  }, [docId]);

  async function handleSubmit() {
    const canvas = canvasRef.current;
    if (sigDoc?.requiresId && !idNumber.trim()) {
      setErrorMsg("נא להזין מספר תעודת זהות");
      return;
    }
    if (!canvas || canvas.isEmpty()) {
      setErrorMsg("נא לחתום לפני השליחה");
      return;
    }
    setErrorMsg("");
    setState("submitting");
    try {
      await submitSignature(docId, canvas.toDataURL(), sigDoc?.requiresId ? idNumber.trim() : undefined);
      setState("done");
    } catch (e) {
      console.error(e);
      setState("error");
    }
  }

  // ── Layout wrapper ─────────────────────────────────────────────────────────

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div className="min-h-screen bg-[#f6faf8] flex flex-col items-center py-10 px-4" dir="rtl">
        <div className="w-full max-w-lg space-y-5">
          <div className="text-center space-y-1">
            <div className="text-xs text-muted-foreground">משרד החינוך — מינהל חברה ונוער — של&quot;ח וידיעת הארץ</div>
            <h1 className="text-xl font-bold text-[#1b4332]">
              {sigDoc?.roleName ? `חתימה — ${sigDoc.roleName}` : "חתימה על מסמך"}
            </h1>
          </div>
          {children}
        </div>
      </div>
    );
  }

  // ── States ─────────────────────────────────────────────────────────────────

  if (state === "loading") {
    return (
      <Shell>
        <div className="text-center text-muted-foreground text-sm py-20">טוען...</div>
      </Shell>
    );
  }

  if (state === "invalid") {
    return (
      <Shell>
        <div className="bg-white rounded-xl border border-border p-8 text-center space-y-2">
          <div className="text-2xl">⚠️</div>
          <p className="font-medium">הקישור אינו תקף</p>
          <p className="text-sm text-muted-foreground">ייתכן שהקישור שגוי או שפג תוקפו. בקש/י קישור חדש מאחראי/ת הטיול.</p>
        </div>
      </Shell>
    );
  }

  if (state === "expired") {
    return (
      <Shell>
        <div className="bg-white rounded-xl border border-border p-8 text-center space-y-2">
          <div className="text-2xl">⏰</div>
          <p className="font-medium">פג תוקף הקישור</p>
          <p className="text-sm text-muted-foreground">הקישור תקף ל-30 ימים בלבד. בקש/י קישור חדש מאחראי/ת הטיול.</p>
        </div>
      </Shell>
    );
  }

  if (state === "done") {
    return (
      <Shell>
        <div className="bg-white rounded-xl border border-green-200 p-8 text-center space-y-3">
          <div className="text-4xl">✅</div>
          <p className="text-lg font-bold text-green-700">החתימה נשמרה בהצלחה!</p>
          <p className="text-sm text-muted-foreground">תודה. החתימה התקבלה ונשמרה בתיק הטיול.</p>
        </div>
      </Shell>
    );
  }

  if (state === "already_signed") {
    return (
      <Shell>
        <div className="space-y-4">
          {sigDoc?.previewHTML && <DocumentPreview html={sigDoc.previewHTML} />}
          <div className="bg-white rounded-xl border border-border p-6 space-y-4">
            <InfoCard doc={sigDoc!} />
            <div className="border-t border-border pt-4 text-center space-y-2">
              <span className="text-sm text-green-700 font-medium">✓ מסמך זה כבר נחתם</span>
              {sigDoc?.idNumber && (
                <p className="text-xs text-muted-foreground">ת.ז: <span className="font-medium text-foreground">{sigDoc.idNumber}</span></p>
              )}
              {sigDoc?.signature && (
                <img src={sigDoc.signature} alt="חתימה" className="max-h-16 object-contain mx-auto border border-border rounded p-1" />
              )}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Ready / submitting ────────────────────────────────────────────────────

  return (
    <Shell>
      <div className="space-y-4">
        {sigDoc?.previewHTML && <DocumentPreview html={sigDoc.previewHTML} />}

      <div className="bg-white rounded-xl border border-border p-6 space-y-5">
        <InfoCard doc={sigDoc!} />

        {/* ID number — only for forms that require it */}
        {sigDoc?.requiresId && (
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-sm font-medium">מספר תעודת זהות <span className="text-destructive">*</span></p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={9}
              placeholder="000000000"
              dir="ltr"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ""))}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary tracking-widest font-mono"
            />
          </div>
        )}

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-sm font-medium">חתימה</p>
          <p className="text-xs text-muted-foreground">חתום/י בתיבה למטה באמצעות העכבר או האצבע</p>

          <SignatureCanvas ref={canvasRef} />

          <div className="flex items-center gap-3">
            <button
              onClick={() => { canvasRef.current?.clear(); setErrorMsg(""); }}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-3 py-1.5 transition-colors"
            >
              נקה
            </button>
          </div>

          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
          {state === "error" && <p className="text-sm text-destructive">שגיאה בשמירה. נסה/י שוב.</p>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={state === "submitting"}
          className="w-full py-3 text-sm font-medium bg-[#1b4332] text-white rounded-lg hover:bg-[#1b4332]/90 transition-colors disabled:opacity-60"
        >
          {state === "submitting" ? "שומר..." : "חתום ושלח ✓"}
        </button>
      </div>
      </div>
    </Shell>
  );
}

function InfoCard({ doc }: { doc: SignatureDoc }) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-1.5 text-sm">
      <div><span className="text-muted-foreground">טיול: </span><strong>{doc.tripName}</strong></div>
      <div><span className="text-muted-foreground">בית ספר: </span><strong>{doc.schoolName}</strong></div>
      <div><span className="text-muted-foreground">אחראי/ת: </span><strong>{doc.leaderName}</strong></div>
      <div><span className="text-muted-foreground">תפקיד לחתימה: </span><strong>{doc.roleName}</strong></div>
    </div>
  );
}

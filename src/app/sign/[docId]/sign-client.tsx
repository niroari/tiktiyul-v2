"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  getSignatureRequest,
  submitSignature,
  type SignatureDoc,
} from "@/lib/firestore/signatures";
import { SignatureCanvas, type SignatureCanvasHandle } from "@/components/signature-canvas";

export function SignClient() {
  const { docId } = useParams<{ docId: string }>();

  const [sigDoc, setSigDoc]   = useState<SignatureDoc | null>(null);
  const [state, setState]     = useState<"loading" | "ready" | "invalid" | "expired" | "already_signed" | "submitting" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

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
    if (!canvas || canvas.isEmpty()) {
      setErrorMsg("נא לחתום לפני השליחה");
      return;
    }
    setErrorMsg("");
    setState("submitting");
    try {
      await submitSignature(docId, canvas.toDataURL());
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
        <div className="bg-white rounded-xl border border-border p-6 space-y-4">
          <InfoCard doc={sigDoc!} />
          <div className="border-t border-border pt-4 text-center space-y-2">
            <span className="text-sm text-green-700 font-medium">✓ מסמך זה כבר נחתם</span>
            {sigDoc?.signature && (
              <img src={sigDoc.signature} alt="חתימה" className="max-h-16 object-contain mx-auto border border-border rounded p-1" />
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ── Ready / submitting ────────────────────────────────────────────────────

  return (
    <Shell>
      <div className="bg-white rounded-xl border border-border p-6 space-y-5">
        <InfoCard doc={sigDoc!} />

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

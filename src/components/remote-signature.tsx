"use client";

import { useEffect, useRef, useState } from "react";
import {
  createSignatureRequest,
  getSignatureRequest,
  sigDocId,
  subscribeToSignature,
  type SignatureDoc,
} from "@/lib/firestore/signatures";

type Props = {
  tripId:          string;
  role:            string;       // e.g. "b_coordinator"
  roleName:        string;       // Hebrew, e.g. "רכז/ת"
  tripName:        string;
  schoolName:      string;
  leaderName:      string;
  label:           string;       // Display label above the widget
  requiresId?:     boolean;      // if true, sign page will collect ID number
  getPreviewHTML?: () => string; // snapshot of the document at send time
  getPrintHTML?:   (idNumber: string, address: string, signature: string) => string; // complete form for printing
};

export function RemoteSignature({ tripId, role, roleName, tripName, schoolName, leaderName, label, requiresId, getPreviewHTML, getPrintHTML }: Props) {
  const docId = sigDocId(tripId, role);

  const [sigDoc, setSigDoc]       = useState<SignatureDoc | null>(null);

  function printForm() {
    if (!getPrintHTML || !sigDoc?.signature) return;
    const html = getPrintHTML(sigDoc.idNumber ?? "", sigDoc.address ?? "", sigDoc.signature);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'David', Arial, sans-serif; direction: rtl; background: #fff; }
@media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>${html}</body>
</html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }
  const [loaded, setLoaded]       = useState(false);
  const [sending, setSending]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shareUrl, setShareUrl]   = useState("");
  const [copied, setCopied]       = useState(false);

  // Subscribe to live updates once the request exists
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Initial load (don't subscribe yet — saves Firestore reads when nothing sent)
    getSignatureRequest(docId).then((doc) => {
      setSigDoc(doc);
      setLoaded(true);
      if (doc) subscribeNow();
    });
    return () => unsubRef.current?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  function subscribeNow() {
    unsubRef.current?.();
    unsubRef.current = subscribeToSignature(docId, (doc) => {
      setSigDoc(doc);
    });
  }

  async function sendLink() {
    setSending(true);
    try {
      await createSignatureRequest(docId, { tripId, role, roleName, tripName, schoolName, leaderName, previewHTML: getPreviewHTML?.() ?? null, requiresId: requiresId ?? false });
      setSigDoc({ tripId, role, roleName, tripName, schoolName, leaderName, previewHTML: null, status: "pending", signature: null, createdAt: null as any, expiresAt: null as any });
      subscribeNow();
      const url = `${window.location.origin}/sign/${docId}`;
      setShareUrl(url);
    } finally {
      setSending(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const doc = await getSignatureRequest(docId);
      setSigDoc(doc);
    } finally {
      setRefreshing(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const msg = `*תיק טיול — חתימה על מסמך*\nשלום, אבקש חתימתך בתור ${roleName} על טיול "${tripName}".\nלחץ/י על הקישור לצפייה במסמך ולחתימה:\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (!loaded) return null;

  const status = sigDoc?.status ?? null;
  const sig    = sigDoc?.signature ?? null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      <div className="border border-border rounded-[var(--radius-sm)] p-3 space-y-2 bg-white">
        {/* Status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {status === "signed" && sig ? (
            <>
              <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5 font-medium">✓ חתם/ה</span>
              {getPrintHTML && (
                <button
                  onClick={printForm}
                  className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors border border-primary/30 rounded-full px-2.5 py-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  הדפס טופס
                </button>
              )}
            </>
          ) : status === "pending" ? (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5 font-medium">⏳ ממתין לחתימה</span>
          ) : (
            <span className="text-xs bg-muted text-muted-foreground border border-border rounded-full px-2.5 py-0.5">לא נשלח עדיין</span>
          )}

          {/* Send / re-send button */}
          <button
            onClick={sendLink}
            disabled={sending}
            className="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {sending ? "שולח..." : status ? "שלח שוב ↗" : "שלח לחתימה ↗"}
          </button>

          {/* Refresh (only when pending) */}
          {status === "pending" && (
            <button
              onClick={refresh}
              disabled={refreshing}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {refreshing ? "טוען..." : "רענן"}
            </button>
          )}
        </div>

        {/* Signed — show ID + signature image */}
        {status === "signed" && (
          <div className="space-y-1">
            {sigDoc?.idNumber && (
              <p className="text-xs text-muted-foreground">ת.ז: <span className="font-medium text-foreground">{sigDoc.idNumber}</span></p>
            )}
            {sig && <img src={sig} alt="חתימה" className="max-h-14 object-contain border border-border rounded p-1" />}
          </div>
        )}

        {/* Share section — shown after sending */}
        {shareUrl && status !== "signed" && (
          <div className="pt-1 space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 text-xs border border-border rounded px-2 py-1.5 bg-muted/30 focus:outline-none"
                dir="ltr"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={copyLink}
                className="text-xs px-2.5 py-1.5 border border-border rounded hover:bg-muted/50 transition-colors whitespace-nowrap"
              >
                {copied ? "הועתק ✓" : "העתק"}
              </button>
            </div>
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              שתף בוואטסאפ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

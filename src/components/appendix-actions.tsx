"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Escape user-supplied text before inserting into HTML strings. */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Validate a signature data URL before embedding it in HTML. */
export function safeSigUrl(url: string | null): string | null {
  if (!url) return null;
  if (!url.startsWith("data:image/png;base64,") && !url.startsWith("data:image/jpeg;base64,")) return null;
  if (url.length > 300_000) return null;
  return url;
}

function buildDoc(innerHTML: string, title: string) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Frank Ruhl Libre', 'Arial Hebrew', 'Arial', sans-serif; direction: rtl; text-align: right;
           padding: 20px; font-size: 11px; color: #111; background: #fff;
           word-spacing: normal; letter-spacing: normal; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { border: 1px solid #999; padding: 4px 6px; text-align: right; font-size: 10px;
             word-spacing: normal; letter-spacing: normal; }
    th { background: #1b4332; color: white; font-weight: 600; }
    .cat-row td { background: #d4edda; font-weight: bold; font-size: 10.5px; }
    .header { text-align: center; border-bottom: 2px solid #1b4332; padding-bottom: 8px; margin-bottom: 12px; }
    .header .ministry { font-size: 8px; color: #555; }
    .header .title { font-size: 15px; font-weight: bold; margin-top: 4px; }
    .footer { font-size: 8px; color: #888; margin-top: 8px; border-top: 1px solid #ccc; padding-top: 6px; }
    .meta { display: flex; gap: 16px; font-size: 9.5px; margin-bottom: 8px; flex-wrap: nowrap; }
    .meta span { white-space: nowrap; }
    .section-title { font-weight: bold; font-size: 12px; margin: 14px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
    .letter-body { border: 1px solid #ddd; border-radius: 6px; padding: 16px 20px; line-height: 2.2; font-size: 12px; margin: 10px 0; }
    @media print { body { padding: 10px; } @page { margin: 10mm; } }
  </style>
</head>
<body>${innerHTML}</body>
</html>`;
}

// Uses hidden iframe so print works on mobile (window.open is blocked outside direct gestures).
// Waits for fonts.ready so characters don't fall back to a font that drops word spacing.
export function printHTML(innerHTML: string, title: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:0;left:-9999px;width:210mm;height:297mm;border:none;";
  document.body.appendChild(iframe);
  const iDoc = iframe.contentDocument!;
  iDoc.open();
  iDoc.write(buildDoc(innerHTML, title));
  iDoc.close();
  iDoc.fonts.ready.then(() => {
    iframe.contentWindow!.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  });
}

// Renders the print HTML to a PDF and shares it via Web Share API (mobile) or downloads it (desktop).
// Uses a hidden same-origin iframe so the body element sits at (0,0) in its own document coordinate
// space. foreignObjectRendering routes text through the browser's native SVG layout engine, which
// correctly preserves spaces in Hebrew RTL text — html2canvas's own text renderer drops them.
export async function sharePDF(innerHTML: string, title: string): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:0;left:0;width:794px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  try {
    const iDoc = iframe.contentDocument!;
    iDoc.open();
    iDoc.write(buildDoc(innerHTML, title));
    iDoc.close();

    await iDoc.fonts.ready;
    await new Promise<void>((r) => setTimeout(r, 400));

    // Expand to full content height before capture
    iframe.style.height = iDoc.body.scrollHeight + "px";

    const h2c = (await import("html2canvas-pro")).default;
    const canvas = await h2c(iDoc.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#fff",
      foreignObjectRendering: true,
    });

    // Split canvas into A4 pages (794px wide, 1123px tall at 96dpi)
    const pageH = Math.round(canvas.width * 1123 / 794);
    const pageCount = Math.ceil(canvas.height / pageH);

    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pageCount; i++) {
      if (i > 0) pdf.addPage();
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = pageH;
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      const srcY = i * pageH;
      const srcH = Math.min(pageH, canvas.height - srcY);
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pdfW, pdfH);
    }

    const blob = pdf.output("blob");
    const safeFilename = title.replace(/[<>:"/\\|?*]/g, "").trim() || "טופס";
    const file = new File([blob], `${safeFilename}.pdf`, { type: "application/pdf" });

    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFilename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } finally {
    document.body.removeChild(iframe);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  title: string;
  getHTML: () => string;
};

export function AppendixActions({ title, getHTML }: Props) {
  const [pdfLoading, setPdfLoading] = useState(false);

  async function handleSharePDF() {
    setPdfLoading(true);
    try {
      await sharePDF(getHTML(), title);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
      <Button variant="outline" size="sm" onClick={() => printHTML(getHTML(), title)}>
        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        הדפס
      </Button>
      <Button variant="outline" size="sm" onClick={handleSharePDF} disabled={pdfLoading}>
        {pdfLoading ? (
          <svg className="w-4 h-4 ml-1.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        )}
        {pdfLoading ? "מכין PDF..." : "שתף PDF"}
      </Button>
    </div>
  );
}

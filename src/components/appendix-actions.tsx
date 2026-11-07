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

export type PrintOptions = {
  fitPages?: boolean;
  paginate?: boolean;
};

function buildDoc(innerHTML: string, title: string, options?: PrintOptions) {
  const fitPages = options?.fitPages ?? false;
  const paginate = options?.paginate ?? false;
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&display=swap');
    @page {
      size: A4 portrait;
      margin: ${fitPages ? "8mm" : paginate ? "10mm" : "20mm 15mm 20mm 15mm"};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Frank Ruhl Libre', 'Arial Hebrew', 'Arial', sans-serif; direction: rtl; text-align: right;
           padding: ${fitPages || paginate ? "0" : "20mm 15mm"}; font-size: 13px; line-height: 1.5; color: #111; background: #fff;
           word-spacing: normal; letter-spacing: normal; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #999; padding: 6px 8px; text-align: right; font-size: 13px;
             word-spacing: normal; letter-spacing: normal; }
    th { background: #1b4332; color: white; font-weight: 600; }
    .cat-row td { background: #d4edda; font-weight: bold; font-size: 13.5px; }
    .header { text-align: center; border-bottom: 2px solid #1b4332; padding-bottom: 8px; margin-bottom: 12px; }
    .header .ministry { font-size: 11px; color: #555; }
    .header .title { font-size: 18px; font-weight: bold; margin-top: 4px; }
    .footer { font-size: 10px; color: #888; margin-top: 10px; border-top: 1px solid #ccc; padding-top: 6px; }
    .meta { display: flex; gap: 16px; font-size: 12px; margin-bottom: 10px; flex-wrap: nowrap; }
    .meta span { white-space: nowrap; }
    .section-title { font-weight: bold; font-size: 14px; margin: 14px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
    .letter-body { border: 1px solid #ddd; border-radius: 6px; padding: 18px 22px; line-height: 2; font-size: 14px; margin: 10px 0; }
    .print-page {
      width: 794px;
      padding: ${paginate ? "56px 56px" : "30px 30px"};
      background: #fff;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .print-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .print-page-inner {
      width: 100%;
      transform-origin: top right;
    }
    @media print {
      html, body {
        padding: 0 !important;
        margin: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-page {
        width: 100% !important;
        padding: ${paginate ? "10mm 10mm" : "0"} !important;
        overflow: hidden !important;
      }
    }
  </style>
</head>
<body>${innerHTML}</body>
</html>`;
}

/**
 * Paginates `[data-print-block]` elements (or direct body children) into `.print-page`
 * containers so that no block is ever sliced across A4 page boundaries and every page
 * maintains consistent top/bottom/side margins.
 * Elements with `data-keep-with-next="true"` are kept together with the following block.
 */
function paginateToA4Pages(iDoc: Document) {
  const rawBlocks = Array.from(iDoc.querySelectorAll<HTMLElement>("[data-print-block]"));
  const blocks = rawBlocks.length > 0 ? rawBlocks : Array.from(iDoc.body.children) as HTMLElement[];
  if (blocks.length === 0) return;

  // Group blocks where `data-keep-with-next="true"` chains into the next block
  const groups: HTMLElement[][] = [];
  let currentGroup: HTMLElement[] = [];
  for (const block of blocks) {
    currentGroup.push(block);
    if (block.getAttribute("data-keep-with-next") !== "true") {
      groups.push(currentGroup);
      currentGroup = [];
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Clear body and distribute groups across `.print-page` containers
  iDoc.body.innerHTML = "";
  const maxContentH = 880; // Safe A4 inner content height in px (leaving >= 40mm vertical margins)

  function createPage() {
    const page = iDoc.createElement("div");
    page.className = "print-page";
    const inner = iDoc.createElement("div");
    inner.className = "print-page-inner";
    page.appendChild(inner);
    iDoc.body.appendChild(page);
    return { page, inner };
  }

  let current = createPage();
  let hasItemsOnPage = false;

  for (const group of groups) {
    for (const el of group) {
      current.inner.appendChild(el);
    }

    if (hasItemsOnPage && current.inner.scrollHeight > maxContentH) {
      // Move this group to a fresh page so it won't be cut across pages
      current = createPage();
      for (const el of group) {
        current.inner.appendChild(el);
      }
    }
    hasItemsOnPage = true;
  }
}

/**
 * Dynamically scales each `.print-page` so its content always fits within a single A4 page
 * (734px printable width × 1040px printable height inside 8mm margins at 96 DPI).
 */
function fitPagesToA4(iDoc: Document) {
  const pages = Array.from(iDoc.querySelectorAll<HTMLElement>(".print-page"));
  const availW = 734; // 794px - 2 * 30px (8mm)
  const availH = 1040; // ~297mm - 16mm margin in px, with safety buffer for print headers/footers

  for (const page of pages) {
    let inner = page.querySelector<HTMLElement>(".print-page-inner");
    if (!inner) {
      inner = iDoc.createElement("div");
      inner.className = "print-page-inner";
      while (page.firstChild) {
        inner.appendChild(page.firstChild);
      }
      page.appendChild(inner);
    }

    // Reset before measuring
    inner.style.transform = "none";
    inner.style.width = "100%";
    page.style.height = "auto";

    const naturalW = Math.max(inner.scrollWidth, availW);
    const naturalH = inner.scrollHeight;

    if (naturalH <= availH && naturalW <= availW) {
      continue;
    }

    let scale = Math.min(1, availW / naturalW, availH / naturalH);

    // Refine scale: widening the inner container to (100 / scale)% gives tables more horizontal
    // room so cells wrap less, reducing scrollHeight and allowing a larger, more readable scale.
    for (let step = 0; step < 3; step++) {
      const targetWidthPx = Math.floor(availW / scale);
      inner.style.width = `${targetWidthPx}px`;

      const curW = inner.scrollWidth;
      const curH = inner.scrollHeight;

      const scaleW = availW / Math.max(curW, availW);
      const scaleH = availH / Math.max(curH, 1);
      const nextScale = Math.min(1, scaleW, scaleH);

      if (curH * scale <= availH && curW * scale <= availW + 2) {
        // Already fits; if there's significant vertical headroom we can nudge scale up slightly
        scale = Math.min(1, nextScale * 0.99);
        break;
      }
      scale = nextScale * 0.98;
    }

    const finalWidthPx = Math.floor(availW / scale);
    inner.style.width = `${finalWidthPx}px`;
    if (inner.scrollWidth > finalWidthPx) {
      scale = Math.min(scale, availW / inner.scrollWidth);
    }

    inner.style.transform = `scale(${scale})`;
    inner.style.transformOrigin = "top right";

    const scaledH = Math.ceil(inner.scrollHeight * scale);
    // Wrap in a fixed-height clip box so the DOM layout height matches the visual scaled height
    const clipBox = iDoc.createElement("div");
    clipBox.style.cssText = `width:${availW}px;height:${Math.min(scaledH, availH)}px;overflow:hidden;position:relative;`;
    page.insertBefore(clipBox, inner);
    clipBox.appendChild(inner);
  }
}

// Uses hidden iframe so print works on mobile (window.open is blocked outside direct gestures).
// Waits for fonts.ready so characters don't fall back to a font that drops word spacing.
export function printHTML(innerHTML: string, title: string, options?: PrintOptions) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:0;left:-9999px;width:794px;height:1123px;border:none;";
  document.body.appendChild(iframe);
  const iDoc = iframe.contentDocument!;
  iDoc.open();
  iDoc.write(buildDoc(innerHTML, title, options));
  iDoc.close();
  iDoc.fonts.ready.then(() => {
    if (options?.paginate) {
      paginateToA4Pages(iDoc);
    }
    if (options?.fitPages) {
      fitPagesToA4(iDoc);
    }
    iframe.contentWindow!.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  });
}

// Renders the print HTML to a PDF and shares it via Web Share API (mobile) or downloads it (desktop).
// Uses a hidden same-origin iframe so the body element sits at (0,0) in its own document coordinate
// space. foreignObjectRendering routes text through the browser's native SVG layout engine, which
// correctly preserves spaces in Hebrew RTL text — html2canvas's own text renderer drops them.
export async function sharePDF(innerHTML: string, title: string, options?: PrintOptions): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:0;left:0;width:794px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  try {
    const iDoc = iframe.contentDocument!;
    iDoc.open();
    iDoc.write(buildDoc(innerHTML, title, options));
    iDoc.close();

    await iDoc.fonts.ready;
    await new Promise<void>((r) => setTimeout(r, 400));

    if (options?.paginate) {
      paginateToA4Pages(iDoc);
    }
    if (options?.fitPages) {
      fitPagesToA4(iDoc);
    }

    // Expand to full content height before capture
    iframe.style.height = iDoc.body.scrollHeight + "px";

    const h2c = (await import("html2canvas-pro")).default;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    const pageElements = options?.fitPages || options?.paginate
      ? Array.from(iDoc.querySelectorAll<HTMLElement>(".print-page"))
      : [];

    if (pageElements.length > 0) {
      for (let i = 0; i < pageElements.length; i++) {
        if (i > 0) pdf.addPage();
        const el = pageElements[i];
        const canvas = await h2c(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#fff",
          foreignObjectRendering: true,
        });

        // Place captured page element onto a single A4 PDF page without slicing
        const pageH = Math.round((canvas.width * 1123) / 794);
        const outCanvas = document.createElement("canvas");
        outCanvas.width = canvas.width;
        outCanvas.height = pageH;
        const ctx = outCanvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

        const fitRatio = Math.min(1, pageH / canvas.height);
        const drawW = Math.round(canvas.width * fitRatio);
        const drawH = Math.round(canvas.height * fitRatio);
        const offsetX = Math.round((canvas.width - drawW) / 2);
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, offsetX, 0, drawW, drawH);

        pdf.addImage(outCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pdfW, pdfH);
      }
    } else {
      const canvas = await h2c(iDoc.body, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fff",
        foreignObjectRendering: true,
      });

      // Split canvas into A4 pages (794px wide, 1123px tall at 96dpi)
      const pageH = Math.round((canvas.width * 1123) / 794);
      const pageCount = Math.ceil(canvas.height / pageH);

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
  fitPages?: boolean;
  paginate?: boolean;
};

export function AppendixActions({ title, getHTML, fitPages, paginate }: Props) {
  const [pdfLoading, setPdfLoading] = useState(false);

  async function handleSharePDF() {
    setPdfLoading(true);
    try {
      await sharePDF(getHTML(), title, { fitPages, paginate });
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
      <Button variant="outline" size="sm" onClick={() => printHTML(getHTML(), title, { fitPages, paginate })}>
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

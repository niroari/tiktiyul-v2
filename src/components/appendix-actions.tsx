"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Shared print wrapper — RTL, Times New Roman, clean A4 styling
export function printHTML(innerHTML: string, title: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Frank Ruhl Libre', 'Times New Roman', serif; direction: rtl; text-align: right;
           padding: 20px; font-size: 11px; color: #111; background: #fff; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { border: 1px solid #999; padding: 4px 6px; text-align: right; font-size: 10px; }
    th { background: #1b4332; color: white; font-weight: 600; }
    .cat-row td { background: #d4edda; font-weight: bold; font-size: 10.5px; }
    .header { text-align: center; border-bottom: 2px solid #1b4332; padding-bottom: 8px; margin-bottom: 12px; }
    .header .ministry { font-size: 8px; color: #555; }
    .header .title { font-size: 15px; font-weight: bold; margin-top: 4px; }
    .footer { font-size: 8px; color: #888; margin-top: 8px; border-top: 1px solid #ccc; padding-top: 6px; }
    .meta { display: flex; gap: 24px; font-size: 9.5px; margin-bottom: 8px; }
    .section-title { font-weight: bold; font-size: 12px; margin: 14px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
    .letter-body { border: 1px solid #ddd; border-radius: 6px; padding: 16px 20px; line-height: 2.2; font-size: 12px; margin: 10px 0; }
    @media print { body { padding: 10px; } @page { margin: 10mm; } }
  </style>
</head>
<body>${innerHTML}</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}

// Renders clean HTML offscreen, captures with html2canvas-pro (supports oklch/lab)
async function exportToPDF(getHTML: () => string, filename: string) {
  const html2canvas = (await import("html2canvas-pro")).default;
  const { jsPDF } = await import("jspdf");

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;top:0;left:0;width:794px;z-index:-9999;opacity:0;pointer-events:none;";

  const container = document.createElement("div");
  container.style.cssText = [
    "background:white",
    "font-family:'Times New Roman',serif",
    "direction:rtl",
    "text-align:right",
    "padding:28px",
    "font-size:10px",
    "color:#111",
    "line-height:1.5",
    "width:794px",
  ].join(";");
  container.innerHTML = getHTML();
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  await new Promise((r) => setTimeout(r, 150));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 794,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 8;
    const contentW = 210 - margin * 2;
    const contentH = 297 - margin * 2;
    const imgW = contentW;
    const imgH = canvas.height * imgW / canvas.width;

    let yOff = 0;
    let page = 0;

    while (yOff < imgH) {
      if (page > 0) pdf.addPage();
      const sliceH = Math.min(contentH, imgH - yOff);
      const srcY = yOff * (canvas.width / imgW);
      const srcH = sliceH * (canvas.width / imgW);

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.ceil(srcH);
      const ctx = slice.getContext("2d");
      if (ctx && srcH > 0) {
        ctx.drawImage(canvas, 0, Math.floor(srcY), canvas.width, Math.ceil(srcH), 0, 0, canvas.width, Math.ceil(srcH));
        pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, sliceH);
      }
      yOff += contentH;
      page++;
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  filename: string;
  title: string;
  getHTML: () => string; // returns clean print-ready inner HTML
};

export function AppendixActions({ filename, title, getHTML }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExportPDF() {
    setExporting(true);
    try {
      await exportToPDF(getHTML, filename);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("PDF export failed:", msg, e);
      alert(`שגיאה בייצוא PDF:\n${msg}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
      <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {exporting ? "מייצא..." : "ייצא PDF"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => printHTML(getHTML(), title)}>
        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        הדפס
      </Button>
    </div>
  );
}

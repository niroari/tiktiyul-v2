"use client";

import { useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  contentRef: RefObject<HTMLDivElement | null>;
  title: string;
  filename: string;
};

export function AppendixActions({ contentRef, title, filename }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExportPDF() {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).jsPDF;

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentW = pageW - margin * 2;
      const imgH = (canvas.height * contentW) / canvas.width;

      // Multi-page support
      let yPos = margin;
      let heightLeft = imgH;

      pdf.addImage(imgData, "PNG", margin, yPos, contentW, imgH);
      heightLeft -= pageH - margin * 2;

      while (heightLeft > 0) {
        yPos = heightLeft - imgH + margin;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, yPos, contentW, imgH);
        heightLeft -= pageH - margin * 2;
      }

      pdf.save(`${filename}.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    if (!contentRef.current) return;

    const content = contentRef.current.innerHTML;
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html lang="he" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');
          * { box-sizing: border-box; }
          body { font-family: 'Rubik', sans-serif; direction: rtl; text-align: right; margin: 20px; font-size: 13px; color: #111; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: right; }
          th { background: #f5f5f5; font-weight: 600; }
          input, textarea { border: none; background: transparent; font-family: inherit; font-size: inherit; width: 100%; }
          .rounded-\\[var\\(--radius\\)\\], .rounded-\\[var\\(--radius-sm\\)\\] { border-radius: 6px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  return (
    <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
      <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {exporting ? "מייצא..." : "ייצא PDF"}
      </Button>
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        הדפס
      </Button>
    </div>
  );
}

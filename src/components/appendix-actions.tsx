"use client";

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
  if (url.length > 300_000) return null; // ~225KB decoded — plenty for a canvas sig
  return url;
}

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

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  filename: string;
  title: string;
  getHTML: () => string; // returns clean print-ready inner HTML
};

export function AppendixActions({ filename: _filename, title, getHTML }: Props) {
  return (
    <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
      <Button variant="outline" size="sm" onClick={() => printHTML(getHTML(), title)}>
        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        הדפס
      </Button>
    </div>
  );
}

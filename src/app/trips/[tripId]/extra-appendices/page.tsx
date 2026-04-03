import type { Metadata } from "next";

export const metadata: Metadata = { title: "נספחים נוספים להדפסה" };

export default function ExtraAppendicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספחים נוספים להדפסה</h1>
          <p className="text-sm text-muted-foreground mt-0.5">נספחים משלימים להדפסה ידנית</p>
        </div>
        <a
          href="/appendices-print.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          הדפס / PDF
        </a>
      </div>

      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
        <iframe
          src="/appendices-print.pdf"
          className="w-full"
          style={{ height: "80vh" }}
          title="נספחים נוספים להדפסה"
        />
      </div>
    </div>
  );
}

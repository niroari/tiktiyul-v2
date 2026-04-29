"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { listSavedForms, deleteSavedForm, type SavedFormEntry } from "@/lib/firestore/quick-forms";

const TYPE_LABELS: Record<string, string> = {
  "bus-check": "בדיקת אוטובוס",
  "gimel":     "כתב מינוי",
};

const TYPE_HREF: Record<string, string> = {
  "bus-check": "/quick/bus-check",
  "gimel":     "/quick/gimel",
};

function formatDate(ts: SavedFormEntry["savedAt"]) {
  if (!ts) return "";
  return new Date(ts.seconds * 1000).toLocaleDateString("he-IL", {
    day: "numeric", month: "numeric", year: "numeric",
  });
}

export default function QuickLibraryPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";

  const [forms, setForms] = useState<SavedFormEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = listSavedForms(uid, (data) => {
      setForms(data);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את "${name}"?`)) return;
    await deleteSavedForm(id);
  }

  return (
    <div className="min-h-screen bg-muted">
      <header className="sticky top-0 z-10 bg-white border-b border-border h-14 flex items-center justify-between px-6 shadow-[var(--shadow-card)]">
        <Link href="/trips" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          הטיולים שלי
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/quick/bus-check"
            className="px-3 py-1.5 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
            + בדיקת אוטובוס
          </Link>
          <Link href="/quick/gimel"
            className="px-3 py-1.5 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
            + כתב מינוי
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">טפסים שמורים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "טוען..." : `${forms.length} טפסים`}
          </p>
        </div>

        {!loading && forms.length === 0 && (
          <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">אין טפסים שמורים עדיין</p>
            <div className="flex justify-center gap-3">
              <Link href="/quick/bus-check"
                className="px-4 py-2 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
                בדיקת אוטובוס
              </Link>
              <Link href="/quick/gimel"
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors">
                כתב מינוי
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {forms.map((form) => (
            <div key={form.id}
              className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{form.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {TYPE_LABELS[form.type] ?? form.type}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(form.savedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link href={`${TYPE_HREF[form.type] ?? "/quick"}/${form.id}`}
                  className="px-3 py-1.5 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors">
                  פתח
                </Link>
                <button onClick={() => handleDelete(form.id, form.name)}
                  className="px-3 py-1.5 text-sm text-destructive hover:text-destructive/80 transition-colors">
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

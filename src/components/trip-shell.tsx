"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getTripNav } from "@/lib/nav";
import { Button } from "@/components/ui/button";

type Props = {
  tripId: string;
  tripName: string;
  schoolName: string;
  children: React.ReactNode;
};

export function TripShell({ tripId, tripName, schoolName, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const groups = getTripNav(tripId);

  function isActive(href: string) {
    if (href === `/trips/${tripId}`) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Top bar */}
      <header className="fixed top-0 right-0 left-0 z-30 h-14 bg-white border-b border-border flex items-center justify-between px-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Back to trips */}
          <Link
            href="/trips"
            className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          {/* Trip name */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground truncate max-w-[200px] lg:max-w-none">
              {tripName}
            </span>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {schoolName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Progress pill */}
          <div className="hidden sm:flex items-center gap-2 bg-muted border border-border rounded-full px-3 py-1">
            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: "35%" }} />
            </div>
            <span className="text-xs text-muted-foreground">35%</span>
          </div>

          {/* Share */}
          <Button variant="outline" size="sm" className="text-primary border-primary hover:bg-[var(--brand-light)]">
            <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            שיתוף
          </Button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center cursor-pointer select-none">
            נ
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-14 right-0 bottom-0 z-20 w-60 bg-white border-l border-border overflow-y-auto
          shadow-[var(--shadow-sidebar)] transition-transform duration-200
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
        `}
      >
        <nav className="py-3 px-2">
          {groups.map((group) => (
            <div key={group.title} className="mb-2">
              <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {group.title}
              </p>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-sm)] text-sm mb-0.5 transition-colors
                      ${active
                        ? "bg-[var(--brand-light)] text-primary font-semibold border-r-2 border-primary"
                        : "text-foreground hover:bg-muted"
                      }
                    `}
                  >
                    {item.letter ? (
                      <span className={`w-5 h-5 flex-shrink-0 rounded-full text-xs flex items-center justify-center font-bold
                        ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {item.letter}
                      </span>
                    ) : (
                      <NavIcon name={item.icon!} active={active} />
                    )}
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="pt-14 lg:mr-60 min-h-screen">
        <div className="p-5 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const cls = `w-4 h-4 flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`;
  const paths: Record<string, string> = {
    dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    students: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    staff: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    food: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
    rooms: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    masa: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    signs: "M7 7h.01M7 3h5l4.586 4.586a2 2 0 010 2.828L11.414 16H7a2 2 0 01-2-2V5a2 2 0 012-2z",
    security: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  };
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={paths[name] ?? paths.dashboard} />
    </svg>
  );
}

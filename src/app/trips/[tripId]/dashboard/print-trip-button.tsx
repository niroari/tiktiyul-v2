"use client";

import { useState } from "react";
import { getAppendix } from "@/lib/firestore/appendix";
import { getSignatureRequest, sigDocId } from "@/lib/firestore/signatures";
import { getStudents } from "@/lib/firestore/students";
import { getTrip } from "@/lib/firestore/trips";
import {
  buildAlef, buildBet, buildGimel, buildDalet, buildHey,
  buildVav, buildZayin, buildChet, buildTet, buildYod,
  openTripPrintWindow,
} from "@/lib/print/build-trip-html";

export function PrintTripButton({ tripId }: { tripId: string }) {
  const [state, setState] = useState<"idle" | "loading">("idle");

  async function handlePrint() {
    setState("loading");
    try {
      // Fetch everything in parallel
      const [
        trip, students,
        alefRaw, betRaw, gimelRaw, daletRaw, heyRaw,
        vavRaw, chetRaw, tetRaw, yodRaw,
        sigLeader, sigCoord, sigPrincipalB, sigPrincipalC,
      ] = await Promise.all([
        getTrip(tripId),
        getStudents(tripId),
        getAppendix(tripId, "alef"),
        getAppendix(tripId, "bet"),
        getAppendix(tripId, "gimel"),
        getAppendix(tripId, "dalet"),
        getAppendix(tripId, "hey"),
        getAppendix(tripId, "vav"),
        getAppendix(tripId, "chet"),
        getAppendix(tripId, "tet"),
        getAppendix(tripId, "yod"),
        getSignatureRequest(sigDocId(tripId, "b_leader")),
        getSignatureRequest(sigDocId(tripId, "b_coordinator")),
        getSignatureRequest(sigDocId(tripId, "b_principal")),
        getSignatureRequest(sigDocId(tripId, "c_principal")),
      ]);

      const sections: string[] = [];

      // א
      const alefItems = (alefRaw?.items ?? {}) as Record<string, { w: boolean; m: boolean; note: string }>;
      sections.push(buildAlef(alefItems, trip));

      // ב
      const betData = {
        leaderName:     String(betRaw?.leaderName    ?? ""),
        leaderPhone:    String(betRaw?.leaderPhone   ?? ""),
        parents:        String(betRaw?.parents       ?? ""),
        weapons:        String(betRaw?.weapons       ?? ""),
        leaderNotes:    String(betRaw?.leaderNotes   ?? ""),
        principalNotes: String(betRaw?.principalNotes ?? ""),
        schedule:       (betRaw?.schedule ?? []) as { id: string; date: string; fromTime: string; toTime: string; activity: string; notes: string }[],
      };
      sections.push(buildBet(betData, trip, {
        leader:      sigLeader?.status === "signed"      ? (sigLeader.signature  ?? null) : null,
        coordinator: sigCoord?.status === "signed"       ? (sigCoord.signature   ?? null) : null,
        principal:   sigPrincipalB?.status === "signed"  ? (sigPrincipalB.signature ?? null) : null,
      }));

      // ג
      const gimelData = {
        date:          String(gimelRaw?.date          ?? ""),
        leaderName:    String(gimelRaw?.leaderName    ?? ""),
        principalName: String(gimelRaw?.principalName ?? ""),
        area:          String(gimelRaw?.area          ?? ""),
      };
      sections.push(buildGimel(gimelData, trip, sigPrincipalC?.status === "signed" ? (sigPrincipalC.signature ?? null) : null));

      // ד
      const daletRows = (daletRaw?.rows ?? []) as { id: string; day: string; time: string; activity: string; notes: string }[];
      sections.push(buildDalet(daletRows));

      // ה
      const heyRows = (heyRaw?.rows ?? []) as { id: string; role: string; name: string; phone: string; notes: string }[];
      sections.push(buildHey(heyRows));

      // ו
      const vavData = {
        buses:  ((vavRaw?.buses  ?? []) as {
          id: string; classSelections: string[];
          crew: { name: string; phone: string }[];
          extraTeachers: { role: string; name: string; phone: string }[];
        }[]).map((b) => ({
          ...b,
          crew:            b.crew            ?? [],
          extraTeachers:   b.extraTeachers   ?? [],
          classSelections: b.classSelections ?? [],
        })),
        actual: (vavRaw?.actual ?? {}) as Record<string, string>,
        splits: (vavRaw?.splits ?? {}) as Record<string, string[]>,
      };
      sections.push(buildVav(vavData, students, trip));

      // ז
      sections.push(buildZayin(students, trip));

      // ח (text mode only)
      const chetData = {
        mode:    String(chetRaw?.mode    ?? "text"),
        text:    String(chetRaw?.text    ?? ""),
        url:     String(chetRaw?.url     ?? ""),
        fileUrl: String(chetRaw?.fileUrl ?? ""),
      };
      const chetHtml = buildChet(chetData);
      if (chetHtml) sections.push(chetHtml);

      // ט
      const tetItems = (tetRaw?.items ?? []) as { id: string; text: string }[];
      sections.push(buildTet(tetItems, trip));

      // י
      const yodRows = (yodRaw?.rows ?? []) as { id: string; lastName: string; firstName: string; class: string; issue: string; notes: string }[];
      sections.push(buildYod(yodRows, trip));

      openTripPrintWindow(sections, `תיק טיול — ${trip?.name ?? ""}`);

      // Open PDFs separately (each in own tab)
      window.open("/appendices-print.pdf", "_blank");
    } finally {
      setState("idle");
    }
  }

  return (
    <button
      onClick={handlePrint}
      disabled={state === "loading"}
      className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-[var(--radius-sm)] hover:bg-primary/90 transition-colors disabled:opacity-60"
    >
      {state === "loading" ? (
        "מכין..."
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          הדפס תיק טיול
        </>
      )}
    </button>
  );
}

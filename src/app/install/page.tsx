import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "התקן את האפליקציה — תיק טיול",
};

export default function InstallPage() {
  return <InstallClient />;
}

// ─── Client component (needs window / navigator) ──────────────────────────────

import { InstallClient } from "./install-client";

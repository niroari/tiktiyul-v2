import type { Metadata } from "next";
import { QuickGimelClient } from "./quick-gimel-client";

export const metadata: Metadata = { title: "נספח ג׳ — כתב מינוי לאחראי/ת טיול" };

export default function Page() {
  return <QuickGimelClient />;
}

import type { Metadata } from "next";
import { QuickGimelClient } from "../quick-gimel-client";

export const metadata: Metadata = { title: "נספח ג׳ — כתב מינוי לאחראי/ת טיול" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuickGimelClient savedId={id} />;
}

import type { Metadata } from "next";
import { QuickBusCheckClient } from "../quick-bus-check-client";

export const metadata: Metadata = { title: 'בדיקת אוטובוס לפני היציאה לטיול' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuickBusCheckClient savedId={id} />;
}

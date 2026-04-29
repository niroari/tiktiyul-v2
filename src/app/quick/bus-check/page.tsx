import type { Metadata } from "next";
import { QuickBusCheckClient } from "./quick-bus-check-client";

export const metadata: Metadata = { title: 'בדיקת אוטובוס לפני היציאה לטיול' };

export default function Page() {
  return <QuickBusCheckClient />;
}

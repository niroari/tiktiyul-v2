import type { Metadata } from "next";
import { AppendixBusCheckClient } from "./appendix-bus-check-client";

export const metadata: Metadata = { title: 'נספח ט"ו — בדיקת אוטובוס לפני היציאה לטיול' };

export default function Page() {
  return <AppendixBusCheckClient />;
}

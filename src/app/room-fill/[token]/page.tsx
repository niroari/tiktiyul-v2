import type { Metadata } from "next";
import { RoomFillClient } from "./room-fill-client";

export const metadata: Metadata = {
  title: "שיבוץ תלמידים לחדרים",
  description: "תיק טיול",
  openGraph: {
    title: "שיבוץ תלמידים לחדרים",
    description: "תיק טיול",
    type: "website",
    locale: "he_IL",
  },
  twitter: {
    card: "summary_large_image",
    title: "שיבוץ תלמידים לחדרים",
    description: "תיק טיול",
  },
};

export default function RoomFillPage() {
  return <RoomFillClient />;
}

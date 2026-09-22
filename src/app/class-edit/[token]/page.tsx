import type { Metadata } from "next";
import { ClassEditClient } from "./class-edit-client";

export const metadata: Metadata = {
  title: "עדכון פרטי תלמידים לטיול",
  description: "תיק טיול",
  openGraph: {
    title: "עדכון פרטי תלמידים לטיול",
    description: "תיק טיול",
    type: "website",
    locale: "he_IL",
  },
  twitter: {
    card: "summary_large_image",
    title: "עדכון פרטי תלמידים לטיול",
    description: "תיק טיול",
  },
};

export default function ClassEditPage() {
  return <ClassEditClient />;
}

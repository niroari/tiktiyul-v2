import type { Metadata } from "next";
import { SignClient } from "./sign-client";

export const metadata: Metadata = {
  title: "מסמכים מוכנים לחתימה עבורך",
  description: "תיק טיול",
  openGraph: {
    title: "מסמכים מוכנים לחתימה עבורך",
    description: "תיק טיול",
    type: "website",
    locale: "he_IL",
  },
  twitter: {
    card: "summary_large_image",
    title: "מסמכים מוכנים לחתימה עבורך",
    description: "תיק טיול",
  },
};

export default function SignPage() {
  return <SignClient />;
}

import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-sans",
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "תיק טיול",
  description: "ניהול תיק טיול לבתי ספר",
  openGraph: {
    title: "תיק טיול",
    description: "ניהול תיק טיול לבתי ספר",
    type: "website",
    locale: "he_IL",
  },
  twitter: {
    card: "summary_large_image",
    title: "תיק טיול",
    description: "ניהול תיק טיול לבתי ספר",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

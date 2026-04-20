import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-sans",
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "תיק טיול",
  description: "ניהול תיק טיול לבתי ספר",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "תיק טיול",
  },
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
      <head>
        <link rel="apple-touch-icon" href="/icon-180.png" />
        <meta name="theme-color" content="#1b4332" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SwRegister />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

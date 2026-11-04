import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/components/auth-provider";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

const alef = localFont({
  src: [
    {
      path: "./fonts/Alef-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/Alef-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tiktiyul-v2.vercel.app"),
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
    <html lang="he" dir="rtl" className={`${alef.variable} h-full antialiased`}>
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

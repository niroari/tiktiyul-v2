import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "תיק טיול",
    short_name: "תיק טיול",
    description: "ניהול תיק טיול לבתי ספר",
    start_url: "/",
    display: "standalone",
    background_color: "#f6faf8",
    theme_color: "#1b4332",
    lang: "he",
    dir: "rtl",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

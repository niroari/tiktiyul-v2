import { ImageResponse } from "next/og";

export const alt = "תיק טיול — ניהול תיק טיול לבתי ספר";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1b4332",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          gap: 24,
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 96,
            height: 96,
            background: "rgba(255,255,255,0.15)",
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            color: "white",
            fontSize: 80,
            fontWeight: 700,
            letterSpacing: "-1px",
            lineHeight: 1,
          }}
        >
          תיק טיול
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 32,
            fontWeight: 400,
          }}
        >
          ניהול תיק טיול לבתי ספר
        </div>
      </div>
    ),
    { ...size }
  );
}

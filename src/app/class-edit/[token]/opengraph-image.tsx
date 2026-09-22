import { ImageResponse } from "next/og";

export const alt = "עדכון פרטי תלמידים לטיול — תיק טיול";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function rtl(s: string) {
  return [...s].reverse().join("");
}

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
        {/* Clipboard / Checklist Icon */}
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
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            color: "white",
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: "-0.5px",
            lineHeight: 1.1,
            textAlign: "center",
            padding: "0 40px",
          }}
        >
          {rtl("עדכון פרטי תלמידים לטיול")}
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 32,
            fontWeight: 400,
          }}
        >
          {rtl("תיק טיול")}
        </div>
      </div>
    ),
    { ...size }
  );
}

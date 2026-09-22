import { ImageResponse } from "next/og";

export const alt = "מסמכים מוכנים לחתימה עבורך — תיק טיול";
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
        {/* Pen / Signature Icon */}
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
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            color: "white",
            fontSize: 60,
            fontWeight: 700,
            letterSpacing: "-0.5px",
            lineHeight: 1.1,
            textAlign: "center",
            padding: "0 40px",
          }}
        >
          {rtl("מסמכים מוכנים לחתימה עבורך")}
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

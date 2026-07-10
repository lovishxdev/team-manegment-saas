import { ImageResponse } from "next/og";

export const alt =
  "Euclis — project memory for teams and AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "linear-gradient(135deg, #fafafa 0%, #f0ebe3 40%, #e8e4f8 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#1a1a1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            E
          </div>
          <span style={{ fontSize: 36, fontWeight: 700, color: "#1a1a1a" }}>
            Euclis
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.1,
              color: "#1a1a1a",
              maxWidth: 920,
            }}
          >
            Project memory for teams and AI agents
          </div>
          <div style={{ fontSize: 26, color: "#444", maxWidth: 820 }}>
            Capture from WhatsApp, Claude, Cursor & web — one brief everyone shares
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {["Memory", "Dreaming", "MCP", "Free Hobby"].map((label) => (
            <div
              key={label}
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
                border: "1px solid #ddd",
                fontSize: 20,
                color: "#333",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}

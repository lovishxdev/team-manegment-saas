"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown in the root layout itself. Replaces the whole document,
 * so it must render its own <html>/<body> and cannot rely on app CSS being present.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#faf9f7",
          color: "#1a1a1a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.8125rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#9a938a",
              margin: 0,
            }}
          >
            Something went wrong
          </p>
          <h1
            style={{
              margin: "0.5rem 0 0",
              fontSize: "1.75rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            This page hit a snag
          </h1>
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.9375rem",
              lineHeight: 1.5,
              color: "#57534e",
            }}
          >
            An unexpected error occurred. You can try again, or reload the page.
          </p>
          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "0.5rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                appearance: "none",
                border: "none",
                cursor: "pointer",
                borderRadius: "0.5rem",
                background: "#1a1a1a",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 500,
                padding: "0.625rem 1rem",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                borderRadius: "0.5rem",
                border: "1px solid #e0dcd5",
                background: "#fff",
                color: "#1a1a1a",
                fontSize: "0.875rem",
                fontWeight: 500,
                padding: "0.625rem 1rem",
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
          {error.digest ? (
            <p
              style={{
                marginTop: "1rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.6875rem",
                color: "#9a938a",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}

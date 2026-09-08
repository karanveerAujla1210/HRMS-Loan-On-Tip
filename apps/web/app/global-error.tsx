"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] fatal error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          background: "#f4f5f9",
          color: "#1a2236",
        }}
      >
        <div style={{ textAlign: "center", padding: 24, maxWidth: 480 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#667085", marginBottom: 20 }}>
            The application failed to load. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              background: "#e85534",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
"use client";

import React from "react";

/** Small inline spinner for buttons and inline loading states. */
export function Spinner({
  size = 16,
  className = "",
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`spinner ${className}`}
      role="status"
      aria-label="Loading"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid var(--border, #d4d4d8)",
        borderTopColor: "var(--primary, #2563eb)",
        borderRadius: "50%",
        animation: "spinnerRotate 0.7s linear infinite",
        verticalAlign: "-2px",
        ...style,
      }}
    />
  );
}

/** Standard button label while a mutation is in flight. */
export function LoadingLabel({
  loading,
  idle,
  busy = "Working…",
}: {
  loading: boolean;
  idle: string;
  busy?: string;
}) {
  return (
    <>
      {loading && <Spinner size={14} style={{ marginRight: 6 }} />} {loading ? busy : idle}
    </>
  );
}

/** Full-area centered spinner used while whole panels load. */
export function CenterSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 32 }}
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner size={20} />
      <span style={{ color: "var(--text-3, #71717a)", fontSize: 14 }}>{label}</span>
    </div>
  );
}

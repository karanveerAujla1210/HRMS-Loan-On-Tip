"use client";

import React from "react";

interface SkeletonProps {
  variant?: "text" | "circular" | "rectangular" | "card" | "table-row" | "stat";
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
  animation?: "pulse" | "wave" | "none";
}

export function Skeleton({
  variant = "text",
  width = "100%",
  height,
  className = "",
  style,
  animation = "wave",
}: SkeletonProps) {
  const baseStyles: React.CSSProperties = {
    background: animation === "none"
      ? "var(--border)"
      : "linear-gradient(90deg, var(--border-light) 25%, var(--border) 50%, var(--border-light) 75%)",
    backgroundSize: animation === "wave" ? "200% 100%" : "auto",
    borderRadius: 4,
    animation: animation === "wave" ? "skeletonShimmer 1.5s infinite" : animation === "pulse" ? "skeletonPulse 1.5s infinite ease-in-out" : "none",
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    text: { height: height || 14, width, borderRadius: 4 },
    circular: { width: width || 40, height: height || 40, borderRadius: "50%" },
    rectangular: { width, height: height || 100, borderRadius: 8 },
    card: { width: "100%", height: height || 120, borderRadius: "var(--radius)" },
    "table-row": { width: "100%", height: height || 56, borderRadius: 0 },
    stat: { width: "100%", height: height || 100, borderRadius: "var(--radius)" },
  };

  return (
    <div
      className={`skeleton ${className}`}
      style={{ ...baseStyles, ...variantStyles[variant], ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, width = "100%", gap = 8 }: { lines?: number; width?: string | number; gap?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? "60%" : width} />
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <Skeleton variant="text" width="40%" height={20} />
      <SkeletonText lines={lines} />
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="stat-card skeleton stat" style={{ padding: "18px 20px" }}>
      <Skeleton variant="text" width="80px" height={11} style={{ marginBottom: 8 }} />
      <Skeleton variant="text" width="60px" height={28} style={{ margin: "8px 0 4px" }} />
      <Skeleton variant="text" width="100px" height={12} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-wrap">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} style={{ padding: "10px 16px", textAlign: "left" }}>
                <Skeleton variant="text" width="80px" height={10} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} style={{ padding: "12px 16px" }}>
                  <Skeleton variant="text" width={colIndex === 0 ? "120px" : "80px"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonList({ items = 5, avatar = true, lines = 2 }: { items?: number; avatar?: boolean; lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {avatar && <Skeleton variant="circular" width={40} height={40} />}
          <SkeletonText lines={lines} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="page-body">
      {/* Stats grid skeleton */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Secondary stats skeleton */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Dashboard grid skeleton */}
      <div className="dashboard-grid">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="page-header">
      <div className="page-title">
        <Skeleton variant="text" width="200px" height={28} />
        <Skeleton variant="text" width="300px" height={14} style={{ marginTop: 4 }} />
      </div>
      <div className="header-actions">
        <Skeleton variant="rectangular" width={100} height={36} />
        <Skeleton variant="rectangular" width={100} height={36} />
      </div>
    </div>
  );
}
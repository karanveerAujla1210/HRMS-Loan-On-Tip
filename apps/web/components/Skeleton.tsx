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
  const variantClasses: Record<string, string> = {
    text: "h-[14px] w-full rounded-sm",
    circular: "rounded-full",
    rectangular: "rounded-md",
    card: "rounded-xl",
    "table-row": "rounded-none",
    stat: "rounded-xl",
  };

  const heightClass = typeof height === "number" ? `h-[${height}px]` : (height ? `h-[${height}]` : "");

  // Use Tailwind's animate-pulse when animation is "pulse", otherwise use a custom
  // gradient shimmer (wave) via Tailwind utilities.
  const animClass =
    animation === "none"
      ? ""
      : animation === "pulse"
      ? "animate-pulse"
      : "bg-gradient-to-r from-border-light via-border to-border-light bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]";

  return (
    <div
      className={`skeleton ${variantClasses[variant] ?? ""} ${animClass} ${className}`}
      style={{
        width: typeof width === "number" ? width : width,
        ...heightClass ? { height } : {},
        ...style,
      }}
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
    <div className="card bg-surface/50 dark:bg-gray-800/50 border border-border animate-pulse">
      <Skeleton variant="text" width="40%" height={20} />
      <SkeletonText lines={lines} />
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="stat-card skeleton stat bg-surface/50 dark:bg-gray-800/50 border border-border animate-pulse p-4">
      <Skeleton variant="text" width="80px" height={11} className="mb-2" />
      <Skeleton variant="text" width="60px" height={28} className="mt-2 mb-1" />
      <Skeleton variant="text" width="100px" height={12} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-wrap">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-2 text-left">
                <Skeleton variant="text" width="80px" height={10} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-3 py-3">
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
    <div className="flex flex-col gap-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex gap-3 items-start">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Secondary stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Dashboard grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
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
        <Skeleton variant="text" width="300px" height={14} className="mt-1" />
      </div>
      <div className="header-actions flex items-center gap-2">
        <Skeleton variant="rectangular" width={100} height={36} />
        <Skeleton variant="rectangular" width={100} height={36} />
      </div>
    </div>
  );
}
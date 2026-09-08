"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SubNavItem = {
  href: string;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
  exact?: boolean;
};

export default function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="subnav-tabs" aria-label="Sub navigation" style={{ 
      display: "flex", 
      gap: 6, 
      padding: "0 32px", 
      background: "var(--surface)", 
      borderBottom: "1px solid var(--border)", 
      overflowX: "auto" 
    }}>
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`subnav-tab ${isActive ? "active" : ""}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px",
              fontSize: "13.5px",
              fontWeight: 500,
              color: isActive ? "var(--brand)" : "var(--text-2)",
              textDecoration: "none",
              borderBottom: `2px solid ${isActive ? "var(--brand)" : "transparent"}`,
              transition: "color 0.15s, border-color 0.15s, background 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--text)";
              e.currentTarget.style.background = "rgba(0, 0, 0, 0.02)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--text-2)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            {item.icon && <span className="subnav-tab-icon">{item.icon}</span>}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="subnav-badge" style={{
                background: isActive ? "var(--brand-light)" : "var(--bg)",
                color: isActive ? "var(--brand)" : "var(--text-2)",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 12,
              }}>
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
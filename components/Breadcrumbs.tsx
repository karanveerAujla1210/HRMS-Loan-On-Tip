"use client";

import React from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
}

export default function Breadcrumbs({ items, separator = "/" }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: 8 }}>
      <ol className="breadcrumb-list" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", listStyle: "none", gap: 6, fontSize: 12 }}>
        {items.map((item, index) => (
          <li key={item.label} className="breadcrumb-item" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {index > 0 && (
              <span className="breadcrumb-separator" style={{ color: "var(--text-4)", fontSize: 11 }}>{separator}</span>
            )}
            {item.href && !item.active ? (
              <Link href={item.href} className="breadcrumb-link" style={{ color: "var(--text-3)", textDecoration: "none", transition: "color 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--brand)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-3)"}>
                {item.label}
              </Link>
            ) : (
              <span className={`breadcrumb-current ${item.active ? "active" : ""}`} style={{ color: item.active ? "var(--brand)" : "var(--text-2)", fontWeight: item.active ? 600 : 500 }}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
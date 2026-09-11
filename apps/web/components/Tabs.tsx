"use client";

import React from "react";

export interface TabItem<K extends string> {
  key: K;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps<K extends string> {
  items: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Segmented tab control used across feature pages (leave, self-service,
 * reports, organisation …) for a consistent, accessible pill switcher.
 */
export function Tabs<K extends string>({
  items,
  active,
  onChange,
  className = "",
  ariaLabel = "Tabs",
}: TabsProps<K>) {
  return (
    <div className={`seg ${className}`} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            className={`seg-btn ${isActive ? "active" : ""}`}
            onClick={() => onChange(item.key)}
          >
            {item.icon && <span className="seg-icon">{item.icon}</span>}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="seg-count">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
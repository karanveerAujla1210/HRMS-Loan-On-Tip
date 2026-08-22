"use client";

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
    <nav className="subnav-tabs" aria-label="Sub navigation">
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`subnav-tab${isActive ? " active" : ""}`}
          >
            {item.icon && <span className="subnav-tab-icon">{item.icon}</span>}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="subnav-badge">{item.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

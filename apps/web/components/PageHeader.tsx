"use client";

import React from "react";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  badge,
  meta,
  icon,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`page-header ${className}`} role="banner">
      <div className="page-title-wrap">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} />
        )}
        <div className="page-heading-row">
          {icon && <span className="page-icon">{icon}</span>}
          <h1 className="page-main-heading">{title}</h1>
          {badge && <div className="page-heading-badge">{badge}</div>}
        </div>
        {(subtitle || meta) && (
          <div className="page-subtitle-row">
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
            {meta && <div className="page-meta">{meta}</div>}
          </div>
        )}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

export default PageHeader;
"use client";

import React from "react";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`page-header ${className}`}>
      <div className="page-title">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  );
}
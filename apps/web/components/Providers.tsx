"use client";

import { ToastProvider } from "@/components/Toast";
import RouteProgress from "@/components/RouteProgress";
import SessionKeeper from "@/components/SessionKeeper";
import { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SessionKeeper />
      <RouteProgress />
      {children}
    </ToastProvider>
  );
}
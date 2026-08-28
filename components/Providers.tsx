"use client";

import { ToastProvider } from "@/components/Toast";
import { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
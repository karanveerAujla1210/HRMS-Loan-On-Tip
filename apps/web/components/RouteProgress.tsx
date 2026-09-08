"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Slim top progress bar shown whenever the route changes.
 *
 * The App Router renders the new page only after its data is ready, which can
 * take a moment on slower connections; this gives the user immediate feedback
 * when navigating between pages.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Route changed — run a quick animation so navigation feels responsive.
    setVisible(true);
    setProgress(20);
    const grow = setTimeout(() => setProgress(70), 120);
    const done = setTimeout(() => setProgress(100), 350);
    const hide = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 500);
    return () => {
      clearTimeout(grow);
      clearTimeout(done);
      clearTimeout(hide);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--primary, #2563eb), var(--primary-dark, #1d4ed8))",
          transition: "width 200ms ease-out",
          borderRadius: "0 2px 2px 0",
        }}
      />
    </div>
  );
}

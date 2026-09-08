"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for observability tooling (Sentry etc.) once wired up.
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <div className="error-boundary" role="alert">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h1>Something went wrong</h1>
      <p>
        An unexpected error occurred while loading this page. Your work has not been lost —
        you can try again or return to the dashboard.
      </p>
      {error.digest && (
        <p className="error-digest">
          Error reference: <code>{error.digest}</code>
        </p>
      )}
      <div className="error-actions">
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="error-boundary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="8.5" y1="11" x2="13.5" y2="11" />
      </svg>
      <h1>Page not found</h1>
      <p>
        The page you are looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="error-actions">
        <Link href="/dashboard" className="btn btn-primary">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
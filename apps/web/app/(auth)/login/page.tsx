"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { MOBILE_APP_DOWNLOAD_PATH, MOBILE_APP_VERSION } from "@/lib/mobile-app";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError("Sign in failed. Check your credentials and try again.");
      setLoading(false);
      return;
    }
    // Hard refresh navigation ensures @supabase/ssr session cookies are sent to Next.js middleware
    window.location.href = "/dashboard";
  }

  async function handleMagicLink() {
    if (!email) { setError("Enter your email first."); return; }
    if (loading) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    if (error) { setError("Could not send the magic link. Please try again."); setLoading(false); return; }
    setOtpSent(true);
    setLoading(false);
  }

  if (otpSent) {
    return (
      <div className="login-page">
        <div className="login-shell">
          <LoginHero />
          <main className="login-panel">
            <div className="login-card">
              <div className="login-brand">
                <Image src="/logo.png" alt="Loan On Tip Logo" width={40} height={40} className="brand-logo" />
                <div>
                  <strong>Loan On Tip</strong>
                  <span>ACG Leasing Limited</span>
                </div>
              </div>

              <h2>Check your inbox</h2>
              <p>We emailed a magic sign-in link to you.</p>

              <div className="alert alert-success" role="status">
                Magic link sent to <strong>{email}</strong>. Open the link in the email to sign in instantly.
              </div>
              <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setOtpSent(false)}>
                Back to sign in
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <LoginHero />
        <main className="login-panel">
          <div className="login-card">
            <div className="login-brand">
              <Image src="/logo.png" alt="Loan On Tip Logo" width={40} height={40} className="brand-logo" />
              <div>
                <strong>Loan On Tip</strong>
                <span>ACG Leasing Limited</span>
              </div>
            </div>

            <h2>Sign in to HRMS</h2>
            <p>Enter your work email and password to continue.</p>

            {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-with-action">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 4 }} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="login-form-divider">or continue with</div>

        <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handleMagicLink} disabled={loading}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Send magic link
        </button>

        <div className="mobile-app-download">
          <div className="mobile-app-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </div>
          <div className="mobile-app-copy">
            <strong>Get the HRMS mobile app</strong>
            <span>Android APK · Version {MOBILE_APP_VERSION}</span>
          </div>
          <a className="btn btn-download" href={MOBILE_APP_DOWNLOAD_PATH} download>
            Download APK
          </a>
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}

function LoginHero() {
  return (
    <aside className="login-hero" aria-hidden="true">
      <div className="login-brand login-brand--hero">
        <Image src="/logo.png" alt="" width={46} height={46} className="brand-logo" />
        <div>
          <strong>Loan On Tip</strong>
          <span>ACG Leasing Limited</span>
        </div>
      </div>

      <h1>
        People operations, <span className="text-gradient">simplified.</span>
      </h1>
      <p>
        Attendance, leave, payroll, assets and self-service — one secure workspace
        for the entire ACG Leasing workforce.
      </p>

      <ul className="login-features">
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
          Real-time attendance with geofenced check-ins
        </li>
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
          One-click leave requests &amp; smart approval flows
        </li>
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
          Digital payslips, asset tracking &amp; HR helpdesk
        </li>
      </ul>

      <div className="login-hero-stats">
        <div>
          <strong>24×7</strong>
          <span>Workforce support</span>
        </div>
        <div>
          <strong>100%</strong>
          <span>Digital &amp; paperless</span>
        </div>
        <div>
          <strong>1 app</strong>
          <span>Web + Android</span>
        </div>
      </div>
    </aside>
  );
}

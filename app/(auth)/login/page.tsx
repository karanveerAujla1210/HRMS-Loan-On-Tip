"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { MOBILE_APP_DOWNLOAD_PATH, MOBILE_APP_VERSION } from "@/lib/mobile-app";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@loanontip.com");
  const [password, setPassword] = useState("LOT@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Hard refresh navigation ensures @supabase/ssr session cookies are sent to Next.js middleware
    window.location.href = "/dashboard";
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError("Enter your email first."); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    if (error) { setError(error.message); setLoading(false); return; }
    setOtpSent(true);
    setLoading(false);
  }

  function quickLogin(roleEmail: string) {
    setEmail(roleEmail);
    setPassword("LOT@123");
  }

  if (otpSent) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <Image src="/logo.png" alt="Loan On Tip Logo" width={48} height={48} className="brand-logo" />
            <div>
              <strong>Loan On Tip</strong>
              <span>ACG Leasing Limited</span>
            </div>
          </div>
          <div className="alert alert-success">
            Magic link sent to <strong>{email}</strong>. Check your inbox and click the link to sign in.
          </div>
          <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setOtpSent(false)}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">L</div>
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
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password (Default: LOT@123)</label>
            <input
              id="password"
              type="password"
              placeholder="LOT@123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 4 }} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in with LOT@123"}
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 11, color: "var(--text-4)", fontWeight: 600, textTransform: "uppercase" }}>
            Quick Demo Credentials:
          </span>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => quickLogin("admin@loanontip.com")}>
              Admin
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => quickLogin("deepak.kumar@loanontip.com")}>
              Deepak Kumar
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => quickLogin("naveen.bhilwara@loanontip.com")}>
              Naveen Bhilwara
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", margin: "16px 0", color: "var(--text-4)", fontSize: 12 }}>or</div>

        <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handleMagicLink} disabled={loading}>
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
    </div>
  );
}

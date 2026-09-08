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
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-mark">L</div>
            <div>
              <strong>Loan On Tip</strong>
              <span>ACG Leasing Limited</span>
            </div>
          </div>
          <div className="alert alert-success" role="status">
            Magic link sent to <strong>{email}</strong>. Check your inbox and click the link to sign in.
          </div>
          <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setOtpSent(false)}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <Image src="/logo.png" alt="Loan On Tip Logo" width={84} height={84} className="brand-logo" />
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 6h20M2 18h20M6 6v12M18 6v12" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3v18" /><path d="M5 9a7 2.5 0 0 1 14 9" /></svg>
                )}
              </button>
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 4 }} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

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

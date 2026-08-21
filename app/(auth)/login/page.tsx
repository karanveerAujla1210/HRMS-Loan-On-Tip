"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError("Enter your email first."); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) { setError(error.message); setLoading(false); return; }
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
              placeholder="you@acgleasing.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 4 }} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div style={{ textAlign: "center", margin: "16px 0", color: "var(--text-4)", fontSize: 12 }}>or</div>

        <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handleMagicLink} disabled={loading}>
          Send magic link
        </button>
      </div>
    </div>
  );
}

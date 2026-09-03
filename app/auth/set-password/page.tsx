"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Supabase invite links redirect here with #access_token=...&type=invite in
  // the URL hash. The JS client parses the hash automatically and fires
  // SIGNED_IN. We wait for that before showing the form.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
        return;
      }
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") && session) {
          setReady(true);
          listener.subscription.unsubscribe();
        }
      });
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setLoading(false); return; }
    router.replace("/dashboard");
  }

  if (!ready) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-mark">L</div>
            <div><strong>Loan On Tip</strong><span>ACG Leasing Limited</span></div>
          </div>
          <div className="loading-spinner" style={{ minHeight: 80 }}>
            <div className="spinner" /> Verifying invite link…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">L</div>
          <div><strong>Loan On Tip</strong><span>ACG Leasing Limited</span></div>
        </div>

        <h2>Set your password</h2>
        <p>Choose a password to activate your HRMS account.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 4 }}
            type="submit"
            disabled={loading}
          >
            {loading ? "Saving…" : "Set password & sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

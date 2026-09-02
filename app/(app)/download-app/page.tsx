"use client";

import PageHeader from "@/components/PageHeader";

export default function DownloadAppPage() {
  return (
    <>
      <PageHeader
        title="Install Mobile App"
        subtitle="Add Loan On Tip HRMS to your phone home screen"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Install App" }]}
      />
      <div className="page-body">
        <div className="card" style={{ maxWidth: 560, margin: "0 auto", padding: "32px 28px" }}>
          <div style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>📱</div>
          <h2 style={{ textAlign: "center", marginBottom: 8 }}>Loan On Tip HRMS</h2>
          <p style={{ textAlign: "center", color: "var(--text-3)", marginBottom: 28 }}>
            This is a Progressive Web App (PWA). Install it directly from your browser — no APK or app store needed.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card" style={{ padding: 20, background: "var(--bg)" }}>
              <div style={{ fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>🤖</span> Android (Chrome)
              </div>
              <ol style={{ paddingLeft: 20, margin: 0, fontSize: 14, color: "var(--text-2)", lineHeight: 1.8 }}>
                <li>Open this website in <strong>Chrome</strong></li>
                <li>Tap the <strong>⋮ menu</strong> (top right)</li>
                <li>Tap <strong>&quot;Add to Home screen&quot;</strong></li>
                <li>Tap <strong>Add</strong> — done!</li>
              </ol>
            </div>

            <div className="card" style={{ padding: 20, background: "var(--bg)" }}>
              <div style={{ fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>🍎</span> iPhone / iPad (Safari)
              </div>
              <ol style={{ paddingLeft: 20, margin: 0, fontSize: 14, color: "var(--text-2)", lineHeight: 1.8 }}>
                <li>Open this website in <strong>Safari</strong></li>
                <li>Tap the <strong>Share</strong> button (box with arrow)</li>
                <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></li>
                <li>Tap <strong>Add</strong> — done!</li>
              </ol>
            </div>

            <div className="alert alert-info" style={{ fontSize: 13 }}>
              Once installed, the app opens full-screen like a native app with offline support, fast loading and push notifications.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

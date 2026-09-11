export default function AppLoading() {
  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Page Header Skeleton */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderBottom: "1px solid var(--border)",
        background: "var(--surface)", minHeight: 64,
      }}>
        <div>
          <div className="skeleton" style={{ width: 200, height: 22, borderRadius: 6, marginBottom: 6 }} />
          <div className="skeleton" style={{ width: 280, height: 13, borderRadius: 4 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ width: 120, height: 34, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 90, height: 34, borderRadius: 8 }} />
        </div>
      </div>

      <div style={{ padding: "24px 24px 0" }}>
        {/* Executive Banner Skeleton */}
        <div className="skeleton" style={{ width: "100%", height: 96, borderRadius: 12, marginBottom: 24 }} />

        {/* Quick Actions Skeleton */}
        <div className="skeleton" style={{ width: "100%", height: 52, borderRadius: 10, marginBottom: 24 }} />

        {/* Primary Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "18px 20px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div className="skeleton" style={{ width: 100, height: 11, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 8 }} />
              </div>
              <div className="skeleton" style={{ width: 70, height: 28, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: 130, height: 11, borderRadius: 4 }} />
            </div>
          ))}
        </div>

        {/* Attendance Bar Skeleton */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="skeleton" style={{ width: 180, height: 11, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 140, height: 11, borderRadius: 4 }} />
          </div>
          <div className="skeleton" style={{ width: "100%", height: 8, borderRadius: 4, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 16 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ width: 80, height: 11, borderRadius: 4 }} />
            ))}
          </div>
        </div>

        {/* Secondary Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "18px 20px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div className="skeleton" style={{ width: 110, height: 11, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 8 }} />
              </div>
              <div className="skeleton" style={{ width: 60, height: 28, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: 120, height: 11, borderRadius: 4 }} />
            </div>
          ))}
        </div>

        {/* Dashboard Tables Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
          {[6, 5].map((rows, ci) => (
            <div key={ci} style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "16px 20px", borderBottom: "1px solid var(--border-light)",
              }}>
                <div>
                  <div className="skeleton" style={{ width: 160, height: 15, borderRadius: 5, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: 100, height: 11, borderRadius: 4 }} />
                </div>
                <div className="skeleton" style={{ width: 80, height: 30, borderRadius: 8 }} />
              </div>
              <div style={{ padding: "0 0 8px" }}>
                {/* Table header */}
                <div style={{ display: "flex", gap: 0, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  {[...Array(ci === 0 ? 5 : 4)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ flex: 1, height: 10, borderRadius: 3, margin: "0 6px" }} />
                  ))}
                </div>
                {/* Table rows */}
                {[...Array(rows)].map((_, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", padding: "12px 16px",
                    borderBottom: i < rows - 1 ? "1px solid var(--border-light)" : "none",
                    gap: 12,
                  }}>
                    <div className="skeleton" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton" style={{ width: "60%", height: 12, borderRadius: 4, marginBottom: 5 }} />
                      <div className="skeleton" style={{ width: "40%", height: 10, borderRadius: 3 }} />
                    </div>
                    <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 10 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

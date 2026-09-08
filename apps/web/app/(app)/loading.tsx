export default function AppLoading() {
  return (
    <div className="page-body" aria-busy="true" aria-live="polite">
      <div className="skeleton skeleton-title" style={{ width: 220, marginBottom: 20 }} />
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="card">
        <div className="card-body" style={{ display: "grid", gap: 12 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton skeleton-table-row" />
          ))}
        </div>
      </div>
    </div>
  );
}
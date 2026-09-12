export default function AppLoading() {
  return (
    <div className="animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface min-h-16">
        <div>
          <div className="h-[22px] w-52 rounded mb-1" />
          <div className="h-[13px] w-72 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-30 rounded" />
          <div className="h-8 w-22 rounded" />
        </div>
      </div>

      {/* Executive Banner Skeleton */}
      <div className="h-24 w-full rounded-xl mb-6" />

      {/* Quick Actions Skeleton */}
      <div className="h-13 w-full rounded-lg mb-6" />

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-5">
            <div className="flex justify-between mb-3">
              <div className="h-[11px] w-25 rounded" />
              <div className="h-8 w-8 rounded" />
            </div>
            <div className="h-7 w-18 rounded mb-2" />
            <div className="h-[11px] w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Attendance Bar Skeleton */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-6">
        <div className="flex justify-between mb-2">
          <div className="h-[11px] w-45 rounded" />
          <div className="h-[11px] w-35 rounded" />
        </div>
        <div className="h-2 w-full rounded mb-2" />
        <div className="flex gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-[11px] w-20 rounded" />
          ))}
        </div>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-5">
            <div className="flex justify-between mb-3">
              <div className="h-[11px] w-28 rounded" />
              <div className="h-8 w-8 rounded" />
            </div>
            <div className="h-7 w-15 rounded mb-2" />
            <div className="h-[11px] w-30 rounded" />
          </div>
        ))}
      </div>

      {/* Dashboard Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        {[6, 5].map((rows, ci) => (
          <div key={ci} className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-border-light">
              <div>
                <div className="h-[15px] w-40 rounded mb-1" />
                <div className="h-[11px] w-25 rounded" />
              </div>
              <div className="h-7 w-20 rounded" />
            </div>
            <div className="p-0">
              <div className="flex gap-0 px-4 py-2 border-b border-border">
                {[...Array(ci === 0 ? 5 : 4)].map((_, i) => (
                  <div key={i} className="h-2 flex-1 mx-[6px] rounded" />
                ))}
              </div>
              {[...Array(rows)].map((_, i) => (
                <div key={i} className="flex items-center px-4 py-3 border-b border-border-light last:border-b-0 gap-3">
                  <div className="w-7 h-7 rounded-full flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-[12px] w-3/5 rounded mb-1" />
                    <div className="h-[10px] w-2/5 rounded" />
                  </div>
                  <div className="h-5 w-15 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

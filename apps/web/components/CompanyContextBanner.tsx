"use client";

import { useEffect, useState } from "react";
import { COMPANY_CONTEXT_EVENT, useProfile } from "@/hooks/useProfile";
import { fetchCompanyById } from "@/features/system/queries";

/**
 * Banner shown when a Super Admin has switched the organizational context to
 * a specific company. Reminds them that admin writes still resolve to their
 * home company while reads are scoped to the selected organization.
 */
export default function CompanyContextBanner() {
  const { isSuperAdmin, companyId, activeCompanyId } = useProfile();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin || !activeCompanyId) { setName(null); return; }
    let cancelled = false;
    void (async () => {
      const c = await fetchCompanyById(activeCompanyId);
      if (!cancelled) setName(c?.display_name ?? c?.company_code ?? "this company");
    })();
    const onSwitch = () => setName(null);
    window.addEventListener(COMPANY_CONTEXT_EVENT, onSwitch);
    return () => { cancelled = true; window.removeEventListener(COMPANY_CONTEXT_EVENT, onSwitch); };
  }, [isSuperAdmin, activeCompanyId]);

  if (!isSuperAdmin || !activeCompanyId) return null;
  const scoped = activeCompanyId !== companyId;

  return (
    <div
      role="status"
      style={{
        margin: "0 16px 12px",
        padding: "10px 14px",
        borderRadius: 8,
        display: "flex",
        gap: 8,
        alignItems: "center",
        fontSize: 13,
        background: scoped ? "var(--amber-bg, #fff7e0)" : "var(--blue-bg, #eef4ff)",
      }}
    >
      <span style={{ marginRight: 8 }}>{scoped ? "👁" : "🏢"}</span>
      <span>
        <strong>Organization context:</strong> {scoped ? `Viewing ${name ?? "selected company"}` : `Viewing ${name ?? "this company"}`}
      </span>
      {scoped && (
        <span style={{ opacity: 0.75, fontSize: 12 }}>
          · Admin writes still apply to your home company
        </span>
      )}
    </div>
  );
}
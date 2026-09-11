"use client";

import { useEffect, useState } from "react";
import { fetchCompanies } from "@/features/system/queries";
import { COMPANY_CONTEXT_EVENT, useProfile } from "@/hooks/useProfile";

type Company = { id: string; company_code: string; display_name: string };

/**
 * Super Admin organizational-context switcher. Renders nothing for users
 * without the SUPER_ADMIN role. Selecting a company narrows every admin page
 * and API route to that organization; the home company is the default.
 */
export default function CompanySwitcher() {
  const { isSuperAdmin, companyId, activeCompanyId, setActiveCompany } = useProfile();
  const [companies, setCompanies] = useState<Company[]>([]);
  // Track external switches so the select stays in sync with the hook state.
  const [syncTick, setSyncTick] = useState(0);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    void (async () => {
      const rows = await fetchCompanies();
      if (!cancelled) setCompanies(rows);
    })();
    const onChange = () => setSyncTick((t) => t + 1);
    window.addEventListener(COMPANY_CONTEXT_EVENT, onChange);
    return () => { cancelled = true; window.removeEventListener(COMPANY_CONTEXT_EVENT, onChange); };
  }, [isSuperAdmin, syncTick]);

  if (!isSuperAdmin) return null;

  const value = activeCompanyId ?? companyId ?? "";

  return (
    <div style={{ padding: "0 12px 8px" }}>
      <label
        htmlFor="company-context"
        style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-4)", margin: "8px 0 4px" }}
      >
        Viewing
      </label>
      <select
        id="company-context"
        className="form-input"
        value={value}
        onChange={(e) => setActiveCompany(e.target.value || null)}
        style={{ width: "100%", fontSize: 13 }}
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.display_name || c.company_code}
            {c.id === companyId ? " (home)" : c.id === value ? " (current)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

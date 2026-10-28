"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";

const ACTIVE_COMPANY_KEY = "lot-hrms-active-company";
/** Fired whenever a Super Admin switches the organizational context. */
export const COMPANY_CONTEXT_EVENT = "lot-hrms:company-context-changed";

type ServerSession = {
  employeeId: string | null;
  displayName: string | null;
  companyId: string | null;
  roles: string[];
  primaryRole: string | null;
};

type ProfileCtx = {
  companyId: string | null;
  employeeId: string | null;
  displayName: string | null;
  role: string | null;
  roles: string[];
  isSuperAdmin: boolean;
  activeCompanyId: string | null;
  loading: boolean;
  error: string | null;
  setActiveCompany: (companyId: string | null) => void;
};

const EMPTY: ProfileCtx = {
  companyId: null, employeeId: null, displayName: null, role: null, roles: [],
  isSuperAdmin: false, activeCompanyId: null,
  loading: true, error: null, setActiveCompany: () => {},
};
const IDLE: ProfileCtx = { ...EMPTY, loading: false };

function rolePrecedence(code: string): number {
  const order = ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "ASSET_ADMIN", "OPERATIONS_ADMIN", "LOCATION_ADMIN", "MANAGER", "EMPLOYEE"];
  const i = order.indexOf(code);
  return i === -1 ? order.length : i;
}

function readActiveCompanyOverride(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_COMPANY_KEY);
  } catch {
    return null;
  }
}

/** Keep the UI preference in localStorage; the server cookie remains authoritative. */
function persistActiveCompany(companyId: string | null) {
  try {
    if (companyId) window.localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
    else window.localStorage.removeItem(ACTIVE_COMPANY_KEY);
  } catch {
    /* storage unavailable — server context still applies for this session */
  }
  void apiFetch(API.auth.companyContext, {
    method: "POST",
    body: JSON.stringify({ companyId }),
  });
}

/**
 * Resolves identity and effective roles from the trusted server session endpoint.
 * Client-side employee_roles queries can be hidden by RLS and incorrectly display
 * an administrator as Employee, so roles must come from the server's verified
 * auth context instead of a browser-side join.
 */
export function useProfile(): ProfileCtx {
  const [ctx, setCtx] = useState<ProfileCtx>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: authData, error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;

        if (sessionError) {
          console.error("[useProfile] failed to read session:", sessionError.message);
          setCtx({ ...IDLE, error: "Could not verify your session. Please refresh." });
          return;
        }

        if (!authData.session) {
          setCtx(IDLE);
          return;
        }

        const response = await apiFetch<ServerSession>(API.auth.session);
        if (cancelled) return;

        if (response.error || !response.data) {
          console.error("[useProfile] failed to resolve server session:", response.error?.code);
          setCtx({ ...IDLE, error: "Could not load your access profile. Please refresh." });
          return;
        }

        const serverProfile = response.data;
        const roles = [...new Set((serverProfile.roles ?? []).filter((role): role is string => typeof role === "string" && role.length > 0))];
        const isSuperAdmin = roles.includes("SUPER_ADMIN");

        // Keep the home-company lookup separate from authorization. A missing or
        // RLS-hidden profile row must never downgrade the server-resolved roles.
        let homeCompanyId = serverProfile.companyId;
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("auth_user_id", authData.session.user.id)
            .maybeSingle<{ company_id: string | null }>();
          if (profile?.company_id) homeCompanyId = profile.company_id;
        } catch {
          // Server session is authoritative for access even if this optional read fails.
        }

        const override = isSuperAdmin ? readActiveCompanyOverride() : null;
        const role = serverProfile.primaryRole ?? [...roles].sort((a, b) => rolePrecedence(a) - rolePrecedence(b))[0] ?? null;

        function setActiveCompany(companyId: string | null) {
          persistActiveCompany(companyId);
          window.dispatchEvent(new CustomEvent(COMPANY_CONTEXT_EVENT, { detail: companyId }));
        }

        if (!cancelled) {
          setCtx({
            companyId: homeCompanyId,
            employeeId: serverProfile.employeeId ?? null,
            displayName: serverProfile.displayName ?? null,
            role,
            roles,
            isSuperAdmin,
            activeCompanyId: isSuperAdmin ? (override ?? homeCompanyId) : homeCompanyId,
            loading: false,
            error: null,
            setActiveCompany,
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[useProfile] unexpected error:", err);
          setCtx({ ...IDLE, error: "Something went wrong. Please refresh." });
        }
      }
    }

    void load();

    function onContextChange() {
      setCtx((prev) =>
        prev.isSuperAdmin ? { ...prev, activeCompanyId: readActiveCompanyOverride() ?? prev.companyId } : prev
      );
    }
    window.addEventListener(COMPANY_CONTEXT_EVENT, onContextChange);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !cancelled) setCtx(IDLE);
      if (event === "SIGNED_IN" && !cancelled) void load();
    });

    return () => {
      cancelled = true;
      window.removeEventListener(COMPANY_CONTEXT_EVENT, onContextChange);
      sub.subscription.unsubscribe();
    };
  }, []);

  return ctx;
}

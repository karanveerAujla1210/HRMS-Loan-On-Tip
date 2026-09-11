"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";

const ACTIVE_COMPANY_KEY = "lot-hrms-active-company";
/** Fired whenever a Super Admin switches the organizational context. */
export const COMPANY_CONTEXT_EVENT = "lot-hrms:company-context-changed";

type ProfileCtx = {
  companyId: string | null;
  employeeId: string | null;
  displayName: string | null;
  role: string | null;
  roles: string[];
  /** True when the user holds the SUPER_ADMIN role. */
  isSuperAdmin: boolean;
  /**
   * Organizational context for reads: the company the admin is currently
   * operating on. Equals `companyId` for everyone except a Super Admin who
   * has switched context via the company switcher.
   */
  activeCompanyId: string | null;
  loading: boolean;
  error: string | null;
  /** Super Admin only: switch the organizational context (null = all companies). */
  setActiveCompany: (companyId: string | null) => void;
};

const EMPTY: ProfileCtx = {
  companyId: null, employeeId: null, displayName: null, role: null, roles: [],
  isSuperAdmin: false, activeCompanyId: null,
  loading: true, error: null, setActiveCompany: () => {},
};
const IDLE: ProfileCtx = { ...EMPTY, loading: false };

function ROLE_PRECEDENCE(code: string): number {
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

/**
 * Persist the switched-company context. The HTTP-only `lot_super_admin_company`
 * cookie is set server-side by `/api/auth/company-context`; localStorage only
 * mirrors it for instant UI reads. API routes resolve the authoritative cookie.
 */
function persistActiveCompany(companyId: string | null) {
  try {
    if (companyId) window.localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
    else window.localStorage.removeItem(ACTIVE_COMPANY_KEY);
  } catch {
    /* storage unavailable — context still applies for this session */
  }
  void apiFetch(API.auth.companyContext, {
    method: "POST",
    body: JSON.stringify({ companyId }),
  });
}

/**
 * Resolves the signed-in user's profile context (company, employee, role).
 * Single source of truth for identity in client components — pages must not
 * re-query `profiles` / `employee_roles` themselves.
 */
export function useProfile(): ProfileCtx {
  const [ctx, setCtx] = useState<ProfileCtx>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;

        if (sessionError) {
          console.error("[useProfile] failed to read session:", sessionError.message);
          setCtx({ ...IDLE, error: "Could not verify your session. Please refresh." });
          return;
        }

        const session = data.session;
        if (!session) {
          setCtx(IDLE);
          return;
        }

        const { data: prof, error: profError } = await supabase
          .from("profiles")
          .select("employee_id,company_id")
          .eq("auth_user_id", session.user.id)
          .single();

        let displayName: string | null = null;
        if (prof?.employee_id) {
          const { data: emp } = await supabase
            .from("employees")
            .select("display_name")
            .eq("id", prof.employee_id)
            .single();
          displayName = (emp as { display_name?: string | null } | null)?.display_name ?? null;
        }

        if (cancelled) return;

        if (profError) {
          console.error("[useProfile] failed to load profile:", profError.message);
          setCtx({ ...IDLE, error: "Could not load your profile. Please refresh." });
          return;
        }

        const roles: string[] = [];
        if (prof?.employee_id) {
          // Collect every active role so SUPER_ADMIN is never masked by a
          // lower-precedence role returned first.
          const { data: roleRows, error: roleError } = await supabase
            .from("employee_roles")
            .select("roles(code)")
            .eq("employee_id", prof.employee_id)
            .eq("is_active", true);

          if (cancelled) return;

          if (!roleError) {
            for (const row of (roleRows ?? []) as unknown as { roles: { code: string } | null }[]) {
              if (row.roles?.code && !roles.includes(row.roles.code)) roles.push(row.roles.code);
            }
          } else {
            console.error("[useProfile] failed to load role:", roleError.message);
          }
        }

        const isSuperAdmin = roles.includes("SUPER_ADMIN");
        const override = isSuperAdmin ? readActiveCompanyOverride() : null;
        const role = [...roles].sort((a, b) => ROLE_PRECEDENCE(a) - ROLE_PRECEDENCE(b))[0] ?? null;

        function setActiveCompany(companyId: string | null) {
          persistActiveCompany(companyId);
          window.dispatchEvent(new CustomEvent(COMPANY_CONTEXT_EVENT, { detail: companyId }));
        }

        if (!cancelled) {
          setCtx({
            companyId: prof?.company_id ?? null,
            employeeId: prof?.employee_id ?? null,
            displayName,
            role,
            roles,
            isSuperAdmin,
            // The organizational context narrows visibility for Super Admins;
            // it always falls back to the home company, so pages can safely
            // alias `activeCompanyId` as their company filter.
            activeCompanyId: isSuperAdmin ? (override ?? (prof?.company_id ?? null)) : (prof?.company_id ?? null),
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

    // Keep every mounted consumer in sync when the context is switched.
    function onContextChange() {
      setCtx((prev) =>
        prev.isSuperAdmin ? { ...prev, activeCompanyId: readActiveCompanyOverride() } : prev
      );
    }
    window.addEventListener(COMPANY_CONTEXT_EVENT, onContextChange);

    // Re-check when the session changes (sign-in from another tab, token refresh, sign-out)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !cancelled) setCtx(IDLE);
      if (event === "SIGNED_IN" && !cancelled) {
        setCtx(EMPTY);
        void load();
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener(COMPANY_CONTEXT_EVENT, onContextChange);
      sub.subscription.unsubscribe();
    };
  }, []);

  return ctx;
}

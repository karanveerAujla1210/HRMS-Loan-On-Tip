"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProfileCtx = {
  companyId: string | null;
  employeeId: string | null;
  role: string | null;
  loading: boolean;
  error: string | null;
};

const EMPTY: ProfileCtx = { companyId: null, employeeId: null, role: null, loading: true, error: null };
const IDLE: ProfileCtx = { companyId: null, employeeId: null, role: null, loading: false, error: null };

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

        if (cancelled) return;

        if (profError) {
          console.error("[useProfile] failed to load profile:", profError.message);
          setCtx({ ...IDLE, error: "Could not load your profile. Please refresh." });
          return;
        }

        let role: string | null = null;
        if (prof?.employee_id) {
          // Try employee_roles first
          const { data: r, error: roleError } = await supabase
            .from("employee_roles")
            .select("roles(code)")
            .eq("employee_id", prof.employee_id)
            .eq("is_active", true)
            .limit(1)
            .single();

          if (cancelled) return;

          if (!roleError) {
            const rd = r as unknown as { roles: { code: string } | null } | null;
            role = rd?.roles?.code ?? null;
          } else {
            console.error("[useProfile] failed to load role:", roleError.message);
          }
        }

        if (!cancelled) {
          setCtx({
            companyId: prof?.company_id ?? null,
            employeeId: prof?.employee_id ?? null,
            role,
            loading: false,
            error: null,
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
      sub.subscription.unsubscribe();
    };
  }, []);

  return ctx;
}

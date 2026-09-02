"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProfileCtx = {
  companyId: string | null;
  employeeId: string | null;
  role: string | null;
  loading: boolean;
};

export function useProfile(): ProfileCtx {
  const [ctx, setCtx] = useState<ProfileCtx>({ companyId: null, employeeId: null, role: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setCtx({ companyId: null, employeeId: null, role: null, loading: false });
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("employee_id,company_id")
        .eq("auth_user_id", data.session.user.id)
        .single();

      let role: string | null = null;
      if (prof?.employee_id) {
        // Try employee_roles first
        const { data: r } = await supabase
          .from("employee_roles")
          .select("roles(code)")
          .eq("employee_id", prof.employee_id)
          .eq("is_active", true)
          .limit(1)
          .single();
        const rd = r as { roles: { code: string } | null } | null;
        role = rd?.roles?.code ?? null;
      }

      // Fallback: if no role assigned yet, treat the profile-linked employee as SUPER_ADMIN
      // This covers fresh setups where employee_roles hasn't been seeded yet.
      if (!role && prof?.employee_id) {
        role = "SUPER_ADMIN";
      }

      setCtx({
        companyId: prof?.company_id ?? null,
        employeeId: prof?.employee_id ?? null,
        role,
        loading: false,
      });
    });
  }, []);

  return ctx;
}

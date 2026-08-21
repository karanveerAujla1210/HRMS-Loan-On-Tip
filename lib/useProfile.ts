"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProfileCtx = {
  companyId: string | null;
  employeeId: string | null;
  role: string | null;
  loading: boolean;
};

const FALLBACK = "00000000-0000-0000-0000-000000000001";

export function useProfile(): ProfileCtx {
  const [ctx, setCtx] = useState<ProfileCtx>({ companyId: null, employeeId: null, role: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setCtx({ companyId: FALLBACK, employeeId: null, role: null, loading: false }); return; }

      const { data: prof } = await supabase
        .from("profiles")
        .select("employee_id,company_id")
        .eq("auth_user_id", data.session.user.id)
        .single();

      let role: string | null = null;
      if (prof?.employee_id) {
        const { data: r } = await supabase
          .from("employee_roles")
          .select("role")
          .eq("employee_id", prof.employee_id)
          .eq("is_active", true)
          .single();
        role = r?.role ?? null;
      }

      setCtx({
        companyId: prof?.company_id ?? FALLBACK,
        employeeId: prof?.employee_id ?? null,
        role,
        loading: false,
      });
    });
  }, []);

  return ctx;
}

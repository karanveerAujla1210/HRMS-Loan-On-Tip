"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";

export type RoleGuardRole =
  | "SUPER_ADMIN"
  | "HR_ADMIN"
  | "FINANCE_ADMIN"
  | "ASSET_ADMIN"
  | "OPERATIONS_ADMIN"
  | "LOCATION_ADMIN"
  | "MANAGER"
  | "EMPLOYEE";

interface UseRoleGuardOptions {
  /**
   * The roles that are allowed to access the page.
   * Pass null to allow any authenticated user.
   */
  allowedRoles: RoleGuardRole[] | null;
  /**
   * Where to redirect unauthorized users.
   * Defaults to "/self-service".
   */
  redirectTo?: string;
}

interface RoleGuardResult {
  /** True when the profile has loaded and the user is authorized. */
  allowed: boolean;
  /** True while the profile is still loading — render nothing / skeleton while this is true. */
  loading: boolean;
}

/**
 * Centralized client-side role guard.
 *
 * Usage:
 *   const { allowed, loading } = useRoleGuard({ allowedRoles: ["SUPER_ADMIN", "HR_ADMIN"] });
 *   if (loading) return <Skeleton />;
 *   if (!allowed) return null; // redirect already fired
 *
 * This hook checks the full `roles` array (not just the primary role) so that
 * a user who holds both MANAGER and EMPLOYEE roles is correctly classified.
 * SUPER_ADMIN always passes regardless of the allowedRoles list.
 */
export function useRoleGuard({
  allowedRoles,
  redirectTo = "/self-service",
}: UseRoleGuardOptions): RoleGuardResult {
  const router = useRouter();
  const { roles, loading } = useProfile();

  const allowed: boolean = (() => {
    if (loading) return false;
    if (allowedRoles === null) return true; // open to any authenticated user
    if (roles.includes("SUPER_ADMIN")) return true;
    return roles.some((r) => (allowedRoles as string[]).includes(r));
  })();

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace(redirectTo);
    }
  }, [loading, allowed, router, redirectTo]);

  return { allowed, loading };
}

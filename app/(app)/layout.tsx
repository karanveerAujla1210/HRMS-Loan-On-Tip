"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Profile = { employee_id: string | null; company_id: string | null; role: string | null };

// Nav items with minimum role required (null = all authenticated)
const NAV: { href: string; label: string; roles: string[] | null; Icon: () => React.JSX.Element }[] = [
  { href: "/dashboard",    label: "Dashboard",    roles: null,                                                          Icon: IconGrid },
  { href: "/people",       label: "People",       roles: ["SUPER_ADMIN","HR_ADMIN","OPERATIONS_ADMIN","MANAGER"],       Icon: IconUsers },
  { href: "/attendance",   label: "Attendance",   roles: ["SUPER_ADMIN","HR_ADMIN","OPERATIONS_ADMIN","MANAGER"],       Icon: IconClock },
  { href: "/leave",        label: "Leave",        roles: ["SUPER_ADMIN","HR_ADMIN","OPERATIONS_ADMIN","MANAGER"],       Icon: IconCalendar },
  { href: "/payroll",      label: "Payroll",      roles: ["SUPER_ADMIN","HR_ADMIN","FINANCE_ADMIN"],                    Icon: IconCash },
  { href: "/assets",       label: "Assets",       roles: ["SUPER_ADMIN","HR_ADMIN","OPERATIONS_ADMIN"],                 Icon: IconBox },
  { href: "/organisation", label: "Organisation", roles: ["SUPER_ADMIN","HR_ADMIN"],                                    Icon: IconBuilding },
  { href: "/reports",      label: "Reports",      roles: ["SUPER_ADMIN","HR_ADMIN","FINANCE_ADMIN","OPERATIONS_ADMIN"], Icon: IconChart },
  { href: "/self-service", label: "Self Service", roles: null,                                                          Icon: IconPerson },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,     setUser]     = useState<User | null>(null);
  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [checking, setChecking] = useState(true);
  const [unread,   setUnread]   = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/login"); setChecking(false); return; }
      setUser(data.session.user);

      const { data: prof } = await supabase
        .from("profiles")
        .select("employee_id,company_id")
        .eq("auth_user_id", data.session.user.id)
        .single();

      let role: string | null = null;
      if (prof?.employee_id) {
        const { data: roleRow } = await supabase
          .from("employee_roles")
          .select("roles(code)")
          .eq("employee_id", prof.employee_id)
          .eq("is_active", true)
          .limit(1)
          .single();
        const rd = roleRow as { roles: { code: string } | null } | null;
        role = rd?.roles?.code ?? null;

        // Unread notifications count
        const { count } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_employee_id", prof.employee_id)
          .is("read_at", null);
        setUnread(count ?? 0);
      }

      setProfile({ employee_id: prof?.employee_id ?? null, company_id: prof?.company_id ?? null, role });
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
      else setUser(session.user);
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (checking) {
    return (
      <div className="loading-spinner" style={{ minHeight: "100vh" }}>
        <div className="spinner" /> Loading…
      </div>
    );
  }

  const userEmail = user?.email?.toLowerCase() ?? "";
  const isDefaultAdmin = userEmail.includes("admin") || userEmail.includes("acgleasing") || userEmail.includes("loanontip");
  const effectiveRole = profile?.role || (isDefaultAdmin ? "SUPER_ADMIN" : null);

  const initials  = user?.email?.slice(0, 2).toUpperCase() ?? "HR";
  const roleLabel = effectiveRole
    ? effectiveRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Employee";

  const visibleNav = NAV.filter(({ roles }) =>
    roles === null || effectiveRole === "SUPER_ADMIN" || (effectiveRole && roles.includes(effectiveRole))
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">L</div>
          <div className="brand-text">
            <strong>Loan On Tip</strong>
            <span>ACG Leasing Limited</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Main menu</div>
          {visibleNav.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item${pathname === href || pathname.startsWith(href + "/") ? " active" : ""}`}
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <strong>{user?.email?.split("@")[0] ?? "Admin"}</strong>
              <span>{roleLabel}</span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
              {unread > 0 && (
                <Link href="/self-service" style={{ position: "relative", display: "grid", placeItems: "center" }}>
                  <span style={{
                    position: "absolute", top: -6, right: -6,
                    background: "var(--red)", color: "#fff",
                    fontSize: 9, fontWeight: 700,
                    borderRadius: "50%", width: 16, height: 16,
                    display: "grid", placeItems: "center",
                  }}>{unread > 9 ? "9+" : unread}</span>
                  <IconBell />
                </Link>
              )}
              <button className="btn-signout" onClick={signOut} title="Sign out"><IconLogout /></button>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-content">{children}</div>
    </div>
  );
}

function IconGrid()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function IconUsers()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconClock()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconCalendar() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function IconCash()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>; }
function IconBox()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconBuilding() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>; }
function IconChart()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function IconPerson()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>; }
function IconBell()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }
function IconLogout()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }

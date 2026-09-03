"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useSidebar } from "@/components/SidebarContext";

type Profile = { employee_id: string | null; company_id: string | null; role: string | null };

interface NavItem {
  href: string;
  label: string;
  roles: string[] | null;
  Icon: () => React.JSX.Element;
  section?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Core",
    items: [
      { href: "/dashboard", label: "Dashboard", roles: null, Icon: IconGrid },
      { href: "/self-service", label: "Self Service", roles: null, Icon: IconPerson },
    ],
  },
  {
    label: "People Operations",
    items: [
      { href: "/people", label: "People", roles: ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "MANAGER"], Icon: IconUsers },
      { href: "/attendance", label: "Attendance", roles: ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "MANAGER"], Icon: IconClock },
      { href: "/leave", label: "Leave", roles: ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "MANAGER"], Icon: IconCalendar },
    ],
  },
  {
    label: "Finance & Assets",
    items: [
      { href: "/payroll", label: "Payroll", roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN"], Icon: IconCash },
      { href: "/assets", label: "Assets", roles: ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN"], Icon: IconBox },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/organisation", label: "Organisation", roles: ["SUPER_ADMIN", "HR_ADMIN"], Icon: IconBuilding },
      { href: "/reports", label: "Reports", roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "OPERATIONS_ADMIN", "MANAGER"], Icon: IconChart },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen: sidebarOpen, close: closeSidebar } = useSidebar();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(true);
  const [unread, setUnread] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + B to toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        // Toggle via context - need to access the context value
      }
      // Escape to close sidebar on mobile
      if (e.key === "Escape" && sidebarOpen) {
        closeSidebar();
      }
      // Ctrl/Cmd + K for search (placeholder)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        // Focus search if available
        const searchInput = document.querySelector('input[placeholder*="Search" i]') as HTMLInputElement;
        searchInput?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, closeSidebar]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (window.innerWidth < 768) {
      closeSidebar();
    }
  }, [pathname, closeSidebar]);

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

  const effectiveRole = profile?.role ?? null;

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "HR";
  const roleLabel = effectiveRole
    ? effectiveRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Employee";

  const toggleSection = (sectionLabel: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionLabel)) next.delete(sectionLabel);
      else next.add(sectionLabel);
      return next;
    });
  };

  const renderNav = () => {
    return NAV_SECTIONS.map((section) => {
      const visibleItems = section.items.filter(({ roles }) =>
        roles === null || effectiveRole === "SUPER_ADMIN" || (effectiveRole && roles.includes(effectiveRole))
      );
      if (visibleItems.length === 0) return null;

      const isCollapsed = collapsedSections.has(section.label);

      return (
        <div key={section.label} className="nav-section">
          <button
            className="nav-section-header"
            onClick={() => toggleSection(section.label)}
            aria-expanded={!isCollapsed}
            aria-controls={`nav-section-${section.label}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 8px 6px",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-4)",
              letterSpacing: "1px",
              textTransform: "uppercase",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
            }}
          >
            <span style={{ transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="6 9 12 15 18 9"/></svg>
            </span>
            {section.label}
            <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.6 }}>{visibleItems.length}</span>
          </button>
          <div id={`nav-section-${section.label}`} style={{ overflow: "hidden", transition: "max-height 0.25s ease-out", maxHeight: isCollapsed ? 0 : "500px" }}>
            {visibleItems.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`nav-item${pathname === href || pathname.startsWith(href + "/") ? " active" : ""}`}
                onClick={() => closeSidebar()}
              >
                <Icon />
                {label}
              </Link>
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    <>
      {sidebarOpen && window.innerWidth < 768 && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Loan On Tip Logo" className="brand-logo" />
          <div className="brand-text">
            <strong>Loan On Tip</strong>
            <span>ACG Leasing Limited</span>
          </div>
        </div>

        <nav className="sidebar-nav" style={{ padding: "12px 10px", flex: 1 }}>
          {renderNav()}
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

      {/* Keyboard shortcuts help tooltip */}
      <div style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
        boxShadow: "var(--shadow-md)",
        fontSize: 12,
        color: "var(--text-2)",
        zIndex: 50,
        opacity: 0.8,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>Shortcuts</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <kbd style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>⌘/Ctrl + B</span><span>Toggle Sidebar</span></kbd>
          <kbd style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>⌘/Ctrl + K</span><span>Focus Search</span></kbd>
          <kbd style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>Esc</span><span>Close Sidebar</span></kbd>
        </div>
      </div>
    </>
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
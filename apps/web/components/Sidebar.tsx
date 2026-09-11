import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IconBell, IconLogout } from '@/components/Icons';
import CompanySwitcher from '@/components/CompanySwitcher'; // adjust import path if needed

interface SidebarProps {
  sidebarOpen: boolean;
  isMobile: boolean;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  renderNav: () => React.ReactNode;
  unread: number;
  userEmail: string;
  displayName: string;
  roleLabel: string;
  initials: string;
  signOut: () => void;
}

/**
 * Reusable sidebar component extracted from the main layout.
 * Mirrors the original sidebar markup while accepting props for
 * state and callbacks. This component keeps the UI logic isolated
 * and enables easier styling, testing, and future enhancements.
 */
const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen,
  isMobile,
  closeSidebar,
  toggleSidebar,
  renderNav,
  unread,
  userEmail,
  displayName,
  roleLabel,
  initials,
  signOut,
}) => {
  return (
    <>
      {/* Overlay for mobile when sidebar is open */}
      {sidebarOpen && isMobile && (
        <div className="sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* Actual sidebar markup */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Image src="/logo.png" alt="Loan On Tip Logo" width={38} height={38} className="brand-logo" priority />
          <div className="brand-text">
            <strong>Loan On Tip</strong>
            <span>ACG Leasing Limited</span>
          </div>
        </div>

        <nav className="sidebar-nav" style={{ padding: '12px 10px', flex: 1 }}>
          {renderNav()}
          {/* Super Admin organizational-context switcher */}
          <CompanySwitcher />
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="user-info" style={{ overflow: 'hidden', minWidth: 0 }}>
              <strong
                title={userEmail}
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {displayName}
              </strong>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>{roleLabel}</span>
            </div>
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: 4,
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              {unread > 0 && (
                <Link
                  href="/self-service"
                  style={{
                    position: 'relative',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 6,
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-muted)',
                  }}
                  title={`${unread} unread notifications`}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 1,
                      right: 1,
                      background: 'var(--danger)',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      borderRadius: '50%',
                      width: 15,
                      height: 15,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {unread > 9 ? '9+' : unread}
                  </span>
                  <IconBell />
                </Link>
              )}
              <button className="btn-signout" onClick={signOut} title="Sign out" aria-label="Sign out">
                <IconLogout />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

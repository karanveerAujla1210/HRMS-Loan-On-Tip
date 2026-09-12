import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IconBell, IconLogout } from '@/components/Icons';
import CompanySwitcher from '@/components/CompanySwitcher'; // adjust import path if needed

interface SidebarProps {
  sidebarOpen: boolean;
  isMobile: boolean;
  closeSidebar: () => void;
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
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white/70 backdrop-blur-lg border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isMobile ? '' : 'md:translate-x-0'}`}>
        <div className="flex items-center gap-2 p-4">
            <Image src="/logo.png" alt="Loan On Tip Logo" width={38} height={38} className="h-10 w-10" priority />
            <div className="flex flex-col">
              <strong className="text-lg font-semibold text-gray-900 dark:text-gray-100">Loan On Tip</strong>
              <span className="text-sm text-gray-600 dark:text-gray-400">ACG Leasing Limited</span>
            </div>
          </div>

        <nav className="sidebar-nav" style={{ padding: '12px 10px', flex: 1 }}>
          {renderNav()}
          {/* Super Admin organizational-context switcher */}
          <CompanySwitcher />
        </nav>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex items-center gap-3 p-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand text-white" aria-hidden="true">
                {initials}
              </div>
              <div className="flex flex-col overflow-hidden min-w-0">
                <strong title={userEmail} className="font-medium text-gray-900 dark:text-gray-100 truncate">{displayName}</strong>
                <span className="text-xs text-gray-600 dark:text-gray-400">{roleLabel}</span>
              </div>
            <div
              className="ml-auto flex items-center gap-2 flex-shrink-0"
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
              <button onClick={signOut} title="Sign out" aria-label="Sign out" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
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

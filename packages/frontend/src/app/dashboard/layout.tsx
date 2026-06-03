'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

/* ── SVG Icons ─────────────────────────────────────────────────────────── */
const ClipboardIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
  </svg>
);
const PillIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 20.5L20.5 10.5a4.95 4.95 0 00-7-7L3.5 13.5a4.95 4.95 0 007 7z" />
    <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
  </svg>
);
const BellIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);
const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const HeartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
);
const UsersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const FileTextIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);
const MapPinIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const LogOutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const ICON_MAP: Record<string, React.ComponentType> = {
  Clipboard: ClipboardIcon,
  Pill: PillIcon,
  Bell: BellIcon,
  User: UserIcon,
  Heart: HeartIcon,
  Users: UsersIcon,
  FileText: FileTextIcon,
  MapPin: MapPinIcon,
};

interface NavItem {
  label: string;
  icon: string;
  href: string;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  PATIENT: [
    { label: 'Blood Requests', icon: 'Clipboard', href: '/dashboard/requests' },
    { label: 'Medicines', icon: 'Pill', href: '/dashboard/medicines' },
    { label: 'Notifications', icon: 'Bell', href: '/dashboard/notifications' },
    { label: 'Profile', icon: 'User', href: '/dashboard/profile' },
  ],
  DONOR: [
    { label: 'Blood Pool', icon: 'FileText', href: '/dashboard/blood-pool' },
    { label: 'My Assignments', icon: 'Clipboard', href: '/dashboard/donor-requests' },
    { label: 'Notifications', icon: 'Bell', href: '/dashboard/notifications' },
    { label: 'Donor Profile', icon: 'Heart', href: '/dashboard/donor-profile' },
  ],
  HOSPITAL: [
    { label: 'Blood Requests', icon: 'Clipboard', href: '/dashboard/requests' },
    { label: 'Notifications', icon: 'Bell', href: '/dashboard/notifications' },
    { label: 'Profile', icon: 'User', href: '/dashboard/profile' },
  ],
  ADMIN: [
    { label: 'Blood Requests', icon: 'Clipboard', href: '/dashboard/requests' },
    { label: 'Medicines', icon: 'Pill', href: '/dashboard/medicines' },
    { label: 'Users', icon: 'Users', href: '/dashboard/users' },
    { label: 'Audit Log', icon: 'FileText', href: '/dashboard/audit' },
    { label: 'Notifications', icon: 'Bell', href: '/dashboard/notifications' },
    { label: 'Profile', icon: 'User', href: '/dashboard/profile' },
  ],
  VOLUNTEER: [
    { label: 'Blood Requests', icon: 'Clipboard', href: '/dashboard/requests' },
    { label: 'Medicines', icon: 'Pill', href: '/dashboard/medicines' },
    { label: 'Notifications', icon: 'Bell', href: '/dashboard/notifications' },
    { label: 'Assignments', icon: 'MapPin', href: '/dashboard/assignments' },
    { label: 'Profile', icon: 'User', href: '/dashboard/profile' },
  ],
};

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)' }}>
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-muted)' }}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading) return <Spinner />;
  if (!user) return null;

  const navItems = NAV_BY_ROLE[user.role] ?? NAV_BY_ROLE.PATIENT;

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '0 16px', height: '56px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{
          width: '22px', height: '22px', borderRadius: '6px',
          backgroundColor: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: '11px', fontWeight: 600, flexShrink: 0,
        }}>M</div>
        <Link href="/dashboard" style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-text)' }}>
          Mentamind
        </Link>
      </div>

      {/* User */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            backgroundColor: 'var(--color-surface-hover)',
            border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-secondary)', fontSize: '11px', fontWeight: 600, flexShrink: 0,
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </p>
            <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', letterSpacing: '0.02em' }}>
              {user.role}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {navItems.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <NavItem key={item.href} href={item.href} isActive={isActive} Icon={Icon} label={item.label} />
          );
        })}
      </nav>

      {/* Sign out */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
        <SignOutButton onClick={logout} />
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--color-bg)' }}>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 flex flex-col border-r transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: '216px',
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <SidebarContent />
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile top bar */}
        <header
          className="flex items-center justify-between px-4 border-b flex-shrink-0 md:hidden"
          style={{ height: '56px', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            style={{ padding: '6px', borderRadius: '6px', color: 'var(--color-text-secondary)', background: 'none', border: 'none' }}
          >
            <MenuIcon />
          </button>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Mentamind</span>
          <div style={{ width: '30px' }} />
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ href, isActive, Icon, label }: { href: string; isActive: boolean; Icon: React.ComponentType; label: string }) {
  const [hovered, setHovered] = useState(false);
  const active = isActive || hovered;

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '7px 10px', borderRadius: '6px',
        marginBottom: '2px',
        fontSize: '13px', fontWeight: 500,
        letterSpacing: '0.01em',
        backgroundColor: isActive ? 'var(--color-surface-hover)' : hovered ? 'var(--color-surface-hover)' : 'transparent',
        color: isActive ? 'var(--color-text)' : hovered ? 'var(--color-text)' : 'var(--color-text-secondary)',
        transition: 'background-color 150ms ease, color 150ms ease',
      }}
    >
      {Icon && <Icon />}
      {label}
    </Link>
  );
}

function SignOutButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
        padding: '7px 10px', borderRadius: '6px',
        fontSize: '13px', fontWeight: 500,
        border: 'none',
        backgroundColor: hovered ? 'rgba(239,68,68,0.08)' : 'transparent',
        color: hovered ? 'var(--color-error)' : 'var(--color-text-muted)',
        transition: 'background-color 150ms ease, color 150ms ease',
      }}
    >
      <LogOutIcon />
      Sign out
    </button>
  );
}

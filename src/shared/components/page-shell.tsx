'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/shared/ui';
import { can, canAny } from '@/shared/permissions/can';
import { logoutRequest } from '@/shared/session/logout';
import { useSession } from '@/shared/session/use-session';
import styles from './page-shell.module.css';

interface PageShellProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  isActive: boolean;
}

function getSessionRole(permissions: string[]): string {
  if (canAny(permissions, ['admin.users.manage', 'admin.roles.manage'])) return 'Administración';
  if (can(permissions, 'documents.validate')) return 'Revisor clínico';
  if (can(permissions, 'patients.read')) return 'Profesional clínico';
  return 'Usuario';
}

function getInitials(email: string): string {
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'US';
}

export function PageShell({ children }: PageShellProps) {
  const { user, session, clearSession } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Búsqueda global: Ctrl+K / Cmd+K enfoca el buscador del topbar.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleLogout() {
    if (session) {
      await logoutRequest(session.accessToken, session.refreshToken);
    }
    clearSession();
    router.replace('/login');
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    router.push(`/patients?q=${encodeURIComponent(query)}`);
  }

  const navItems = useMemo<NavItem[]>(() => {
    if (!user) return [];

    const permissions = user.permissions;
    const isPatientsArea = pathname.startsWith('/patients') && !pathname.includes('/documents');
    const isDigitizationArea = pathname.includes('/documents');
    const items: NavItem[] = [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: 'dashboard',
        isActive: pathname === '/dashboard',
      },
    ];

    if (can(permissions, 'patients.read')) {
      items.push({
        href: '/patients',
        label: 'Pacientes',
        icon: 'patient',
        isActive: isPatientsArea,
      });
    }

    if (can(permissions, 'patients.read') && can(permissions, 'documents.read')) {
      items.push({
        href: '/patients',
        label: 'Digitalización',
        icon: 'scan',
        isActive: isDigitizationArea,
      });
    }

    if (can(permissions, 'review.read')) {
      items.push({
        href: '/review',
        label: 'Revisión digital',
        icon: 'review',
        isActive: pathname.startsWith('/review'),
      });
    }

    if (canAny(permissions, ['admin.users.manage', 'admin.roles.manage'])) {
      items.push({
        href: '/admin',
        label: 'Administración',
        icon: 'admin',
        isActive: pathname.startsWith('/admin'),
      });
    }

    items.push({
      href: '/profile',
      label: 'Perfil',
      icon: 'profile',
      isActive: pathname.startsWith('/profile'),
    });

    return items;
  }, [pathname, user]);

  if (!user) return null;

  const roleLabel = getSessionRole(user.permissions);
  const shellClass = [
    styles.shell,
    isCollapsed ? styles.shellCollapsed : '',
    isMobileOpen ? styles.shellMobileOpen : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={shellClass}>
      <button
        className={styles.mobileBackdrop}
        type="button"
        aria-label="Cerrar menú"
        onClick={() => setIsMobileOpen(false)}
      />

      <aside className={styles.sidebar} aria-label="Navegación principal">
        <div className={styles.brandBlock}>
          <Link href="/dashboard" className={styles.brand} aria-label="Ir al dashboard">
            <span className={styles.brandMark} aria-hidden="true">PC</span>
            <span className={styles.brandText}>Plataforma Clínica</span>
          </Link>
          <button
            className={styles.collapseBtn}
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          >
            <Icon name="collapse" size={17} />
          </button>
        </div>

        <nav className={styles.navList}>
          {navItems.map((item) => (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              className={`${styles.navLink} ${item.isActive ? styles.navLinkActive : ''}`}
              aria-current={item.isActive ? 'page' : undefined}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            className={styles.logoutBtn}
            type="button"
            onClick={() => void handleLogout()}
            title={isCollapsed ? 'Cerrar sesión' : undefined}
          >
            <Icon name="logout" size={18} />
            <span className={styles.navLabel}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <button
            className={styles.mobileMenuBtn}
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Icon name="menu" size={20} />
          </button>

          <form className={styles.searchForm} role="search" onSubmit={handleSearchSubmit}>
            <span className={styles.searchIcon} aria-hidden="true">
              <Icon name="search" size={17} />
            </span>
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="search"
              placeholder="Buscar pacientes, documentos…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Búsqueda global"
            />
            <kbd className={styles.searchKbd} aria-hidden="true">Ctrl + K</kbd>
          </form>

          <div className={styles.topbarRight}>
            <button className={styles.iconBtn} type="button" aria-label="Notificaciones">
              <Icon name="bell" size={19} />
              <span className={styles.bellDot} aria-hidden="true" />
            </button>

            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true">{getInitials(user.email)}</span>
              <span className={styles.identityText}>
                <span className={styles.identityEmail}>{user.email}</span>
                <span className={styles.identityRole}>{roleLabel}</span>
              </span>
            </div>
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

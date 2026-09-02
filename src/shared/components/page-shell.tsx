'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NotificationsBell } from '@/features/notifications';
import { BrandLogo, Icon, type IconName } from '@/shared/ui';
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

function getRouteLabel(pathname: string): string {
  if (pathname === '/dashboard') return 'Centro operativo';
  if (pathname.startsWith('/review')) return 'Revisión digital';
  if (pathname.startsWith('/admin')) return 'Administración';
  if (pathname.startsWith('/profile')) return 'Mi perfil';
  if (pathname.includes('/documents')) return 'Documentos clínicos';
  if (pathname.includes('/records')) return 'Historias clínicas';
  if (pathname.startsWith('/patients')) return 'Pacientes';
  return 'Espacio clínico';
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

  useEffect(() => {
    const desktopViewport = window.matchMedia('(min-width: 861px)');

    function closeMobileMenu(event: MediaQueryListEvent) {
      if (event.matches) setIsMobileOpen(false);
    }

    desktopViewport.addEventListener('change', closeMobileMenu);
    return () => desktopViewport.removeEventListener('change', closeMobileMenu);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }

      if (event.key === 'Escape') {
        setIsMobileOpen(false);
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
      <a className={styles.skipLink} href="#main-content">
        Saltar al contenido
      </a>

      <div className={styles.ambient} aria-hidden="true" />

      <button
        className={styles.mobileBackdrop}
        type="button"
        aria-label="Cerrar menú"
        onClick={() => setIsMobileOpen(false)}
      />

      <aside className={styles.sidebar} aria-label="Navegación principal">
        <div className={styles.brandBlock}>
          <Link href="/dashboard" className={styles.brand} aria-label="ClinicView, ir al dashboard">
            {isCollapsed && !isMobileOpen ? (
              <BrandLogo variant="mark" size="navigation" decorative />
            ) : (
              <BrandLogo variant="lockup" tone="inverse" size="navigation" decorative />
            )}
          </Link>

          <button
            className={styles.collapseBtn}
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            aria-expanded={!isCollapsed}
          >
            <Icon name="collapse" size={17} />
          </button>
        </div>

        <span className={styles.navEyebrow}>Espacio de trabajo</span>

        <nav className={styles.navList}>
          {navItems.map((item) => (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              className={`${styles.navLink} ${item.isActive ? styles.navLinkActive : ''}`}
              aria-current={item.isActive ? 'page' : undefined}
              title={isCollapsed ? item.label : undefined}
            >
              <span className={styles.navIcon} aria-hidden="true">
                <Icon name={item.icon} size={19} />
              </span>
              <span className={styles.navLabel}>{item.label}</span>
              {item.isActive && <span className={styles.activeDot} aria-hidden="true" />}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.securityStatus} title={isCollapsed ? 'Sesión protegida' : undefined}>
            <span className={styles.securityDot} aria-hidden="true" />
            <span className={styles.securityCopy}>
              <strong>Sesión protegida</strong>
              <small>Acceso institucional</small>
            </span>
          </div>

          <button
            className={styles.logoutBtn}
            type="button"
            onClick={() => void handleLogout()}
            title={isCollapsed ? 'Cerrar sesión' : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">
              <Icon name="logout" size={18} />
            </span>
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
            aria-expanded={isMobileOpen}
          >
            <Icon name="menu" size={20} />
          </button>

          <Link href="/dashboard" className={styles.mobileBrand} aria-label="ClinicView, ir al dashboard">
            <BrandLogo variant="mark" size="compact" decorative />
          </Link>

          <div className={styles.routeContext}>
            <span className={styles.routeEyebrow}>Workspace</span>
            <span className={styles.routeTitle}>{getRouteLabel(pathname)}</span>
          </div>

          <form className={styles.searchForm} role="search" onSubmit={handleSearchSubmit}>
            <span className={styles.searchIcon} aria-hidden="true">
              <Icon name="search" size={17} />
            </span>
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="search"
              placeholder="Buscar pacientes o documentos"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Búsqueda global"
            />
            <kbd className={styles.searchKbd} aria-hidden="true">Ctrl K</kbd>
          </form>

          <div className={styles.topbarRight}>
            <NotificationsBell />

            <Link href="/profile" className={styles.identity} aria-label="Abrir mi perfil">
              <span className={styles.avatar} aria-hidden="true">{getInitials(user.email)}</span>
              <span className={styles.identityText}>
                <span className={styles.identityEmail}>{user.email}</span>
                <span className={styles.identityRole}>{roleLabel}</span>
              </span>
            </Link>
          </div>
        </header>

        <main id="main-content" className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

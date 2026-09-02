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
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const restoreMenuFocusRef = useRef(false);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    restoreMenuFocusRef.current = false;
    setIsMobileOpen(false);

    let animationFrame: number | undefined;
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      animationFrame = window.requestAnimationFrame(() => {
        contentRef.current?.focus({ preventScroll: true });
      });
    }

    return () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
    };
  }, [pathname]);

  useEffect(() => {
    const desktopViewport = window.matchMedia('(min-width: 861px)');

    function syncViewport(matchesDesktop: boolean) {
      setIsMobileViewport(!matchesDesktop);
      if (matchesDesktop) {
        restoreMenuFocusRef.current = false;
        setIsMobileOpen(false);
      }
    }

    function onViewportChange(event: MediaQueryListEvent) {
      syncViewport(event.matches);
    }

    syncViewport(desktopViewport.matches);
    desktopViewport.addEventListener('change', onViewportChange);
    return () => desktopViewport.removeEventListener('change', onViewportChange);
  }, []);

  useEffect(() => {
    if (!isMobileViewport || !isMobileOpen) return;

    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const mobileMenuButton = mobileMenuButtonRef.current;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const getFocusableElements = () =>
      Array.from(sidebar.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => element.getClientRects().length > 0,
      );

    const animationFrame = window.requestAnimationFrame(() => {
      sidebar.querySelector<HTMLElement>('[data-drawer-initial-focus]')?.focus();
    });

    function onDrawerKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        restoreMenuFocusRef.current = true;
        setIsMobileOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onDrawerKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onDrawerKeyDown);

      if (restoreMenuFocusRef.current) {
        window.requestAnimationFrame(() => mobileMenuButton?.focus());
      }
    };
  }, [isMobileOpen, isMobileViewport]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey)
        && event.key.toLowerCase() === 'k'
        && !document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }

    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
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

  function openMobileMenu() {
    restoreMenuFocusRef.current = true;
    setIsMobileOpen(true);
  }

  function closeMobileMenu() {
    restoreMenuFocusRef.current = true;
    setIsMobileOpen(false);
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

      <div
        className={styles.mobileBackdrop}
        aria-hidden="true"
        onPointerDown={closeMobileMenu}
      />

      <aside
        id="primary-navigation"
        ref={sidebarRef}
        className={styles.sidebar}
        aria-label="Navegación principal"
        aria-hidden={isMobileViewport && !isMobileOpen ? true : undefined}
        aria-modal={isMobileViewport && isMobileOpen ? true : undefined}
        role={isMobileViewport ? 'dialog' : undefined}
      >
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
            aria-controls="primary-navigation"
          >
            <Icon name="collapse" size={17} />
          </button>

          <button
            className={styles.mobileCloseBtn}
            type="button"
            onClick={closeMobileMenu}
            aria-label="Cerrar menú de navegación"
            data-drawer-initial-focus
          >
            <Icon name="close" size={20} />
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
              aria-label={item.label}
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
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
            aria-label="Cerrar sesión"
            title={isCollapsed ? 'Cerrar sesión' : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">
              <Icon name="logout" size={18} />
            </span>
            <span className={styles.navLabel}>
              {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </span>
          </button>
        </div>
      </aside>

      <div
        className={styles.mainArea}
        inert={isMobileViewport && isMobileOpen ? true : undefined}
      >
        <header className={styles.topbar}>
          <button
            ref={mobileMenuButtonRef}
            className={styles.mobileMenuBtn}
            type="button"
            onClick={openMobileMenu}
            aria-label="Abrir menú"
            aria-expanded={isMobileOpen}
            aria-controls="primary-navigation"
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
              aria-keyshortcuts="Control+K Meta+K"
            />
            <kbd className={styles.searchKbd} aria-hidden="true">Ctrl K</kbd>
          </form>

          <div className={styles.topbarRight}>
            <NotificationsBell />

            <Link
              href="/profile"
              className={styles.identity}
              aria-label={`Abrir mi perfil de ${user.email}`}
              title={user.email}
            >
              <span className={styles.avatar} aria-hidden="true">{getInitials(user.email)}</span>
              <span className={styles.identityText}>
                <span className={styles.identityEmail}>{user.email}</span>
                <span className={styles.identityRole}>{roleLabel}</span>
              </span>
            </Link>
          </div>
        </header>

        <main ref={contentRef} id="main-content" className={styles.content} tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

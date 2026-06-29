'use client';

import { useEffect, useMemo, useState } from 'react';
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
  if (canAny(permissions, ['admin.users.manage', 'admin.roles.manage'])) return 'Administracion';
  if (can(permissions, 'documents.validate')) return 'Revisor clinico';
  if (can(permissions, 'patients.read')) return 'Profesional clinico';
  return 'Usuario';
}

export function PageShell({ children }: PageShellProps) {
  const { user, session, clearSession } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    if (session) {
      await logoutRequest(session.accessToken, session.refreshToken);
    }
    clearSession();
    router.replace('/login');
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
        label: 'Digitalizacion',
        icon: 'scan',
        isActive: isDigitizationArea,
      });
    }

    if (can(permissions, 'review.read')) {
      items.push({
        href: '/review',
        label: 'Revision digital',
        icon: 'review',
        isActive: pathname.startsWith('/review'),
      });
    }

    if (canAny(permissions, ['admin.users.manage', 'admin.roles.manage'])) {
      items.push({
        href: '/admin',
        label: 'Administracion',
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
  const displayName = user.email;
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
        aria-label="Cerrar menu"
        onClick={() => setIsMobileOpen(false)}
      />

      <aside className={styles.sidebar} aria-label="Navegacion principal">
        <div className={styles.brandBlock}>
          <Link href="/dashboard" className={styles.brand} aria-label="Ir al dashboard">
            <span className={styles.brandMark} aria-hidden="true">PC</span>
            <span className={styles.brandText}>Plataforma Clinica</span>
          </Link>
          <button
            className={styles.collapseBtn}
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            aria-label={isCollapsed ? 'Expandir menu lateral' : 'Colapsar menu lateral'}
          >
            <Icon name="collapse" size={18} />
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
            title={isCollapsed ? 'Cerrar sesion' : undefined}
          >
            <Icon name="logout" size={18} />
            <span className={styles.navLabel}>Cerrar sesion</span>
          </button>
        </div>
      </aside>

      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <button
            className={styles.mobileMenuBtn}
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Icon name="menu" size={20} />
          </button>
          <div className={styles.topbarIdentity}>
            <span className={styles.userNameRole}>{displayName} - {roleLabel}</span>
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

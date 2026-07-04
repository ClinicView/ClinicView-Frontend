'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { useDashboardStats } from '@/features/dashboard';
import type { ActivityType } from '@/features/dashboard';
import { can, canAny } from '@/shared/permissions/can';
import { PageShell } from '@/shared/components/page-shell';
import { Icon, type IconName } from '@/shared/ui';
import styles from './dashboard.module.css';

/* ─── Helpers ────────────────────────────────────────────────── */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '¡Buenos días';
  if (hour < 19) return '¡Buenas tardes';
  return '¡Buenas noches';
}

function getRoleDisplay(permissions: string[]): string {
  if (canAny(permissions, ['admin.users.manage', 'admin.roles.manage'])) return 'Administrador';
  if (can(permissions, 'documents.validate')) return 'Revisor';
  return 'Profesional';
}

function formatToday(): string {
  const formatted = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Ayer, ${time}`;
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }) + ` ${time}`;
}

/* ─── Sub-componentes ────────────────────────────────────────── */

interface StatCardProps {
  icon: IconName;
  tone: 'blue' | 'amber' | 'green' | 'red';
  label: string;
  value: number | null;
  hint: string | null;
  hintTone?: 'up' | 'down' | 'neutral';
}

function StatCard({ icon, tone, label, value, hint, hintTone = 'neutral' }: StatCardProps) {
  return (
    <article className={styles.statCard}>
      <span className={`${styles.statIcon} ${styles[`statIcon_${tone}`]}`} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value ?? '—'}</span>
        {hint && (
          <span className={`${styles.statHint} ${styles[`statHint_${hintTone}`]}`}>{hint}</span>
        )}
      </div>
    </article>
  );
}

const FLOW_STEPS: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'patient', title: 'Selección de paciente', text: 'Elige el paciente y la historia clínica' },
  { icon: 'upload', title: 'Subida de archivo', text: 'Carga el documento físico a procesar' },
  { icon: 'scan', title: 'Procesamiento OCR', text: 'Extracción automática de la información' },
  { icon: 'edit', title: 'Corrección', text: 'Revisión y corrección de datos extraídos' },
  { icon: 'shield', title: 'Validación', text: 'Validación final y cierre del proceso' },
];

const ACTIVITY_META: Record<
  ActivityType,
  { icon: IconName; tone: string; badge: string }
> = {
  VALIDATED: { icon: 'check', tone: 'green', badge: 'Validado' },
  UPLOADED: { icon: 'upload', tone: 'blue', badge: 'En cola' },
  IN_QUEUE: { icon: 'clock', tone: 'amber', badge: 'En cola' },
  CORRECTED: { icon: 'edit', tone: 'teal', badge: 'Corregido' },
  ERROR: { icon: 'alert', tone: 'red', badge: 'Error' },
};

/* ─── Vista ──────────────────────────────────────────────────── */

export function DashboardView() {
  const { user } = useSession();
  const router = useRouter();
  const { stats, isLoading } = useDashboardStats();

  if (!user) return null;

  const permissions = user.permissions;
  const canDigitize = can(permissions, 'patients.read') && can(permissions, 'documents.read');
  const canReview = can(permissions, 'review.read');
  const canAdmin = can(permissions, 'admin.users.manage');

  function deltaHint(pct: number | null | undefined): {
    hint: string | null;
    tone: 'up' | 'down' | 'neutral';
  } {
    if (pct == null) return { hint: null, tone: 'neutral' };
    if (pct >= 0) return { hint: `↑ ${pct}% vs. ayer`, tone: 'up' };
    return { hint: `↓ ${Math.abs(pct)}% vs. ayer`, tone: 'down' };
  }

  const patientsDelta = deltaHint(stats?.patientsTodayDeltaPct);
  const validateDelta = deltaHint(stats?.readyToValidateDeltaPct);
  const errorsDelta = deltaHint(stats?.ocrErrorsDeltaPct);

  return (
    <PageShell>
      {/* Saludo + fecha */}
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.greeting}>
            {getGreeting()}, <strong>{getRoleDisplay(permissions)}</strong>!
          </h1>
          <p className={styles.date}>{formatToday()}</p>
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero} aria-labelledby="dashboard-hero-title">
        <div className={styles.heroContent}>
          <h2 id="dashboard-hero-title" className={styles.heroTitle}>
            Digitaliza, corrige y valida historias clínicas con trazabilidad
          </h2>
          <p className={styles.heroText}>
            Centraliza el proceso de digitalización, corrige con precisión y valida cada
            historia clínica con un flujo seguro y auditado.
          </p>
          <div className={styles.heroActions}>
            {canDigitize && (
              <button className={styles.btnPrimary} onClick={() => router.push('/patients')}>
                <Icon name="upload" size={17} />
                Nueva digitalización
              </button>
            )}
            {canReview && (
              <button className={styles.btnSecondary} onClick={() => router.push('/review')}>
                <Icon name="review" size={17} />
                Ver revisión digital
              </button>
            )}
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.heroDoc}>
            <span className={styles.heroDocDot} />
            <span className={styles.heroDocBar} />
            <span className={styles.heroDocRow}>
              <span className={styles.heroDocSquare} />
              <span className={styles.heroDocLines}>
                <i /><i /><i />
              </span>
            </span>
            <span className={styles.heroDocRow}>
              <span className={styles.heroDocSquare} />
              <span className={styles.heroDocLines}>
                <i /><i /><i />
              </span>
            </span>
          </div>
          <div className={styles.heroOcrChip}>
            <span className={styles.heroOcrLabel}>OCR</span>
            <span className={styles.heroOcrValue}>99%</span>
            <span className={styles.heroOcrBar} />
          </div>
          <span className={styles.heroCheck}>
            <Icon name="check" size={22} />
          </span>
        </div>
      </section>

      {/* Métricas */}
      <section className={styles.statsGrid} aria-label="Indicadores del día">
        <StatCard
          icon="users"
          tone="blue"
          label="Pacientes hoy"
          value={stats?.patientsToday ?? null}
          hint={isLoading ? null : patientsDelta.hint}
          hintTone={patientsDelta.tone}
        />
        <StatCard
          icon="document"
          tone="amber"
          label="Documentos en cola"
          value={stats?.documentsInQueue ?? null}
          hint={isLoading || !stats ? null : 'En espera de procesamiento'}
          hintTone="neutral"
        />
        <StatCard
          icon="shield"
          tone="green"
          label="Listos para validar"
          value={stats?.readyToValidate ?? null}
          hint={isLoading ? null : validateDelta.hint}
          hintTone={validateDelta.tone}
        />
        <StatCard
          icon="alert"
          tone="red"
          label="Errores OCR"
          value={stats?.ocrErrors ?? null}
          hint={isLoading ? null : errorsDelta.hint}
          hintTone={errorsDelta.tone === 'down' ? 'up' : errorsDelta.tone === 'up' ? 'down' : 'neutral'}
        />
      </section>

      <div className={styles.mainGrid}>
        <div className={styles.mainColumn}>
          {/* Flujo operativo */}
          <section className={styles.panel} aria-labelledby="flow-title">
            <h2 id="flow-title" className={styles.panelTitle}>Flujo operativo</h2>
            <ol className={styles.flow}>
              {FLOW_STEPS.map((step, index) => (
                <li key={step.title} className={styles.flowStep}>
                  <span className={styles.flowIcon} aria-hidden="true">
                    <Icon name={step.icon} size={22} />
                  </span>
                  <span className={styles.flowTitle}>{step.title}</span>
                  <span className={styles.flowText}>{step.text}</span>
                  {index < FLOW_STEPS.length - 1 && (
                    <span className={styles.flowConnector} aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* Accesos rápidos */}
          <section aria-labelledby="quick-title">
            <h2 id="quick-title" className={styles.sectionTitle}>Accesos rápidos</h2>
            <div className={styles.quickGrid}>
              {can(permissions, 'patients.read') && (
                <Link href="/patients" className={`${styles.quickCard} ${styles.quick_blue}`}>
                  <span className={styles.quickIcon}><Icon name="patient" size={20} /></span>
                  <span className={styles.quickTitle}>Pacientes</span>
                  <span className={styles.quickText}>
                    Buscar pacientes, abrir su ficha y acceder a registros o digitalización.
                  </span>
                  <span className={styles.quickArrow} aria-hidden="true">
                    <Icon name="arrow-right" size={15} />
                  </span>
                </Link>
              )}
              {can(permissions, 'records.read') && (
                <Link href="/patients" className={`${styles.quickCard} ${styles.quick_amber}`}>
                  <span className={styles.quickIcon}><Icon name="records" size={20} /></span>
                  <span className={styles.quickTitle}>Registro manual de atención</span>
                  <span className={styles.quickText}>
                    Crear y consultar historias clínicas estructuradas registradas manualmente.
                  </span>
                  <span className={styles.quickArrow} aria-hidden="true">
                    <Icon name="arrow-right" size={15} />
                  </span>
                </Link>
              )}
              {canReview && (
                <Link href="/review" className={`${styles.quickCard} ${styles.quick_green}`}>
                  <span className={styles.quickIcon}><Icon name="review" size={20} /></span>
                  <span className={styles.quickTitle}>Cola de revisión digital</span>
                  <span className={styles.quickText}>
                    Historias clínicas digitalizadas listas para corregir y validar.
                  </span>
                  <span className={styles.quickArrow} aria-hidden="true">
                    <Icon name="arrow-right" size={15} />
                  </span>
                </Link>
              )}
              {canAdmin && (
                <Link href="/admin" className={`${styles.quickCard} ${styles.quick_slate}`}>
                  <span className={styles.quickIcon}><Icon name="admin" size={20} /></span>
                  <span className={styles.quickTitle}>Administración</span>
                  <span className={styles.quickText}>
                    Usuarios, roles y configuración general del sistema.
                  </span>
                  <span className={styles.quickArrow} aria-hidden="true">
                    <Icon name="arrow-right" size={15} />
                  </span>
                </Link>
              )}
            </div>
          </section>
        </div>

        {/* Actividad reciente */}
        <section className={styles.panel} aria-labelledby="activity-title">
          <div className={styles.panelHeader}>
            <h2 id="activity-title" className={styles.panelTitle}>Actividad reciente</h2>
            {canReview && (
              <Link href="/review" className={styles.panelLink}>Ver todas</Link>
            )}
          </div>

          {stats && stats.recentActivity.length > 0 ? (
            <ul className={styles.activityList}>
              {stats.recentActivity.map((item) => {
                const meta = ACTIVITY_META[item.type];
                const href =
                  item.patientId && item.documentId
                    ? `/patients/${item.patientId}/documents/${item.documentId}`
                    : item.patientId
                      ? `/patients/${item.patientId}`
                      : null;
                const content = (
                  <>
                    <span
                      className={`${styles.activityIcon} ${styles[`activityIcon_${meta.tone}`]}`}
                      aria-hidden="true"
                    >
                      <Icon name={meta.icon} size={16} />
                    </span>
                    <span className={styles.activityBody}>
                      <span className={styles.activityTitle}>{item.title}</span>
                      <span className={styles.activityMeta}>
                        {item.patientName ? `Paciente: ${item.patientName}` : ''}
                        {item.patientCode ? ` · HC: ${item.patientCode}` : ''}
                      </span>
                    </span>
                    <span className={styles.activityRight}>
                      <span className={styles.activityTime}>{formatTime(item.occurredAt)}</span>
                      <span className={`${styles.activityBadge} ${styles[`badge_${meta.tone}`]}`}>
                        {meta.badge}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={item.id}>
                    {href ? (
                      <Link href={href} className={styles.activityItem}>{content}</Link>
                    ) : (
                      <div className={styles.activityItem}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.activityEmpty}>
              {isLoading
                ? 'Cargando actividad…'
                : 'Sin actividad reciente registrada. Las últimas acciones sobre documentos aparecerán aquí.'}
            </p>
          )}
        </section>
      </div>
    </PageShell>
  );
}

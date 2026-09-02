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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
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
  return `${date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })} ${time}`;
}

interface StatCardProps {
  icon: IconName;
  tone: 'blue' | 'amber' | 'green' | 'red';
  label: string;
  value: number | null;
  hint: string | null;
  isLoading: boolean;
  hintTone?: 'up' | 'down' | 'neutral';
}

function StatCard({
  icon,
  tone,
  label,
  value,
  hint,
  isLoading,
  hintTone = 'neutral',
}: StatCardProps) {
  return (
    <article className={`${styles.statCard} ${styles[`statCard_${tone}`]}`}>
      <div className={styles.statTopline}>
        <span className={`${styles.statIcon} ${styles[`statIcon_${tone}`]}`} aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className={styles.statLabel}>{label}</span>
      </div>

      <div className={styles.statBottomline}>
        {isLoading ? (
          <span className={styles.statSkeleton} aria-label={`Cargando ${label}`} />
        ) : (
          <span className={styles.statValue}>{value ?? '—'}</span>
        )}
        {hint && (
          <span className={`${styles.statHint} ${styles[`statHint_${hintTone}`]}`}>{hint}</span>
        )}
      </div>
    </article>
  );
}

const FLOW_STEPS: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'patient', title: 'Paciente', text: 'Selecciona la historia' },
  { icon: 'upload', title: 'Captura', text: 'Carga el documento' },
  { icon: 'scan', title: 'Extracción', text: 'Procesamiento OCR' },
  { icon: 'edit', title: 'Corrección', text: 'Contrasta y ajusta' },
  { icon: 'shield', title: 'Validación', text: 'Cierra con trazabilidad' },
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
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>
            <span className={styles.liveDot} aria-hidden="true" />
            Resumen operativo
          </span>
          <h1 className={styles.greeting}>
            {getGreeting()}, <strong>{getRoleDisplay(permissions)}</strong>.
          </h1>
          <p className={styles.headerCopy}>Todo lo importante de tu jornada clínica, en un solo lugar.</p>
        </div>

        <div className={styles.datePill}>
          <Icon name="calendar" size={16} />
          <span>{formatToday()}</span>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="dashboard-hero-title">
        <div className={styles.heroPattern} aria-hidden="true" />
        <div className={styles.heroGlow} aria-hidden="true" />

        <div className={styles.heroContent}>
          <span className={styles.heroKicker}>
            <Icon name="sparkle" size={14} />
            Flujo clínico conectado
          </span>
          <h2 id="dashboard-hero-title" className={styles.heroTitle}>
            Cada historia, del papel a una decisión confiable.
          </h2>
          <p className={styles.heroText}>
            Digitaliza, contrasta y valida información clínica con un proceso seguro,
            trazable y diseñado para tu equipo.
          </p>

          <div className={styles.heroActions}>
            {canDigitize && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => router.push('/patients')}
              >
                <Icon name="upload" size={17} />
                Nueva digitalización
              </button>
            )}
            {canReview && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => router.push('/review')}
              >
                <Icon name="review" size={17} />
                Abrir revisión
              </button>
            )}
          </div>

          <div className={styles.heroSignals} aria-label="Características de la plataforma">
            <span><Icon name="check" size={14} /> OCR asistido</span>
            <span><Icon name="check" size={14} /> Versionado clínico</span>
            <span><Icon name="check" size={14} /> Acceso por roles</span>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.documentCard}>
            <div className={styles.documentHeader}>
              <span className={styles.documentIdentity}>
                <i />
                <span>
                  <strong>Historia clínica</strong>
                  <small>Documento en análisis</small>
                </span>
              </span>
              <span className={styles.processingBadge}>Procesando</span>
            </div>
            <div className={styles.documentBody}>
              <span className={styles.documentLine} />
              <span className={`${styles.documentLine} ${styles.documentLineMedium}`} />
              <span className={styles.documentField}>
                <i />
                <span><b /><b /></span>
              </span>
              <span className={styles.documentField}>
                <i />
                <span><b /><b /></span>
              </span>
              <span className={styles.scanLine} />
            </div>
          </div>

          <div className={styles.structureChip}>
            <span className={styles.chipIcon}><Icon name="sparkle" size={15} /></span>
            <span><strong>Datos estructurados</strong><small>Extracción asistida</small></span>
          </div>

          <div className={styles.reviewChip}>
            <Icon name="shield" size={17} />
            Listo para revisión
          </div>
        </div>
      </section>

      <section className={styles.statsGrid} aria-label="Indicadores del día">
        <StatCard
          icon="users"
          tone="blue"
          label="Pacientes hoy"
          value={stats?.patientsToday ?? null}
          hint={isLoading ? null : patientsDelta.hint}
          hintTone={patientsDelta.tone}
          isLoading={isLoading}
        />
        <StatCard
          icon="document"
          tone="amber"
          label="Documentos en cola"
          value={stats?.documentsInQueue ?? null}
          hint={isLoading || !stats ? null : 'Esperando procesamiento'}
          hintTone="neutral"
          isLoading={isLoading}
        />
        <StatCard
          icon="shield"
          tone="green"
          label="Listos para validar"
          value={stats?.readyToValidate ?? null}
          hint={isLoading ? null : validateDelta.hint}
          hintTone={validateDelta.tone}
          isLoading={isLoading}
        />
        <StatCard
          icon="alert"
          tone="red"
          label="Errores OCR"
          value={stats?.ocrErrors ?? null}
          hint={isLoading ? null : errorsDelta.hint}
          hintTone={errorsDelta.tone === 'down' ? 'up' : errorsDelta.tone === 'up' ? 'down' : 'neutral'}
          isLoading={isLoading}
        />
      </section>

      <div className={styles.bentoGrid}>
        <section className={`${styles.panel} ${styles.flowPanel}`} aria-labelledby="flow-title">
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>Proceso</span>
              <h2 id="flow-title" className={styles.panelTitle}>Flujo operativo</h2>
            </div>
            <span className={styles.panelMeta}>5 etapas</span>
          </div>

          <ol className={styles.flow}>
            {FLOW_STEPS.map((step, index) => (
              <li key={step.title} className={styles.flowStep}>
                <span className={styles.flowNumber}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.flowIcon} aria-hidden="true">
                  <Icon name={step.icon} size={20} />
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

        <section className={`${styles.panel} ${styles.activityPanel}`} aria-labelledby="activity-title">
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>En tiempo reciente</span>
              <h2 id="activity-title" className={styles.panelTitle}>Actividad</h2>
            </div>
            {canReview && (
              <Link href="/review" className={styles.panelLink}>
                Ver todas <Icon name="arrow-right" size={14} />
              </Link>
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
            <div className={styles.activityEmpty}>
              <span><Icon name={isLoading ? 'clock' : 'sparkle'} size={20} /></span>
              <strong>{isLoading ? 'Cargando actividad' : 'Tu actividad aparecerá aquí'}</strong>
              <p>
                {isLoading
                  ? 'Estamos reuniendo las últimas acciones del equipo.'
                  : 'Aún no hay acciones recientes sobre documentos clínicos.'}
              </p>
            </div>
          )}
        </section>

        <section className={styles.quickSection} aria-labelledby="quick-title">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.panelEyebrow}>Atajos</span>
              <h2 id="quick-title" className={styles.panelTitle}>Continúa tu trabajo</h2>
            </div>
          </div>

          <div className={styles.quickGrid}>
            {can(permissions, 'patients.read') && (
              <Link href="/patients" className={`${styles.quickCard} ${styles.quick_blue}`}>
                <span className={styles.quickTopline}>
                  <span className={styles.quickIcon}><Icon name="patient" size={20} /></span>
                  <span className={styles.quickArrow} aria-hidden="true"><Icon name="arrow-right" size={15} /></span>
                </span>
                <span className={styles.quickTitle}>Pacientes</span>
                <span className={styles.quickText}>Busca fichas, registros y documentos clínicos.</span>
              </Link>
            )}
            {can(permissions, 'records.read') && (
              <Link href="/patients" className={`${styles.quickCard} ${styles.quick_amber}`}>
                <span className={styles.quickTopline}>
                  <span className={styles.quickIcon}><Icon name="records" size={20} /></span>
                  <span className={styles.quickArrow} aria-hidden="true"><Icon name="arrow-right" size={15} /></span>
                </span>
                <span className={styles.quickTitle}>Registro manual</span>
                <span className={styles.quickText}>Crea una atención clínica estructurada.</span>
              </Link>
            )}
            {canReview && (
              <Link href="/review" className={`${styles.quickCard} ${styles.quick_green}`}>
                <span className={styles.quickTopline}>
                  <span className={styles.quickIcon}><Icon name="review" size={20} /></span>
                  <span className={styles.quickArrow} aria-hidden="true"><Icon name="arrow-right" size={15} /></span>
                </span>
                <span className={styles.quickTitle}>Cola de revisión</span>
                <span className={styles.quickText}>Corrige y valida extracciones pendientes.</span>
              </Link>
            )}
            {canAdmin && (
              <Link href="/admin" className={`${styles.quickCard} ${styles.quick_slate}`}>
                <span className={styles.quickTopline}>
                  <span className={styles.quickIcon}><Icon name="admin" size={20} /></span>
                  <span className={styles.quickArrow} aria-hidden="true"><Icon name="arrow-right" size={15} /></span>
                </span>
                <span className={styles.quickTitle}>Administración</span>
                <span className={styles.quickText}>Gestiona usuarios, roles y accesos.</span>
              </Link>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

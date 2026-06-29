'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { can } from '@/shared/permissions/can';
import { PageShell } from '@/shared/components/page-shell';
import { Icon, type IconName } from '@/shared/ui';
import styles from './dashboard.module.css';

interface ModuleCardProps {
  eyebrow?: string;
  icon: IconName;
  title: string;
  description: string;
  href: string;
  actionLabel?: string;
  tone?: 'primary' | 'blue' | 'teal' | 'green' | 'purple';
}

function ModuleCard({
  eyebrow,
  icon,
  title,
  description,
  href,
  actionLabel,
  tone = 'blue',
}: ModuleCardProps) {
  const router = useRouter();

  return (
    <button
      className={`${styles.card} ${styles[tone]}`}
      onClick={() => router.push(href)}
      aria-label={`Ir a ${title}`}
    >
      {eyebrow && <span className={styles.cardEyebrow}>{eyebrow}</span>}
      <div className={styles.cardIconWrap} aria-hidden="true">
        <Icon name={icon} size={24} />
      </div>
      <span className={styles.cardTitle}>{title}</span>
      <span className={styles.cardDesc}>{description}</span>
      {actionLabel && <span className={styles.cardAction}>{actionLabel}</span>}
    </button>
  );
}

export function DashboardView() {
  const { user } = useSession();
  const router = useRouter();

  if (!user) return null;

  const permissions = user.permissions;
  const canDigitize = can(permissions, 'patients.read') && can(permissions, 'documents.read');
  const canReview = can(permissions, 'review.read');

  return (
    <PageShell>
      <section className={styles.hero} aria-labelledby="dashboard-title">
        <div className={styles.heroContent}>
          <p className={styles.kicker}>Plataforma clínica institucional</p>
          <h1 id="dashboard-title" className={styles.greeting}>
            Digitaliza, corrige y valida historias clínicas con trazabilidad.
          </h1>
          <p className={styles.subline}>
            El flujo principal inicia seleccionando un paciente para subir una historia clínica física,
            procesarla y revisar la transcripción antes de validarla.
          </p>
          <div className={styles.heroActions}>
            {canDigitize && (
              <button className={styles.primaryAction} onClick={() => router.push('/patients')}>
                Iniciar digitalización
              </button>
            )}
            {canReview && (
              <button className={styles.secondaryAction} onClick={() => router.push('/review')}>
                Ir a revisión digital
              </button>
            )}
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.documentSheet}>
            <span className={styles.sheetHeader} />
            <span className={styles.sheetLine} />
            <span className={styles.sheetLineShort} />
            <span className={styles.sheetLine} />
            <span className={styles.sheetBadge} />
          </div>
          <div className={styles.reviewPanel}>
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      {canDigitize && (
        <ModuleCard
          eyebrow="Flujo central"
          icon="scan"
          title="Digitalización de historias clínicas"
          description="Selecciona un paciente, sube una historia clínica física y corrige la transcripción antes de validarla."
          href="/patients"
          actionLabel="Iniciar digitalización"
          tone="primary"
        />
      )}

      <div className={styles.grid}>
        {can(permissions, 'patients.read') && (
          <ModuleCard
            icon="patient"
            title="Pacientes"
            description="Buscar pacientes, abrir su ficha y acceder a registros o digitalización."
            href="/patients"
            tone="blue"
          />
        )}
        {(can(permissions, 'records.read') || can(permissions, 'documents.read')) && (
          <ModuleCard
            icon="records"
            title="Registro manual de atención"
            description="Crear y consultar historias clínicas estructuradas registradas manualmente."
            href="/patients"
            tone="teal"
          />
        )}
        {can(permissions, 'review.read') && (
          <ModuleCard
            icon="review"
            title="Cola de revisión digital"
            description="Historias clínicas digitalizadas listas para corregir y validar."
            href="/review"
            tone="green"
          />
        )}
        {can(permissions, 'admin.users.manage') && (
          <ModuleCard
            icon="admin"
            title="Administración"
            description="Usuarios, roles y configuración del sistema."
            href="/admin"
            tone="purple"
          />
        )}
      </div>
    </PageShell>
  );
}

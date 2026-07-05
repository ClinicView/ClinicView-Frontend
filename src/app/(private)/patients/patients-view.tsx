'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/features/auth';
import { PatientList, getPatientStats, type PatientStats } from '@/features/patients';
import { PageShell } from '@/shared/components/page-shell';
import { Icon, type IconName } from '@/shared/ui';
import styles from './patients-view.module.css';

interface StatCardProps {
  icon: IconName;
  tone: 'blue' | 'green' | 'teal' | 'amber';
  label: string;
  value: number | null;
  hint: string;
}

function StatCard({ icon, tone, label, value, hint }: StatCardProps) {
  return (
    <article className={styles.statCard}>
      <span className={`${styles.statIcon} ${styles[`stat_${tone}`]}`} aria-hidden="true">
        <Icon name={icon} size={19} />
      </span>
      <div className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value ?? '—'}</span>
        <span className={styles.statHint}>{hint}</span>
      </div>
    </article>
  );
}

function PatientsContent() {
  const { user } = useSession();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('q') ?? '';
  const [stats, setStats] = useState<PatientStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPatientStats()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        // El mini-dashboard es informativo; la lista funciona sin él.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  return (
    <PageShell>
      <section className={styles.digitizationGuide}>
        <div className={styles.guideIcon} aria-hidden="true">
          <Icon name="patient" size={24} />
        </div>
        <div>
          <h1 className={styles.guideTitle}>Selecciona un paciente para digitalizar su historia clínica</h1>
          <p className={styles.guideText}>
            Para digitalizar una historia clínica, primero selecciona o registra al paciente. Luego podrás subir PDF o imágenes, procesarlas y corregir la transcripción.
          </p>
        </div>
      </section>

      {/* Mini-dashboard de pacientes */}
      <section className={styles.statsGrid} aria-label="Indicadores de pacientes">
        <StatCard
          icon="users"
          tone="blue"
          label="Pacientes totales"
          value={stats?.total ?? null}
          hint={stats ? `${stats.active} activos` : 'Registrados en el sistema'}
        />
        <StatCard
          icon="check"
          tone="green"
          label="Activos"
          value={stats?.active ?? null}
          hint="Disponibles para atención"
        />
        <StatCard
          icon="folder"
          tone="teal"
          label="Documentación reciente"
          value={stats?.withRecentDocs ?? null}
          hint="Con documentos en los últimos 30 días"
        />
        <StatCard
          icon="clock"
          tone="amber"
          label="Con pendientes"
          value={stats?.withPendingDocs ?? null}
          hint="Documentos por procesar o validar"
        />
      </section>

      <h1 className="viewHeading">Pacientes</h1>
      <PatientList permissions={user.permissions} initialSearch={initialSearch} />
    </PageShell>
  );
}

export function PatientsView() {
  return (
    <Suspense fallback={null}>
      <PatientsContent />
    </Suspense>
  );
}

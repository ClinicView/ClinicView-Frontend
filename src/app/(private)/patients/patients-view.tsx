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
    <article className={`${styles.statCard} ${styles[`statCard_${tone}`]}`}>
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
        // El resumen es informativo; la lista sigue disponible sin él.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  return (
    <PageShell>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>
          <span aria-hidden="true" /> Directorio clínico
        </span>
        <h1 className={styles.pageTitle}>Pacientes</h1>
        <p className={styles.pageDescription}>
          Encuentra una ficha, revisa su historia o inicia una nueva digitalización.
        </p>
      </header>

      <section className={styles.digitizationGuide} aria-labelledby="digitization-guide-title">
        <div className={styles.guideIcon} aria-hidden="true">
          <Icon name="scan" size={22} />
        </div>
        <div className={styles.guideContent}>
          <span className={styles.guideKicker}>Punto de partida</span>
          <h2 id="digitization-guide-title" className={styles.guideTitle}>
            Toda digitalización comienza en la ficha del paciente
          </h2>
          <p className={styles.guideText}>
            Selecciona una persona registrada o crea una nueva ficha para cargar PDF e imágenes,
            procesarlas y revisar la transcripción clínica.
          </p>
        </div>
        <div className={styles.guideFlow} aria-hidden="true">
          <span><Icon name="patient" size={16} /></span>
          <i />
          <span><Icon name="upload" size={16} /></span>
          <i />
          <span><Icon name="check" size={16} /></span>
        </div>
      </section>

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
          hint="Últimos 30 días"
        />
        <StatCard
          icon="clock"
          tone="amber"
          label="Con pendientes"
          value={stats?.withPendingDocs ?? null}
          hint="Por procesar o validar"
        />
      </section>

      <section className={styles.directory} aria-labelledby="patient-directory-title">
        <div className={styles.directoryHeader}>
          <div>
            <span className={styles.directoryEyebrow}>Directorio</span>
            <h2 id="patient-directory-title" className={styles.directoryTitle}>Fichas registradas</h2>
          </div>
        </div>
        <PatientList permissions={user.permissions} initialSearch={initialSearch} />
      </section>
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

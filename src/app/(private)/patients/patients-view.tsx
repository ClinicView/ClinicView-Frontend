'use client';

import { useSession } from '@/features/auth';
import { PatientList } from '@/features/patients';
import { PageShell } from '@/shared/components/page-shell';
import { Icon } from '@/shared/ui';
import styles from './patients-view.module.css';

export function PatientsView() {
  const { user } = useSession();
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
      <h1 className="viewHeading">Pacientes</h1>
      <PatientList permissions={user.permissions} />
    </PageShell>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { DocumentDetail } from '@/features/medical-documents';
import { PageShell } from '@/shared/components/page-shell';
import { Icon } from '@/shared/ui';
import styles from '@/features/medical-documents/components/correction-view.module.css';

interface DocumentDetailViewProps {
  patientId: string;
  docId: string;
}

export function DocumentDetailView({ patientId, docId }: DocumentDetailViewProps) {
  const { user } = useSession();
  const router = useRouter();

  if (!user) return null;

  return (
    <PageShell>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <Link href={`/patients/${patientId}/documents`}>Digitalización</Link>
        <span aria-hidden="true">›</span>
        <span>Corrección de historia clínica</span>
      </nav>
      <header className={styles.pageHeaderRow}>
        <div>
          <h1 className={styles.pageTitle}>Corrección de historia clínica</h1>
          <p className={styles.pageSubtitle}>
            Revisa el OCR, corrige errores y valida la versión final.
          </p>
        </div>
        <div className={styles.pageHeaderActions}>
          <button className={styles.btn} type="button" onClick={() => router.back()}>
            ‹ Volver
          </button>
          <Link href={`/patients/${patientId}`} className={`${styles.btn} ${styles.btnLink}`}>
            <Icon name="patient" size={15} />
            Ver perfil del paciente
          </Link>
        </div>
      </header>

      <DocumentDetail patientId={patientId} docId={docId} permissions={user.permissions} />
    </PageShell>
  );
}

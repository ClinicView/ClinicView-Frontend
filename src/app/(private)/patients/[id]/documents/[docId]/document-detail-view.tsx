'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { DocumentDetail } from '@/features/medical-documents';
import { useDocumentNavigationGuard } from '@/features/medical-documents/hooks/use-document-navigation-guard';
import { PageShell } from '@/shared/components/page-shell';
import { can } from '@/shared/permissions/can';
import { Icon } from '@/shared/ui';
import styles from '@/features/medical-documents/components/correction-view.module.css';

interface DocumentDetailViewProps {
  patientId: string;
  docId: string;
}

export function DocumentDetailView({ patientId, docId }: DocumentDetailViewProps) {
  const { user } = useSession();
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const confirmExit = useDocumentNavigationGuard(dirty);

  if (!user) return null;

  return (
    <PageShell>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <Link href={`/patients/${patientId}/documents`}>Digitalización</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Corrección de historia clínica</span>
      </nav>
      <header className={styles.pageHeaderRow}>
        <div>
          <h1 className={styles.pageTitle}>Corrección de historia clínica</h1>
          <p className={styles.pageSubtitle}>
            Revisa el OCR, corrige errores y valida la versión final.
          </p>
        </div>
        <div className={styles.pageHeaderActions}>
          <button className={styles.btn} type="button" onClick={() => { if (confirmExit()) router.back(); }}>
            <Icon name="chevron-right" size={15} className={styles.previousIcon} />
            Volver
          </button>
          {can(user.permissions, 'patients.read') && (
            <Link href={`/patients/${patientId}`} className={`${styles.btn} ${styles.btnLink}`}>
              <Icon name="patient" size={15} />
              Ver perfil del paciente
            </Link>
          )}
        </div>
      </header>

      <DocumentDetail key={`${patientId}/${docId}`} patientId={patientId} docId={docId} permissions={user.permissions} onDirtyChange={setDirty} />
    </PageShell>
  );
}

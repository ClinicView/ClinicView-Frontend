'use client';

import Link from 'next/link';
import { useSession } from '@/features/auth';
import { DocumentList } from '@/features/medical-documents';
import { PageShell } from '@/shared/components/page-shell';
import { can } from '@/shared/permissions/can';
import { Icon } from '@/shared/ui';
import styles from './documents-view.module.css';

interface DocumentsViewProps {
  patientId: string;
}

export function DocumentsView({ patientId }: DocumentsViewProps) {
  const { user } = useSession();

  if (!user) return null;

  return (
    <PageShell>
      {can(user.permissions, 'patients.read') && (
        <Link href={`/patients/${patientId}`} className={`viewBack ${styles.backLink}`}>
          <Icon name="chevron-right" size={16} className={styles.previousIcon} />
          Volver al paciente
        </Link>
      )}
      <h1 className="viewHeading">Digitalización de historias clínicas</h1>
      <p className="viewSubheading">
        {can(user.permissions, 'documents.upload')
          ? 'Sube PDF o imágenes de historias clínicas físicas y consulta su avance.'
          : 'Consulta las historias clínicas digitalizadas y su estado de procesamiento.'}
      </p>
      {can(user.permissions, 'documents.upload') && (
        <section className={styles.patientNotice} aria-label="Información sobre la carga de documentos">
          <Icon name="patient" size={20} />
          <p>
            Los nuevos archivos quedarán asociados a la ficha del paciente seleccionada.
          </p>
        </section>
      )}
      <DocumentList patientId={patientId} permissions={user.permissions} />
    </PageShell>
  );
}

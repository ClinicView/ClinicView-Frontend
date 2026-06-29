'use client';

import Link from 'next/link';
import { useSession } from '@/features/auth';
import { DocumentList } from '@/features/medical-documents';
import { PageShell } from '@/shared/components/page-shell';
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
      <Link href={`/patients/${patientId}`} className="viewBack">
        ← Volver al paciente
      </Link>
      <h1 className="viewHeading">Digitalización de historias clínicas</h1>
      <p className="viewSubheading">
        Sube PDF o imágenes de historias clínicas físicas, procesa el archivo, corrige el OCR y valida la versión final.
      </p>
      <section className={styles.patientNotice}>
        <Icon name="patient" size={20} />
        <p>
          Actualmente debes seleccionar un paciente antes de subir una historia clínica. En una versión posterior, el sistema podrá sugerir el paciente automáticamente a partir del documento digitalizado.
        </p>
      </section>
      <DocumentList patientId={patientId} permissions={user.permissions} />
    </PageShell>
  );
}

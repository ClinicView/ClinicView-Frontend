'use client';

import Link from 'next/link';
import { useSession } from '@/features/auth';
import { RecordList } from '@/features/clinical-records';
import { PageShell } from '@/shared/components/page-shell';

interface RecordsViewProps {
  patientId: string;
}

export function RecordsView({ patientId }: RecordsViewProps) {
  const { user } = useSession();

  if (!user) return null;

  return (
    <PageShell>
      <Link href={`/patients/${patientId}`} className="viewBack">
        ← Volver al paciente
      </Link>
      <h1 className="viewHeading">Registro manual de atención clínica</h1>
      <p className="viewSubheading">
        Consulta o registra historias clínicas estructuradas. Para subir PDF o imágenes de historias físicas, usa Digitalización.
      </p>
      <RecordList patientId={patientId} permissions={user.permissions} />
    </PageShell>
  );
}

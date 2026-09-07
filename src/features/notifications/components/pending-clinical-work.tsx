'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useClinicalPage } from '@/features/clinical-records/hooks/use-clinical-page';
import { ClinicalPageControls } from '@/features/clinical-records/components/clinical-page-controls';
import { formatInstant } from '@/shared/lib/date-time';
import type { components } from '@/shared/types/api.generated';
import styles from '@/features/clinical-records/components/clinical-workflow.module.css';
import { useSession } from '@/features/auth';

export function PendingClinicalWork({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const [kind, setKind] = useState('');
  const { user } = useSession();
  const permissions = user?.permissions ?? [];
  const enabled =
    permissions.includes('patients.read') &&
    (permissions.includes('records.create') ||
      (permissions.includes('records.read') && permissions.includes('records.confirm')) ||
      (permissions.includes('documents.read') && permissions.includes('documents.validate')));
  const tasks = useClinicalPage<components['schemas']['ClinicalWorkItemDto']>(
    `/clinical-work?limit=${compact ? 3 : 20}${kind ? `&kind=${kind}` : ''}`,
    'tareas pendientes',
    enabled,
  );
  if (compact && !enabled) return null;
  return (
    <section className={styles.panel}>
      <h2>Pendientes actuales</h2>
      <p>
        Atenciones que registraste o tienes a cargo y requieren confirmación, documentos asignados y
        tus borradores. Se retiran al resolverlos; marcarlos como leídos no los completa.
      </p>
      {!compact && (
        <label>
          Tipo de tarea
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="">Todas</option>
            <option value="CONFIRMATION">Confirmación clínica</option>
            <option value="DOCUMENT">Revisión documental</option>
            <option value="DRAFT">Borradores</option>
          </select>
        </label>
      )}
      <ClinicalPageControls
        state={{ ...tasks, hasMore: !compact && tasks.hasMore }}
        resource="tareas pendientes"
      />
      {tasks.total === 0 && <p>No tienes pendientes de estos tipos con tus permisos actuales.</p>}
      <ul>
        {tasks.items.map((task) => (
          <li key={task.id}>
            <Link
              onClick={onNavigate}
              href={`/patients/${task.patientId}/${task.kind === 'DOCUMENT' ? `documents/${task.resourceId}` : task.kind === 'DRAFT' ? 'records/new' : `records/${task.resourceId}`}`}
            >
              {task.title} · {task.patientName}
            </Link>
            <p>Registrado: {formatInstant(task.createdAt)}</p>
          </li>
        ))}
      </ul>
      {compact && (
        <Link href="/worklist" onClick={onNavigate}>
          Ver todas mis tareas pendientes →
        </Link>
      )}
    </section>
  );
}

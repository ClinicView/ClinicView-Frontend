'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { listRecords } from '../services/records.service';
import { PagedClinicalSource } from '@/shared/lib/paged-clinical-source';
import { Alert } from '@/shared/ui';
import { formatInstant } from '@/shared/lib/date-time';
import styles from './clinical-workflow.module.css';

export function DocumentLinkedRecords({ patientId, documentId, canPublish }: { patientId: string; documentId: string; canPublish: boolean }) {
  const source = useMemo(() => new PagedClinicalSource(true, (page) => listRecords(patientId, { page, limit: 20, status: 'ALL', sourceDocumentId: documentId }), 'las atenciones vinculadas'), [patientId, documentId]);
  const state = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getServerSnapshot);
  useEffect(() => { void source.reload(); return source.cancel; }, [source]);
  return <section className={styles.panel}>
    <header><h2>Atenciones vinculadas a este original</h2>{canPublish && <Link href={`/patients/${patientId}/records/new?sourceDocument=${documentId}`}>Registrar atención desde este documento</Link>}</header>
    <p>Un documento puede contener varias atenciones. Cada una conserva su fecha, profesional y páginas de origen; las versiones corregidas no son atenciones adicionales.</p>
    {state.error && <Alert variant="error">{state.error}</Alert>}
    <p role="status">{state.loading ? 'Cargando…' : `${state.items.length} de ${state.total ?? '—'} versiones vinculadas`}</p>
    <ul>{state.items.map((record) => <li key={record.id}><Link href={`/patients/${patientId}/records/${record.id}`}>{formatInstant(record.attendedAt)} · {record.summary.slice(0, 100)}</Link> · {record.status === 'ACTIVE' ? 'Activo' : record.status === 'CORRECTED' ? 'Corregido' : 'Anulado'} · Páginas {record.source?.pageFrom}–{record.source?.pageTo}</li>)}</ul>
    {(state.hasMore || state.error) && <button type="button" disabled={state.loading} onClick={() => void (state.page ? source.loadMore() : source.reload())}>{state.error ? 'Reintentar' : 'Cargar más'}</button>}
  </section>;
}

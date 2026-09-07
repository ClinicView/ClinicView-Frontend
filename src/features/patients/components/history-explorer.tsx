'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/features/auth';
import type { components } from '@/shared/types/api.generated';
import { PageShell } from '@/shared/components/page-shell';
import { can } from '@/shared/permissions/can';
import { formatDateOnly, formatInstant, isValidDateOnly } from '@/shared/lib/date-time';
import { Alert } from '@/shared/ui';
import { ContextHelp } from '@/shared/ui/context-help';
import { RECORD_TYPE_OPTIONS } from '@/features/clinical-records/lib/record-type-definitions';
import { useClinicalPage } from '@/features/clinical-records/hooks/use-clinical-page';
import { ClinicalPageControls } from '@/features/clinical-records/components/clinical-page-controls';
import { HistoryExportPanel } from './history-export-panel';
import styles from '@/features/clinical-records/components/clinical-workflow.module.css';
const STATUS: Record<string, string> = {
  ACTIVE: 'Atención vigente',
  CORRECTED: 'Versión corregida',
  VOIDED: 'Atención anulada',
  PENDING: 'Documento pendiente',
  PROCESSING: 'Documento procesándose',
  PROCESSED: 'Documento en revisión',
  FAILED: 'Documento con error',
  VALIDATED: 'Documento validado',
  REJECTED: 'Documento rechazado',
};
const KEYS = [
  'q',
  'from',
  'to',
  'episodeId',
  'kind',
  'recordType',
  'status',
  'confirmation',
] as const;

export function HistoryExplorer({ patientId }: { patientId: string }) {
  const { user } = useSession();
  const permissions = user?.permissions ?? [];
  const params = useSearchParams();
  const [query, setQuery] = useState(() => {
    const values = new URLSearchParams();
    for (const key of KEYS) if (params.get(key)) values.set(key, params.get(key)!);
    return values.toString();
  });
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const applied = new URLSearchParams(query);
  const history = useClinicalPage<components['schemas']['HistoryEntryDto']>(
    `/patients/${patientId}/clinical-history/search?${query}`,
    'resultados de toda la historia',
    Boolean(user),
  );
  const episodes = useClinicalPage<components['schemas']['EpisodeOverviewDto']>(
    `/patients/${patientId}/episodes`,
    'episodios para filtrar',
    can(permissions, 'records.read'),
  );
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of KEYS) {
      const value = String(form.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    const from = next.get('from');
    const to = next.get('to');
    if (
      (from && !isValidDateOnly(from)) ||
      (to && !isValidDateOnly(to)) ||
      (from && to && from > to)
    ) {
      setError('Revisa las fechas: el inicio no puede ser posterior al fin.');
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setError('');
    setQuery(next.toString());
    if (next.toString() === query) void history.reload();
  }
  return (
    <PageShell>
      <Link className="viewBack" href={`/patients/${patientId}`}>
        ← Volver al paciente
      </Link>
      <section className={styles.panel}>
        <header>
          <h1>Explorar toda la historia</h1>
          <ContextHelp title="Búsqueda completa y fechas" compact>
            <p>
              La consulta se ejecuta en el servidor sobre todas las páginas disponibles según tus
              permisos. Incluye el contenido de atenciones y el texto validado de documentos, además
              de su identificación y procedencia. No busca el contenido clínico aún sin validar.
            </p>
            <p>
              Los filtros se combinan. Los períodos documentales coinciden por solapamiento; un
              archivo sin fecha clínica no coincide con un filtro de fecha. La fecha de carga solo
              ordena archivos sin fecha clínica y se identifica como tal.
            </p>
            <p>
              Las versiones corregidas/anuladas conservan su estado. Para revisar pendientes
              actuales elige atención vigente y sin confirmación.
            </p>
          </ContextHelp>
        </header>
        <form key={query} onSubmit={search}>
          <label>
            Texto, profesional, servicio o contenido
            <input name="q" type="search" maxLength={200} defaultValue={applied.get('q') ?? ''} />
          </label>
          <div className={styles.fields}>
            <label>
              Desde (fecha clínica)
              <input name="from" type="date" defaultValue={applied.get('from') ?? ''} />
            </label>
            <label>
              Hasta (fecha clínica)
              <input name="to" type="date" defaultValue={applied.get('to') ?? ''} />
            </label>
            <label>
              Origen
              <select name="kind" defaultValue={applied.get('kind') ?? ''}>
                <option value="">Todos los disponibles</option>
                <option value="RECORD">Atenciones</option>
                <option value="DOCUMENT">Documentos</option>
              </select>
            </label>
            <label>
              Estado
              <select name="status" defaultValue={applied.get('status') ?? ''}>
                <option value="">Todos</option>
                {Object.entries(STATUS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {can(permissions, 'records.read') && (
              <>
                <label>
                  Tipo de atención
                  <select name="recordType" defaultValue={applied.get('recordType') ?? ''}>
                    <option value="">Cualquiera</option>
                    {RECORD_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Confirmación de atenciones
                  <select name="confirmation" defaultValue={applied.get('confirmation') ?? ''}>
                    <option value="">Cualquiera</option>
                    <option value="PENDING">Sin confirmación</option>
                    <option value="CONFIRMED">Confirmadas</option>
                  </select>
                </label>
                <label>
                  Episodio
                  <select name="episodeId" defaultValue={applied.get('episodeId') ?? ''}>
                    <option value="">Todos</option>
                    {applied.get('episodeId') &&
                      !episodes.items.some((item) => item.id === applied.get('episodeId')) && (
                        <option value={applied.get('episodeId')!}>Episodio del enlace</option>
                      )}
                    {episodes.items.map((episode) => (
                      <option key={episode.id} value={episode.id}>
                        {episode.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          {can(permissions, 'records.read') && (episodes.hasMore || episodes.error) && (
            <ClinicalPageControls state={episodes} resource="episodios para filtrar" />
          )}
          <div className={styles.actions}>
            <button type="submit" disabled={history.loading}>
              Buscar en toda la historia
            </button>
            <button
              type="button"
              disabled={history.loading}
              onClick={() => {
                setQuery('');
                setError('');
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </form>
        {error && (
          <div ref={errorRef} tabIndex={-1}>
            <Alert variant="error">{error}</Alert>
          </div>
        )}
        <ClinicalPageControls state={history} resource="resultados de toda la historia" />
        {history.total === 0 && (
          <p>
            No hay coincidencias para estos filtros. Puedes ampliarlos; las atenciones no se han
            eliminado.
          </p>
        )}
        {history.items.map((entry) => (
          <article key={`${entry.kind}-${entry.id}`} className={styles.panel}>
            <header>
              <h2>
                <Link
                  href={`/patients/${patientId}/${entry.kind === 'RECORD' ? 'records' : 'documents'}/${entry.id}`}
                >
                  {entry.kind === 'RECORD'
                    ? (RECORD_TYPE_OPTIONS.find((type) => type.value === entry.recordType)?.label ??
                      'Atención')
                    : entry.title}
                </Link>
              </h2>
              <span>{STATUS[entry.status] ?? entry.status}</span>
            </header>
            <p>
              {entry.clinicalFrom
                ? `Fecha clínica: ${formatDateOnly(entry.clinicalFrom)}${entry.clinicalTo && entry.clinicalTo !== entry.clinicalFrom ? ` — ${formatDateOnly(entry.clinicalTo)}` : ''}`
                : `Sin fecha clínica; carga: ${formatInstant(entry.createdAt)}`}
            </p>
            <p>
              {[entry.professional, entry.service, entry.specialty, entry.episodeTitle]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p>{entry.preview}</p>
            {entry.kind === 'RECORD' && (
              <p>
                {entry.confirmed
                  ? 'Con confirmación de esta versión'
                  : 'Sin confirmación registrada'}
              </p>
            )}
          </article>
        ))}
      </section>
      {can(permissions, 'records.read') && can(permissions, 'documents.read') && (
        <HistoryExportPanel patientId={patientId} episodes={episodes.items} />
      )}
    </PageShell>
  );
}

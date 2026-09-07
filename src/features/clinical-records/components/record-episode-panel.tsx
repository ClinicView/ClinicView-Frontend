'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { components } from '@/shared/types/api.generated';
import { apiPatch } from '@/shared/services/api-client';
import { can } from '@/shared/permissions/can';
import { Alert } from '@/shared/ui';
import { ContextHelp } from '@/shared/ui/context-help';
import { useClinicalPage } from '../hooks/use-clinical-page';
import { ClinicalPageControls } from './clinical-page-controls';
import type { ClinicalRecord } from '../types/record';
import styles from './clinical-workflow.module.css';

export function RecordEpisodePanel({ record, permissions, onChanged }: { record: ClinicalRecord; permissions: string[]; onChanged: () => Promise<void> }) {
  const editable = record.status === 'ACTIVE' && record.episode?.status !== 'CLOSED' && can(permissions, 'records.create') && can(permissions, 'patients.read');
  const episodes = useClinicalPage<components['schemas']['EpisodeOverviewDto']>(`/patients/${record.patientId}/episodes?status=OPEN`, 'episodios abiertos', editable);
  const [selected, setSelected] = useState(record.episode?.id ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try { await apiPatch(`/patients/${record.patientId}/records/${record.id}/episode`, { episodeId: selected || null, expectedRecordVersion: record.version, reason: reason.trim() }); await onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el episodio. Recarga la atención.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.panel} aria-label="Episodio de la atención">
    <header><h2>Episodio clínico</h2><ContextHelp title="Agrupar atenciones relacionadas" compact><p>Un episodio reúne atenciones del mismo seguimiento sin fusionarlas. La asignación no modifica el contenido confirmado. Los cambios conservan su motivo e historial.</p><p>Solo se agrupan versiones vigentes en episodios abiertos. Una corrección hereda el episodio; la versión original conserva su agrupación histórica.</p></ContextHelp></header>
    <p>{record.episode ? `${record.episode.title} · ${record.episode.status === 'OPEN' ? 'Abierto' : 'Cerrado'}` : 'Sin episodio asignado.'}</p>
    <Link href={`/patients/${record.patientId}/episodes`}>Ver y gestionar episodios del paciente</Link>
    {record.episode?.status === 'CLOSED' && <p>Reabre el episodio con motivo antes de corregir, anular o cambiar la agrupación.</p>}
    {editable && <details><summary>Cambiar agrupación</summary>
      <label>Episodio abierto<select disabled={busy || episodes.loading} value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Sin episodio</option>{record.episode && !episodes.items.some((episode) => episode.id === record.episode?.id) && <option value={record.episode.id}>{record.episode.title} (actual)</option>}{episodes.items.map((episode) => <option key={episode.id} value={episode.id}>{episode.title} · Desde {episode.startedOn}</option>)}</select></label>
      <ClinicalPageControls state={episodes} resource="episodios abiertos" />
      <label>Motivo del cambio (mínimo 10 caracteres)<textarea minLength={10} maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /></label>
      <button type="button" disabled={busy || reason.trim().length < 10 || selected === (record.episode?.id ?? '')} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar agrupación'}</button>
    </details>}
    {error && <Alert variant="error">{error}<button type="button" disabled={busy} onClick={() => void onChanged()}>Recargar atención</button></Alert>}
  </section>;
}

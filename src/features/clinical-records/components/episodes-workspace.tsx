'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSession } from '@/features/auth';
import { PageShell } from '@/shared/components/page-shell';
import { apiPatch, apiPost } from '@/shared/services/api-client';
import { can } from '@/shared/permissions/can';
import { currentDateOnly, formatDateOnly, formatInstant } from '@/shared/lib/date-time';
import { ContextHelp } from '@/shared/ui/context-help';
import { Alert } from '@/shared/ui';
import type { components } from '@/shared/types/api.generated';
import type { ClinicalRecord } from '../types/record';
import { useClinicalPage } from '../hooks/use-clinical-page';
import { ClinicalPageControls } from './clinical-page-controls';
import styles from './clinical-workflow.module.css';

type Episode = components['schemas']['EpisodeOverviewDto'];
type EpisodeEvent = components['schemas']['EpisodeEventDto'];
const ACTIONS: Record<string, string> = { CREATE: 'Creación', UPDATE: 'Edición', CLOSE: 'Cierre', REOPEN: 'Reapertura', ATTACH: 'Atención incorporada', DETACH: 'Atención retirada', CORRECT: 'Corrección clínica', VOID: 'Anulación clínica' };

function EpisodeEditor({ patientId, episode, onSaved }: { patientId: string; episode?: Episode; onSaved: () => Promise<void> }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const body = { title: String(data.get('title')).trim(), description: String(data.get('description')).trim(), startedOn: String(data.get('startedOn')), reason: String(data.get('reason')).trim(), ...(episode ? { expectedVersion: episode.version } : {}) };
    setBusy(true); setError('');
    try { if (episode) await apiPatch(`/patients/${patientId}/episodes/${episode.id}`, body); else await apiPost(`/patients/${patientId}/episodes`, body); form.reset(); await onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el episodio.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={(event) => void save(event)}><fieldset disabled={busy} className={styles.fieldset}><legend>{episode ? 'Editar episodio abierto' : 'Nuevo episodio'}</legend>
    <div className={styles.fields}><label>Título del seguimiento<input name="title" required minLength={3} maxLength={180} defaultValue={episode?.title} placeholder="Por ejemplo: seguimiento de una atención" /></label><label>Fecha de inicio<input name="startedOn" type="date" required max={currentDateOnly()} defaultValue={episode?.startedOn} /></label></div>
    <label>Descripción (opcional)<textarea name="description" maxLength={2000} defaultValue={episode?.description ?? ''} /></label>
    <label>Motivo de {episode ? 'edición' : 'apertura'}<textarea name="reason" required minLength={10} maxLength={2000} /></label><p>No se crean diagnósticos ni atenciones automáticamente. Elige la fecha clínica real.</p>
    <button type="submit">{busy ? 'Guardando…' : episode ? 'Guardar cambios' : 'Crear episodio'}</button>
  </fieldset>{error && <Alert variant="error">{error}</Alert>}</form>;
}

function EpisodeContent({ patientId, episode, permissions, onChanged }: { patientId: string; episode: Episode; permissions: string[]; onChanged: () => Promise<void> }) {
  const records = useClinicalPage<ClinicalRecord>(`/patients/${patientId}/records?status=ALL&episodeId=${episode.id}&limit=20`, 'versiones del episodio');
  const events = useClinicalPage<EpisodeEvent>(`/patients/${patientId}/episodes/${episode.id}/history`, 'cambios del episodio');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function transition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('');
    try { await apiPost(`/patients/${patientId}/episodes/${episode.id}/transition`, { expectedVersion: episode.version, action: episode.status === 'OPEN' ? 'CLOSE' : 'REOPEN', ...(episode.status === 'OPEN' ? { endedOn: String(form.get('endedOn')) } : {}), reason: String(form.get('reason')).trim(), attested: form.get('attested') === 'on' }); await onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado. Recarga el episodio.'); }
    finally { setBusy(false); }
  }
  return <div>
    <h3>Atenciones y versiones</h3><p>Abre una atención para asignarla o cambiar su episodio. Las versiones corregidas no cuentan como atenciones vigentes.</p>
    <ul>{records.items.map((record) => <li key={record.id}><Link href={`/patients/${patientId}/records/${record.id}`}>{formatInstant(record.attendedAt)} · {record.summary.slice(0, 120)}</Link> · {record.status === 'ACTIVE' ? 'Vigente' : record.status === 'CORRECTED' ? 'Corregida' : 'Anulada'} · {record.confirmation ? 'Confirmada' : 'Sin confirmación'}</li>)}</ul>
    <ClinicalPageControls state={records} resource="versiones del episodio" />
    {episode.status === 'OPEN' && can(permissions, 'records.create') && <details><summary>Editar identificación del episodio</summary><EpisodeEditor patientId={patientId} episode={episode} onSaved={onChanged} /></details>}
    {can(permissions, 'records.confirm') && <details><summary>{episode.status === 'OPEN' ? 'Cerrar episodio' : 'Reabrir episodio'}</summary>
      <form onSubmit={(event) => void transition(event)}><fieldset disabled={busy} className={styles.fieldset}><legend>{episode.status === 'OPEN' ? 'Confirmar cierre' : 'Confirmar reapertura'}</legend>
        <p>El cierre requiere al menos una atención vigente y todas confirmadas. No equivale a alta hospitalaria ni firma digital.</p>
        {episode.status === 'OPEN' && <label>Fecha clínica de cierre<input name="endedOn" type="date" min={episode.startedOn} max={currentDateOnly()} required /></label>}
        <label>Motivo<textarea name="reason" required minLength={10} maxLength={2000} /></label>
        <label className={styles.check}><input name="attested" type="checkbox" required />He revisado el episodio y confirmo este cambio de estado.</label>
        <button type="submit">{busy ? 'Guardando…' : episode.status === 'OPEN' ? 'Confirmar cierre' : 'Confirmar reapertura'}</button>
      </fieldset>{error && <Alert variant="error">{error}</Alert>}</form>
    </details>}
    <h3>Historial de agrupación</h3><ol>{events.items.map((entry) => <li key={entry.id}><p><strong>{ACTIONS[entry.action] ?? entry.action}</strong> · {formatInstant(entry.createdAt, { dateStyle: 'medium', timeStyle: 'short' })} · {entry.actorName}</p><p>{entry.reason}</p>{entry.recordId && <Link href={`/patients/${patientId}/records/${entry.recordId}`}>Ver versión relacionada</Link>}<details><summary>Datos del cambio</summary><pre className={styles.json}>{JSON.stringify(entry.payload, null, 2)}</pre></details></li>)}</ol>
    <ClinicalPageControls state={events} resource="cambios del episodio" />
  </div>;
}

export function EpisodesWorkspace({ patientId }: { patientId: string }) {
  const { user } = useSession(); const permissions = user?.permissions ?? [];
  const [status, setStatus] = useState(''); const [opened, setOpened] = useState('');
  const episodes = useClinicalPage<Episode>(`/patients/${patientId}/episodes${status ? `?status=${status}` : ''}`, 'episodios', can(permissions, 'records.read') && can(permissions, 'patients.read'));
  return <PageShell><Link href={`/patients/${patientId}`} className="viewBack">← Volver al paciente</Link>
    <section className={styles.panel}><header><h1>Episodios clínicos</h1><ContextHelp title="Continuidad de un seguimiento" compact><p>Un episodio agrupa consultas, resultados y seguimientos relacionados. Cada atención conserva su estructura, fecha, autoría, confirmación y adjuntos.</p><p>Crea el episodio y luego asigna las atenciones desde su detalle. Para modificar atenciones de un episodio cerrado, reábrelo con motivo. Los cambios quedan registrados.</p></ContextHelp></header>
      <Link href={`/patients/${patientId}/records`}>Abrir atenciones para agrupar</Link>
      {can(permissions, 'records.create') && <details><summary>Crear episodio</summary><EpisodeEditor patientId={patientId} onSaved={episodes.reload} /></details>}
      <label>Estado<select value={status} onChange={(event) => { setStatus(event.target.value); setOpened(''); }}><option value="">Todos</option><option value="OPEN">Abiertos</option><option value="CLOSED">Cerrados</option></select></label>
      <ClinicalPageControls state={episodes} resource="episodios" />
      {episodes.total === 0 && <p>Todavía no hay episodios en esta vista. Las atenciones sin agrupar siguen disponibles en la historia.</p>}
      {episodes.items.map((episode) => <article className={styles.panel} key={`${episode.id}-${episode.version}`}><header><h2>{episode.title}</h2><span>{episode.status === 'OPEN' ? 'Abierto' : 'Cerrado'}</span></header><p>{formatDateOnly(episode.startedOn)}{episode.endedOn ? ` — ${formatDateOnly(episode.endedOn)}` : ' — En seguimiento'}</p>{episode.description && <p>{episode.description}</p>}<p>{episode.activeCount} atenciones vigentes · {episode.pendingConfirmationCount} pendientes de confirmar · {episode.recordsCount} versiones en total</p>
        <button type="button" aria-expanded={opened === episode.id} aria-controls={`episode-${episode.id}`} onClick={() => setOpened(opened === episode.id ? '' : episode.id)}>{opened === episode.id ? 'Ocultar detalle' : 'Abrir detalle y acciones'}</button>
        {opened === episode.id && <div id={`episode-${episode.id}`}><EpisodeContent patientId={patientId} episode={episode} permissions={permissions} onChanged={episodes.reload} /></div>}
      </article>)}
    </section></PageShell>;
}

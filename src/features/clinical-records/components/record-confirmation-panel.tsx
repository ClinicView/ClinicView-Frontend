'use client';

import { useState } from 'react';
import type { ClinicalRecord } from '../types/record';
import { apiPost } from '@/shared/services/api-client';
import { can } from '@/shared/permissions/can';
import { formatInstant } from '@/shared/lib/date-time';
import { ContextHelp } from '@/shared/ui/context-help';
import { Alert } from '@/shared/ui';
import styles from './clinical-workflow.module.css';

export function RecordConfirmationPanel({ record, permissions, onConfirmed }: { record: ClinicalRecord; permissions: string[]; onConfirmed: () => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmation = record.confirmation;
  async function confirm() {
    if (!checked || busy) return;
    setBusy(true); setError('');
    try {
      await apiPost(`/patients/${record.patientId}/records/${record.id}/confirm`, { expectedVersion: record.version, attested: true, note: note.trim() || undefined });
      await onConfirmed();
    } catch (cause) {
      setChecked(false);
      setError(cause instanceof Error ? cause.message : 'No se pudo confirmar. Recarga la atención antes de reintentar.');
    } finally { setBusy(false); }
  }
  return <section className={styles.panel} aria-label="Confirmación clínica">
    <header><h2>Revisión y cierre de esta versión</h2><ContextHelp title="Autoría y confirmación" compact>
      <p>El profesional original es quien figura como responsable de la atención. El ingresante transcribe o registra datos. El confirmante coteja y acepta el contenido de esta versión con su cuenta autorizada.</p>
      <p>Este cierre interno deja nombre, usuario, fecha y huella del contenido. No verifica una colegiatura ni constituye una firma digital certificada. No modifica quién atendió al paciente.</p>
      <p>Una corrección conserva esta confirmación en la versión anterior; la nueva versión queda pendiente de revisión.</p>
    </ContextHelp></header>
    {confirmation ? <div role="status">
      <p><strong>{record.status === 'ACTIVE' ? 'Versión confirmada' : 'Confirmación histórica; esta versión ya no está vigente'}</strong></p>
      <p>{confirmation.actorName} · @{confirmation.actorUsername} · {confirmation.capacity === 'ORIGINAL_PROFESSIONAL' ? 'Cuenta vinculada al profesional original' : 'Revisor autorizado'}</p>
      <p>{formatInstant(confirmation.confirmedAt, { dateStyle: 'medium', timeStyle: 'short' })} · Versión revisada {confirmation.recordVersion}</p>
      {confirmation.note && <p>{confirmation.note}</p>}
      <details><summary>Huella de contenido (SHA-256)</summary><p>{confirmation.contentHash}</p></details>
    </div> : record.status !== 'ACTIVE' ? <p>Versión no vigente, sin confirmación registrada.</p> : <>
      <p>Esta atención está registrada y aún no tiene confirmación clínica explícita.</p>
      {can(permissions, 'records.confirm') && can(permissions, 'patients.read') ? <>
        <label>Observación de revisión (opcional)<textarea maxLength={2000} value={note} disabled={busy} onChange={(event) => { setNote(event.target.value); setChecked(false); }} /></label>
        <label className={styles.check}><input type="checkbox" checked={checked} disabled={busy} onChange={(event) => setChecked(event.target.checked)} />He revisado el profesional original, la fecha, el contenido y los adjuntos de esta versión. Confirmo su cierre interno con mi cuenta.</label>
        <div className={styles.actions}><button type="button" disabled={busy || !checked} onClick={() => void confirm()}>{busy ? 'Confirmando…' : 'Confirmar versión revisada'}</button><button type="button" disabled={busy} onClick={() => void onConfirmed()}>Recargar atención</button></div>
      </> : <p>La confirmación requiere el permiso «Confirmar registros clínicos».</p>}
    </>}
    {error && <Alert variant="error">{error}</Alert>}
    <p>No es una firma digital certificada.</p>
  </section>;
}

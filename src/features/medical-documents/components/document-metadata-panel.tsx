'use client';

import { useEffect, useRef, useState } from 'react';
import { formatInstant } from '@/shared/lib/date-time';
import type { MedicalDocument } from '../types/document';
import {
  documentMetadataError,
  documentMetadataSections,
  type DocumentClinicalMetadata,
  type DocumentMetadataRevision,
} from '../lib/document-metadata';
import {
  getDocumentMetadataHistory,
  updateDocumentMetadata,
} from '../services/documents.service';
import { DocumentMetadataFields } from './document-metadata-fields';
import styles from './document-metadata.module.css';

export function DocumentMetadataPanel({
  document,
  canEdit,
  blocked,
  onSaved,
}: {
  document: MedicalDocument;
  canEdit: boolean;
  blocked: boolean;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<DocumentClinicalMetadata | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DocumentMetadataRevision[] | null>(
    null,
  );
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const expectedVersionRef = useRef(document.version);
  function cancelEdit() {
    if (
      busy ||
      !window.confirm('¿Descartar los cambios de procedencia sin guardar?')
    )
      return;
    dialogRef.current?.close();
    setForm(null);
    setError(null);
    setReason('');
  }
  useEffect(() => {
    if (!form) return;
    const protect = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [form]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    const issue = documentMetadataError(form);
    if (issue) {
      setError(issue);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateDocumentMetadata(
        document.patientId,
        document.id,
        form,
        expectedVersionRef.current,
        reason.trim(),
      );
      dialogRef.current?.close();
      setForm(null);
      setHistory(null);
      setReason('');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }
  async function showHistory(beforeVersion?: number) {
    setBusy(true);
    setError(null);
    try {
      const result = await getDocumentMetadataHistory(
        document.patientId,
        document.id,
        beforeVersion,
      );
      setHistory((previous) =>
        beforeVersion !== undefined
          ? [...(previous ?? []), ...result.data]
          : result.data,
      );
      setHistoryCursor(result.nextBeforeVersion);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo consultar el historial.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.panel} aria-labelledby="document-metadata-title">
      <header className={styles.heading}>
        <div>
          <h2 id="document-metadata-title">Datos del documento original</h2>
          <p>La fecha de carga no sustituye a la fecha clínica.</p>
        </div>
        {canEdit && !form && (
          <button
            type="button"
            className={styles.button}
            disabled={blocked || busy}
            onClick={() => {
              expectedVersionRef.current = document.version;
              setForm({ ...document.clinicalMetadata });
              setError(null);
              requestAnimationFrame(() => dialogRef.current?.showModal());
            }}
          >
            Completar / corregir datos
          </button>
        )}
      </header>
      {blocked && canEdit && (
        <p className={styles.hint}>
          Guarda las correcciones de texto pendientes y espera a que termine la
          operación para editar estos datos.
        </p>
      )}
      {error && !form && (
        <div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
          {error}
        </div>
      )}
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="metadata-edit-title"
        onCancel={(e) => {
          e.preventDefault();
          cancelEdit();
        }}
      >
        <h2 id="metadata-edit-title">Corregir datos del documento original</h2>
        {form && (
          <form onSubmit={(e) => void submit(e)}>
            <fieldset disabled={busy || blocked} className={styles.fields}>
              <DocumentMetadataFields value={form} onChange={setForm} />
              {error && (
                <div
                  ref={errorRef}
                  tabIndex={-1}
                  role="alert"
                  className={styles.error}
                >
                  {error}
                </div>
              )}
              <label className={styles.reason}>
                Motivo de la actualización *
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={cancelEdit}
                >
                  Cancelar
                </button>
                <button className={styles.primary} type="submit">
                  {busy ? 'Guardando…' : 'Guardar datos del original'}
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </dialog>
      {!form && (
        <>
          <p className={styles.summary}>
            {documentMetadataSections(document.clinicalMetadata)[0].content}
          </p>
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={() => void showHistory()}
          >
            Ver cambios de estos datos
          </button>
        </>
      )}
      {history && (
        <div className={styles.history}>
          {history.length === 0 ? (
            <p>Sin modificaciones posteriores a la carga.</p>
          ) : (
            history.map((revision) => (
              <details key={revision.version}>
                <summary>
                  Versión {revision.version} ·{' '}
                  {revision.recordedByName ||
                    'Identidad histórica no registrada'}{' '}
                  · {formatInstant(revision.createdAt)}
                </summary>
                <p>Motivo: {revision.reason}</p>
                <p className={styles.summary}>
                  {documentMetadataSections(revision.metadata)[0].content}
                </p>
              </details>
            ))
          )}
        </div>
      )}
      {history && historyCursor !== null && (
        <button
          className={styles.button}
          type="button"
          disabled={busy}
          onClick={() => void showHistory(historyCursor)}
        >
          Cargar cambios anteriores
        </button>
      )}
    </section>
  );
}

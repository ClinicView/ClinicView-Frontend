'use client';

import { useEffect, useRef, useState } from 'react';
import { usePatient } from '@/features/patients';
import {
  documentMetadataError,
  type DocumentClinicalMetadata,
} from '../lib/document-metadata';
import { DocumentMetadataFields } from './document-metadata-fields';
import styles from './document-metadata.module.css';

export function DocumentUploadDialog({
  patientId,
  file,
  busy,
  uploadError,
  onUpload,
  onCancel,
}: {
  patientId: string;
  file: File | null;
  busy: boolean;
  uploadError: string | null;
  onUpload: (
    file: File,
    metadata: DocumentClinicalMetadata,
  ) => Promise<boolean>;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { patient, error: patientError } = usePatient(patientId, {
    enabled: Boolean(file),
  });
  const errorRef = useRef<HTMLDivElement>(null);
  const [metadata, setMetadata] = useState<DocumentClinicalMetadata>({});
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      ref.current?.close();
      return;
    }
    setMetadata({});
    setError(null);
    ref.current?.showModal();
    const url = ['application/pdf', 'image/jpeg', 'image/png'].includes(
      file.type,
    )
      ? URL.createObjectURL(file)
      : null;
    setPreview(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    const issue = documentMetadataError(metadata);
    if (issue) {
      setError(issue);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setError(null);
    if (await onUpload(file, metadata)) onCancel();
    else requestAnimationFrame(() => errorRef.current?.focus());
  }
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirm-document-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id="confirm-document-title">Confirmar documento del paciente</h2>
      <p className={styles.summary}>
        <strong>{file?.name}</strong> ·{' '}
        {file ? (file.size / 1024 / 1024).toFixed(2) : '0'} MB
      </p>
      <p>
        <strong>Paciente: </strong>
        {patient
          ? `${patient.lastName}, ${patient.firstName} · ${patient.documentType} ${patient.documentNumber}`
          : 'Verificando identidad…'}
      </p>
      {patientError && <p role="alert">{patientError}</p>}
      {patient && !patient.isActive && (
        <p role="alert">
          El paciente está inactivo. No se puede subir el archivo.
        </p>
      )}
      <p>
        Comprueba el paciente antes de confirmar. El archivo todavía no se ha
        enviado.
      </p>
      {preview && (
        <details>
          <summary>Revisar archivo antes de subir</summary>
          <a href={preview} target="_blank" rel="noreferrer">
            Abrir vista previa del archivo seleccionado
          </a>
        </details>
      )}
      <form onSubmit={(e) => void submit(e)}>
        <fieldset className={styles.fields} disabled={busy}>
          <DocumentMetadataFields value={metadata} onChange={setMetadata} />
          {(error || uploadError) && (
            <div
              className={styles.error}
              ref={errorRef}
              role="alert"
              tabIndex={-1}
            >
              {error || uploadError}
            </div>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={onCancel}>
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.primary}
              disabled={!patient || !patient.isActive}
            >
              {busy ? 'Subiendo archivo…' : 'Confirmar y subir documento'}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}

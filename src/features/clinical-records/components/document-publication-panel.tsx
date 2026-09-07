'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDocument } from '@/features/medical-documents/services/documents.service';
import type { MedicalDocument } from '@/features/medical-documents';
import type { PublicationSource } from '../types/record';
import { Alert, Spinner } from '@/shared/ui';
import { ContextHelp } from '@/shared/ui/context-help';
import styles from './clinical-workflow.module.css';

export type { PublicationSource } from '../types/record';

export function DocumentPublicationPanel({ patientId, documentId, fingerprint, onChange, disabled }: {
  patientId: string; documentId: string; fingerprint: string; disabled: boolean;
  onChange: (source: PublicationSource | null) => void;
}) {
  const [document, setDocument] = useState<MedicalDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [pageFrom, setPageFrom] = useState('1');
  const [pageTo, setPageTo] = useState('1');
  const [note, setNote] = useState('');
  const [ack, setAck] = useState('');
  const [publicationKey] = useState(() => crypto.randomUUID());
  const reviewFingerprint = JSON.stringify([fingerprint, document?.version, documentId, pageFrom, pageTo, note]);
  const valid = document?.status === 'VALIDATED' && Number.isInteger(Number(pageFrom)) && Number(pageFrom) >= 1 && Number.isInteger(Number(pageTo)) && Number(pageTo) >= Number(pageFrom) && Number(pageTo) <= (document.clinicalMetadata?.pageCount ?? 5000) && note.trim().length >= 5;

  useEffect(() => {
    let current = true;
    setDocument(null); setError(null); setAck(''); onChange(null);
    getDocument(patientId, documentId).then((value) => { if (current) setDocument(value); })
      .catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el original.'); });
    return () => { current = false; };
  }, [patientId, documentId, reload, onChange]);
  useEffect(() => {
    onChange(valid && ack === reviewFingerprint && document ? { sourceDocumentId: document.id, expectedDocumentVersion: document.version, pageFrom: Number(pageFrom), pageTo: Number(pageTo), sourceNote: note.trim(), sourceVerified: true, publicationKey } : null);
  }, [valid, ack, reviewFingerprint, document, pageFrom, pageTo, note, publicationKey, onChange]);

  return <section className={styles.panel} aria-label="Procedencia de la atención">
    <header><h2>Atención transcrita desde un original</h2><ContextHelp title="Transcripción y procedencia" compact>
      <p>Completa una atención por vez con su propia fecha, profesional original y contenido. Puedes registrar varias desde el mismo documento y citar sus páginas.</p>
      <p>La cita conserva la versión del original revisado. Confirmar la transcripción no equivale al cierre profesional ni a una firma digital certificada.</p>
      <p>La fecha de carga no es la de atención. Si el original no consigna hora, utiliza la opción «Solo fecha».</p>
    </ContextHelp></header>
    {error ? <Alert variant="error">{error}<button type="button" disabled={disabled} onClick={() => setReload((value) => value + 1)}>Reintentar original</button></Alert> : !document ? <Spinner label="Consultando el original…" /> : <>
      <p><strong>{document.originalName}</strong> · Versión {document.version} · <Link href={`/patients/${patientId}/documents/${documentId}`} target="_blank" rel="noopener noreferrer">Abrir original en otra pestaña</Link></p>
      {document.status !== 'VALIDATED' && <Alert variant="error">El documento debe estar validado antes de publicar atenciones.</Alert>}
      <div className={styles.fields}>
        <label>Página inicial<input type="number" min={1} max={5000} step={1} value={pageFrom} disabled={disabled} onChange={(event) => setPageFrom(event.target.value)} /></label>
        <label>Página final<input type="number" min={pageFrom || 1} max={document.clinicalMetadata?.pageCount ?? 5000} step={1} value={pageTo} disabled={disabled} onChange={(event) => setPageTo(event.target.value)} /></label>
      </div>
      <label>Referencia dentro del original<textarea maxLength={1000} value={note} disabled={disabled} onChange={(event) => setNote(event.target.value)} placeholder="Por ejemplo: consulta del 27/09/2023, sección de evolución." /></label>
      <p>El contenido puede guardarse como borrador; la referencia y esta comprobación deben revisarse antes de publicar.</p>
      <label className={styles.check}><input type="checkbox" checked={ack === reviewFingerprint} disabled={disabled || !valid} onChange={(event) => setAck(event.target.checked ? reviewFingerprint : '')} />He cotejado esta atención y sus páginas con el original. No es una atención nueva realizada hoy.</label>
      <p role="status">{valid && ack === reviewFingerprint ? 'Transcripción lista para publicar.' : 'Completa el contenido, indica páginas y referencia, y confirma el cotejo. Cualquier edición requiere confirmar de nuevo.'}</p>
    </>}
  </section>;
}

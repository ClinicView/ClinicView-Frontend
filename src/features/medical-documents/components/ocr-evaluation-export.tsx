'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/shared/ui';
import { evaluationExportBlock, evaluationSnapshotMatches } from '../lib/ocr-evaluation';
import { getOcrEvaluationSnapshot } from '../services/ocr-layout.service';
import type { OcrLayout } from '../types/ocr-layout';
import styles from './ocr-spatial-review.module.css';

export function OcrEvaluationExport({ patientId, docId, layout, dirty, busy }: {
  patientId: string; docId: string; layout: OcrLayout; dirty: boolean; busy: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const blocked = evaluationExportBlock(layout, dirty, busy);

  async function download() {
    if (blocked || downloading || !layout.runId || !layout.review) return;
    const { runId } = layout;
    const { revision } = layout.review;
    setDownloading(true); setError(null); setNotice('');
    try {
      const blob = await getOcrEvaluationSnapshot(patientId, docId, runId, revision);
      let snapshot: unknown;
      try { snapshot = blob.type.includes('application/json') ? JSON.parse(await blob.text()) : null; } catch { snapshot = null; }
      if (!evaluationSnapshotMatches(snapshot, docId, runId, revision)) {
        throw new Error('El archivo recibido no corresponde a esta ejecución y revisión. Recarga el documento e inténtalo de nuevo.');
      }
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ocr-evaluation-${runId.replace(/[^a-zA-Z0-9_-]/g, '_')}-r${revision}.json`;
      document.body.appendChild(anchor);
      try { anchor.click(); } finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setNotice(`Descarga preparada: revisión ${revision}. Conserva este archivo privado; aún requiere revisar la cobertura de cada página.`);
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error ? caught.message : 'No se pudo descargar la revisión. Inténtalo de nuevo.');
    } finally { if (mounted.current) setDownloading(false); }
  }

  return <div className={styles.evaluationExport}>
    <button className={styles.button} type="button" disabled={Boolean(blocked) || downloading}
      aria-busy={downloading} aria-describedby="ocr-evaluation-export-help ocr-evaluation-export-state" onClick={() => void download()}>
      <Icon name="download" size={17} />{downloading ? 'Preparando evaluación…' : 'Exportar para evaluación'}
    </button>
    <p id="ocr-evaluation-export-help" className={styles.caption}>Descarga un borrador JSON privado del OCR original y la revisión {layout.review?.revision ?? 'guardada'}, con su ejecución y coordenadas. Puede contener datos clínicos: no lo publiques. Revisa las páginas completas para detectar omisiones; marcar todos los fragmentos no garantiza cobertura. No calcula CER/WER, no entrena el modelo ni cambia el estado clínico.</p>
    {layout.review?.stale && <p className={styles.caption}>Esta revisión guardada no coincide con la corrección clínica actual; el archivo conserva esa diferencia en su procedencia.</p>}
    <p id="ocr-evaluation-export-state" className={styles.caption} role="status">{blocked ?? notice}</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}

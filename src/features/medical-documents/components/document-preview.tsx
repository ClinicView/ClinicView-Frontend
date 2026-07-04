'use client';

import { useState } from 'react';
import { Icon, Spinner } from '@/shared/ui';
import { useDocumentFile } from '../hooks/use-document-file';
import styles from './correction-view.module.css';

interface DocumentPreviewProps {
  patientId: string;
  docId: string;
  mimeType: string;
  originalName: string;
}

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.15;

export function DocumentPreview({ patientId, docId, mimeType, originalName }: DocumentPreviewProps) {
  const { objectUrl, isLoading, error, openInNewTab, reload } = useDocumentFile(patientId, docId);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const isImage = IMAGE_MIME_TYPES.has(mimeType);
  const isPdf = mimeType === 'application/pdf';

  function handleDownload() {
    if (!objectUrl) return;
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = originalName;
    anchor.click();
  }

  return (
    <section className={styles.viewerPanel} aria-labelledby="document-preview-title">
      <div className={styles.viewerHeader}>
        <p id="document-preview-title" className={styles.viewerTitle}>Documento original</p>
        <button
          className={styles.btn}
          type="button"
          onClick={openInNewTab}
          disabled={!objectUrl}
        >
          <Icon name="external" size={15} />
          Abrir en nueva pestaña
        </button>
      </div>

      <div className={styles.viewerToolbar} aria-label="Controles del visor">
        {isImage && (
          <>
            <button
              className={styles.toolBtn}
              type="button"
              onClick={() => setZoom((value) => Math.max(ZOOM_MIN, value - ZOOM_STEP))}
              disabled={!objectUrl || zoom <= ZOOM_MIN}
              aria-label="Alejar"
              title="Alejar"
            >
              <Icon name="zoom-out" size={16} />
            </button>
            <span className={styles.toolValue} aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button
              className={styles.toolBtn}
              type="button"
              onClick={() => setZoom((value) => Math.min(ZOOM_MAX, value + ZOOM_STEP))}
              disabled={!objectUrl || zoom >= ZOOM_MAX}
              aria-label="Acercar"
              title="Acercar"
            >
              <Icon name="zoom-in" size={16} />
            </button>
            <button
              className={styles.toolBtn}
              type="button"
              onClick={() => setRotation((value) => (value + 90) % 360)}
              disabled={!objectUrl}
              aria-label="Rotar 90 grados"
              title="Rotar"
            >
              <Icon name="rotate" size={16} />
            </button>
          </>
        )}
        {isPdf && (
          <span className={styles.toolValue} title={originalName}>PDF</span>
        )}
        <span className={styles.toolSpacer} />
        <button
          className={styles.toolBtn}
          type="button"
          onClick={handleDownload}
          disabled={!objectUrl}
          aria-label="Descargar documento original"
          title="Descargar"
        >
          <Icon name="download" size={16} />
        </button>
      </div>

      <div className={styles.viewerFrame}>
        {isLoading && <Spinner label="Cargando documento original…" />}

        {!isLoading && error && (
          <div className={styles.viewerState}>
            <Icon name="warning" size={22} />
            <p>No se pudo cargar la vista previa del documento.</p>
            <button className={styles.btn} type="button" onClick={() => void reload()}>
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !error && objectUrl && isImage && (
          <div className={styles.viewerImageWrap}>
            {/* Blob local de un endpoint protegido; next/image no aporta optimización aquí. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.viewerImage}
              src={objectUrl}
              alt={`Documento original ${originalName}`}
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          </div>
        )}

        {!isLoading && !error && objectUrl && isPdf && (
          <iframe
            className={styles.viewerPdf}
            src={objectUrl}
            title={`Documento original PDF ${originalName}`}
          />
        )}

        {!isLoading && !error && objectUrl && !isImage && !isPdf && (
          <div className={styles.viewerState}>
            <Icon name="document" size={22} />
            <p>Este tipo de archivo no tiene previsualización embebida.</p>
          </div>
        )}
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { Icon, Spinner } from '@/shared/ui';
import { useDocumentFile } from '../hooks/use-document-file';
import styles from './document-detail.module.css';
import { ZoomControls } from './zoom-controls';

interface DocumentPreviewProps {
  patientId: string;
  docId: string;
  mimeType: string;
  originalName: string;
}

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const ZOOM_LEVELS = [
  { value: 0.5, className: 'zoom50' },
  { value: 0.65, className: 'zoom65' },
  { value: 0.8, className: 'zoom80' },
  { value: 1, className: 'zoom100' },
  { value: 1.15, className: 'zoom115' },
  { value: 1.3, className: 'zoom130' },
  { value: 1.5, className: 'zoom150' },
  { value: 1.75, className: 'zoom175' },
  { value: 2, className: 'zoom200' },
  { value: 2.25, className: 'zoom225' },
  { value: 2.5, className: 'zoom250' },
] as const;
const DEFAULT_ZOOM_INDEX = 3;

export function DocumentPreview({ patientId, docId, mimeType, originalName }: DocumentPreviewProps) {
  const { objectUrl, isLoading, error, openInNewTab, reload } = useDocumentFile(patientId, docId);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const isImage = IMAGE_MIME_TYPES.has(mimeType);
  const isPdf = mimeType === 'application/pdf';
  const zoom = ZOOM_LEVELS[zoomIndex];

  function zoomIn() {
    setZoomIndex((current) => Math.min(current + 1, ZOOM_LEVELS.length - 1));
  }

  function zoomOut() {
    setZoomIndex((current) => Math.max(current - 1, 0));
  }

  return (
    <section className={styles.previewPanel} aria-labelledby="document-preview-title">
      <div className={styles.panelHeader}>
        <div>
          <p id="document-preview-title" className={styles.sectionTitle}>Documento original</p>
          <p className={styles.panelHint}>Referencia visual para corregir la transcripcion.</p>
        </div>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={openInNewTab}
          disabled={!objectUrl}
        >
          Abrir en nueva pestana
        </button>
      </div>

      {isImage && objectUrl && (
        <ZoomControls
          zoom={zoom.value}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={() => setZoomIndex(DEFAULT_ZOOM_INDEX)}
        />
      )}

      <div className={styles.previewFrame}>
        {isLoading && <Spinner label="Cargando documento original..." />}

        {!isLoading && error && (
          <div className={styles.previewState}>
            <Icon name="warning" size={22} />
            <p>No se pudo cargar la vista previa del documento.</p>
            <button className={styles.secondaryButton} type="button" onClick={() => void reload()}>
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !error && objectUrl && isImage && (
          <div className={styles.imageViewport}>
            {/* Blob local de un endpoint protegido; next/image no aporta optimizacion aqui. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={`${styles.previewImage} ${styles[zoom.className]}`}
              src={objectUrl}
              alt={`Documento original ${originalName}`}
            />
          </div>
        )}

        {!isLoading && !error && objectUrl && isPdf && (
          <iframe
            className={styles.previewPdf}
            src={objectUrl}
            title={`Documento original PDF ${originalName}`}
          />
        )}

        {!isLoading && !error && objectUrl && !isImage && !isPdf && (
          <div className={styles.previewState}>
            <Icon name="document" size={22} />
            <p>Este tipo de archivo no tiene previsualizacion embebida.</p>
          </div>
        )}
      </div>
    </section>
  );
}

'use client';

import Image from 'next/image';
import { useRef } from 'react';
import type { RecordAttachmentFormReference } from '@/app/(private)/patients/[id]/records/new/record-form-model';
import { Icon } from '@/shared/ui';
import type { RecordMediaController } from '../hooks/use-record-media';
import styles from '@/app/(private)/patients/[id]/records/new/manual-record.module.css';

interface RecordMediaSectionOption {
  id: string;
  title: string;
}

interface RecordMediaUploaderProps {
  attachments: RecordAttachmentFormReference[];
  sections: readonly RecordMediaSectionOption[];
  controller: RecordMediaController;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unitIndex);
  return `${new Intl.NumberFormat('es-PE', { maximumFractionDigits: unitIndex === 0 ? 0 : 1 }).format(value)} ${units[unitIndex]}`;
}

function statusLabel(status: 'TEMPORARY' | 'ATTACHED'): string {
  return status === 'TEMPORARY' ? 'Temporal' : 'En historia';
}

export function RecordMediaUploader({
  attachments,
  sections,
  controller,
  disabled = false,
}: RecordMediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerDisabled = disabled || !controller.canAdd;

  return (
    <div id="record-attachments" className={styles.mediaUploader}>
      <div className={styles.mediaToolbar}>
        <div>
          <strong>Imágenes clínicas</strong>
          <p id="record-media-requirements">JPEG o PNG · 10 MiB por imagen · 10 imágenes y 30 MiB por registro.</p>
        </div>
        <label
          className={`${styles.mediaPicker} ${pickerDisabled ? styles.mediaPickerDisabled : ''}`}
          aria-disabled={pickerDisabled}
        >
          <Icon name="upload" size={18} />
          <span>{controller.totalCount > 0 ? 'Agregar imágenes' : 'Seleccionar imágenes'}</span>
          <input
            ref={inputRef}
            className={styles.mediaFileInput}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            disabled={pickerDisabled}
            aria-describedby="record-media-requirements record-media-capacity"
            onChange={(event) => {
              controller.addFiles(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
        </label>
      </div>

      <div id="record-media-capacity" className={styles.mediaCapacity} aria-label="Capacidad de adjuntos utilizada">
        <span>{controller.totalCount} de 10 imágenes</span>
        <span>{formatBytes(controller.totalBytes)} de 30 MiB</span>
      </div>

      {controller.hasMetadataErrors && (
        <div className={styles.mediaNotice} role="alert">
          <Icon name="warning" size={18} />
          <p>Alguna referencia guardada no pudo recuperarse. Reinténtalo antes de registrar.</p>
        </div>
      )}

      {controller.uploads.length > 0 && (
        <ul className={styles.mediaUploadQueue} aria-label="Archivos pendientes de carga">
          {controller.uploads.map((upload) => (
            <li key={upload.id} className={styles.mediaQueueItem}>
              <span className={styles.mediaQueueIcon} aria-hidden="true"><Icon name="upload" size={18} /></span>
              <div className={styles.mediaQueueBody}>
                <strong>{upload.file.name}</strong>
                <span>{formatBytes(upload.file.size)}</span>
                <p className={upload.error ? styles.mediaItemError : styles.mediaItemStatus}>
                  {upload.status === 'queued' && 'En cola. Las imágenes se cargan una por una.'}
                  {upload.status === 'uploading' && 'Subiendo de forma segura…'}
                  {(upload.status === 'error' || upload.status === 'rejected') && upload.error}
                </p>
              </div>
              <div className={styles.mediaQueueActions}>
                {upload.status === 'error' && (
                  <button type="button" onClick={() => controller.retryUpload(upload.id)} disabled={disabled}>
                    Reintentar
                  </button>
                )}
                {(upload.status === 'error' || upload.status === 'rejected' || upload.status === 'queued') && (
                  <button type="button" onClick={() => controller.dismissUpload(upload.id)} disabled={disabled}>
                    Quitar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {attachments.length === 0 && controller.uploads.length === 0 ? (
        <div className={styles.mediaEmpty}>
          <span aria-hidden="true"><Icon name="folder" size={24} /></span>
          <div>
            <strong>No hay imágenes adjuntas</strong>
            <p>La historia puede registrarse sin imágenes. Adjunta solo archivos clínicamente necesarios.</p>
          </div>
        </div>
      ) : (
        <ol className={styles.mediaList} aria-label="Imágenes adjuntas en orden de presentación">
          {attachments.map((attachment, index) => {
            const state = controller.assetStates[attachment.assetId];
            const asset = state?.asset;
            const unknownSection = attachment.sectionKey
              && !sections.some((section) => section.id === attachment.sectionKey);
            return (
              <li
                key={attachment.assetId}
                className={styles.mediaCard}
                aria-busy={state?.metadataStatus === 'loading' || state?.previewStatus === 'loading'}
              >
                <div className={styles.mediaPreview}>
                  {state?.previewStatus === 'ready' && state.previewUrl && asset ? (
                    <Image
                      src={state.previewUrl}
                      alt={attachment.altText.trim() || `Imagen clínica adjunta: ${asset.originalName}`}
                      width={asset.width}
                      height={asset.height}
                      sizes="(max-width: 700px) 100vw, 220px"
                      unoptimized
                    />
                  ) : state?.previewStatus === 'error' ? (
                    <div className={styles.mediaPreviewState}>
                      <Icon name="warning" size={20} />
                      <span>Vista previa no disponible</span>
                      <button
                        type="button"
                        onClick={() => void controller.retryPreview(attachment.assetId)}
                        disabled={disabled || state?.isRemoving}
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : (
                    <div className={styles.mediaPreviewState}>
                      <span className={styles.mediaSpinner} aria-hidden="true" />
                      <span>Cargando vista previa…</span>
                    </div>
                  )}
                </div>

                <div className={styles.mediaCardBody}>
                  <div className={styles.mediaCardHeader}>
                    <div>
                      <strong>{asset?.originalName ?? `Imagen guardada · ${attachment.assetId.slice(0, 8)}`}</strong>
                      {asset ? (
                        <p>{formatBytes(asset.sizeBytes)} · {asset.width} × {asset.height} px</p>
                      ) : (
                        <p>Información del archivo pendiente.</p>
                      )}
                    </div>
                    {asset && (
                      <span className={`${styles.mediaStatus} ${styles[`mediaStatus_${asset.status}`]}`}>
                        {statusLabel(asset.status)}
                      </span>
                    )}
                  </div>

                  {state?.metadataStatus === 'error' && (
                    <div className={styles.mediaInlineError} role="alert">
                      <p>{state.metadataError}</p>
                      <button
                        type="button"
                        onClick={() => void controller.retryMetadata(attachment.assetId)}
                        disabled={disabled || state?.isRemoving}
                      >
                        Recuperar información
                      </button>
                    </div>
                  )}
                  {state?.removeError && (
                    <div className={styles.mediaInlineError} role="alert">
                      <p>{state.removeError}</p>
                      <button
                        type="button"
                        onClick={() => void controller.removeAttachment(attachment.assetId)}
                        disabled={disabled || state?.isRemoving}
                      >
                        Reintentar quitar
                      </button>
                    </div>
                  )}

                  <div className={styles.mediaFields}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor={`record-media-section-${attachment.assetId}`}>
                        Sección clínica
                      </label>
                      <select
                        id={`record-media-section-${attachment.assetId}`}
                        className={styles.select}
                        value={attachment.sectionKey}
                        disabled={disabled || state?.isRemoving}
                        onChange={(event) => controller.updateAttachment(attachment.assetId, {
                          sectionKey: event.target.value,
                        })}
                      >
                        <option value="">Adjunto general</option>
                        {unknownSection && (
                          <option value={attachment.sectionKey}>Sección anterior: {attachment.sectionKey}</option>
                        )}
                        {sections.map((section) => (
                          <option key={section.id} value={section.id}>{section.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label} htmlFor={`record-media-caption-${attachment.assetId}`}>
                        Título o contexto breve
                      </label>
                      <input
                        id={`record-media-caption-${attachment.assetId}`}
                        className={styles.input}
                        value={attachment.caption}
                        maxLength={500}
                        disabled={disabled || state?.isRemoving}
                        onChange={(event) => controller.updateAttachment(attachment.assetId, {
                          caption: event.target.value,
                        })}
                        aria-describedby={`record-media-caption-count-${attachment.assetId}`}
                      />
                      <span id={`record-media-caption-count-${attachment.assetId}`} className={styles.counter}>
                        {attachment.caption.length} / 500
                      </span>
                    </div>

                    <div className={`${styles.field} ${styles.mediaAltField}`}>
                      <label className={styles.label} htmlFor={`record-media-alt-${attachment.assetId}`}>
                        Descripción accesible
                      </label>
                      <textarea
                        id={`record-media-alt-${attachment.assetId}`}
                        className={styles.textarea}
                        value={attachment.altText}
                        rows={2}
                        maxLength={500}
                        disabled={disabled || state?.isRemoving}
                        onChange={(event) => controller.updateAttachment(attachment.assetId, {
                          altText: event.target.value,
                        })}
                        aria-describedby={`record-media-alt-hint-${attachment.assetId} record-media-alt-count-${attachment.assetId}`}
                      />
                      <p id={`record-media-alt-hint-${attachment.assetId}`} className={styles.fieldHint}>
                        Describe solo lo que puedes identificar con certeza; no infieras hallazgos clínicos.
                      </p>
                      <span id={`record-media-alt-count-${attachment.assetId}`} className={styles.counter}>
                        {attachment.altText.length} / 500
                      </span>
                    </div>
                  </div>

                  <div className={styles.mediaActions}>
                    <div className={styles.mediaOrderActions} aria-label={`Orden de ${asset?.originalName ?? 'la imagen'}`}>
                      <button
                        type="button"
                        onClick={() => controller.moveAttachment(index, index - 1)}
                        disabled={disabled || index === 0 || state?.isRemoving}
                        aria-label={`Subir ${asset?.originalName ?? 'imagen'} una posición`}
                      >
                        <Icon name="chevron-right" size={16} className={styles.chevronUp} /> Subir
                      </button>
                      <button
                        type="button"
                        onClick={() => controller.moveAttachment(index, index + 1)}
                        disabled={disabled || index === attachments.length - 1 || state?.isRemoving}
                        aria-label={`Bajar ${asset?.originalName ?? 'imagen'} una posición`}
                      >
                        <Icon name="chevron-right" size={16} className={styles.chevronDown} /> Bajar
                      </button>
                    </div>
                    <button
                      className={styles.mediaRemoveButton}
                      type="button"
                      onClick={() => void controller.removeAttachment(attachment.assetId)}
                      disabled={disabled || state?.isRemoving || state?.metadataStatus === 'loading'}
                    >
                      <Icon name="close" size={16} /> {state?.isRemoving ? 'Quitando…' : 'Quitar imagen'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {controller.liveMessage}
      </p>
    </div>
  );
}

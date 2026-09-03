'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiBlob } from '@/shared/services/api-client';
import { Icon } from '@/shared/ui';
import type {
  ClinicalRecordAttachment,
  RecordType,
} from '../types/record';
import {
  formatRecordAttachmentSize,
  getRecordAttachmentAltText,
  getRecordAttachmentGroups,
} from '../lib/record-attachments-presentation';
import styles from './record-attachments-gallery.module.css';

interface RecordAttachmentsGalleryProps {
  recordType: RecordType;
  attachments: readonly ClinicalRecordAttachment[];
  headingLevel?: 2 | 3;
  variant?: 'default' | 'compact';
}

type AttachmentLoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; objectUrl: string }
  | { status: 'error' };

interface ActivePreview {
  attachment: ClinicalRecordAttachment;
  objectUrl: string;
}

function useAttachmentObjectUrl(
  contentUrl: string,
  enabled: boolean,
): [AttachmentLoadState, () => void] {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AttachmentLoadState>({ status: 'idle' });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: 'loading' });

    void apiBlob(contentUrl)
      .then((blob) => {
        if (!['image/jpeg', 'image/png'].includes(blob.type)) {
          throw new Error('El servidor no devolvió una imagen clínica compatible.');
        }
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setState({ status: 'ready', objectUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, contentUrl, enabled]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  return [state, retry];
}

interface AttachmentCardProps {
  attachment: ClinicalRecordAttachment;
  enabled: boolean;
  compact: boolean;
  onOpen: (
    attachment: ClinicalRecordAttachment,
    objectUrl: string,
    trigger: HTMLButtonElement,
  ) => void;
}

function AttachmentCard({ attachment, enabled, compact, onOpen }: AttachmentCardProps) {
  const [loadState, retry] = useAttachmentObjectUrl(
    attachment.asset.contentUrl,
    enabled,
  );
  const alt = getRecordAttachmentAltText(attachment);
  const dimensions = `${attachment.asset.width} × ${attachment.asset.height} px`;
  const size = formatRecordAttachmentSize(attachment.asset.sizeBytes);
  const aspectRatio = `${Math.max(attachment.asset.width, 1)} / ${Math.max(attachment.asset.height, 1)}`;

  return (
    <article className={styles.card}>
      <div className={styles.mediaFrame} style={{ aspectRatio }}>
        {loadState.status === 'ready' ? (
          <button
            type="button"
            className={styles.previewButton}
            onClick={(event) =>
              onOpen(attachment, loadState.objectUrl, event.currentTarget)
            }
            aria-label={`Ampliar imagen clínica: ${alt}`}
          >
            <Image
              unoptimized
              fill
              sizes={compact ? '(max-width: 700px) 100vw, 220px' : '(max-width: 700px) 100vw, 320px'}
              src={loadState.objectUrl}
              alt=""
              className={styles.thumbnail}
            />
            <span className={styles.openHint} aria-hidden="true">
              <Icon name="eye" size={17} />
              Ampliar
            </span>
          </button>
        ) : loadState.status === 'error' ? (
          <div className={styles.errorState} role="alert">
            <Icon name="warning" size={20} />
            <span>No se pudo cargar esta imagen.</span>
            <button type="button" className={styles.retryButton} onClick={retry}>
              Reintentar
            </button>
          </div>
        ) : (
          <div className={styles.skeleton} role="status" aria-live="polite">
            <span className={styles.visuallyHidden}>
              {enabled ? 'Cargando imagen clínica…' : 'Imagen pendiente de carga…'}
            </span>
          </div>
        )}
      </div>

      <div className={styles.cardBody}>
        {attachment.caption?.trim() && (
          <p className={styles.caption}>{attachment.caption.trim()}</p>
        )}
        <p className={styles.filename}>{attachment.asset.originalName}</p>
        <p className={styles.meta}>
          {dimensions} <span aria-hidden="true">·</span> {size}
        </p>
      </div>
    </article>
  );
}

export function RecordAttachmentsGallery({
  recordType,
  attachments,
  headingLevel = 2,
  variant = 'default',
}: RecordAttachmentsGalleryProps) {
  const groups = useMemo(
    () => getRecordAttachmentGroups(recordType, attachments),
    [attachments, recordType],
  );
  const [isVisible, setIsVisible] = useState(false);
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const reactId = useId().replace(/:/g, '');
  const titleId = `record-attachments-${reactId}`;
  const dialogTitleId = `record-attachment-preview-${reactId}`;
  const dialogDescriptionId = `${dialogTitleId}-description`;
  const compact = variant === 'compact';
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const GroupHeading = headingLevel === 2 ? 'h3' : 'h4';

  useEffect(() => {
    const root = rootRef.current;
    if (!root || isVisible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [isVisible]);

  const closePreview = useCallback(() => {
    if (dialogRef.current?.open) dialogRef.current.close();
    setActivePreview(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!activePreview) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [activePreview]);

  const openPreview = useCallback(
    (
      attachment: ClinicalRecordAttachment,
      objectUrl: string,
      trigger: HTMLButtonElement,
    ) => {
      returnFocusRef.current = trigger;
      setActivePreview({ attachment, objectUrl });
    },
    [],
  );

  if (groups.length === 0) return null;

  return (
    <section
      ref={rootRef}
      className={`${styles.root} ${compact ? styles.compact : ''}`}
      aria-labelledby={titleId}
    >
      <div className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Icon name="eye" size={18} />
        </span>
        <div>
          <Heading id={titleId} className={styles.title}>Imágenes clínicas</Heading>
          <p className={styles.lead}>
            {attachments.length} {attachments.length === 1 ? 'imagen adjunta' : 'imágenes adjuntas'}
          </p>
        </div>
      </div>

      <div className={styles.groups}>
        {groups.map((group) => (
          <section key={group.id} className={styles.group}>
            {(group.sectionId || groups.length > 1) && (
              <GroupHeading className={styles.groupTitle}>{group.title}</GroupHeading>
            )}
            <div className={styles.grid}>
              {group.attachments.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  enabled={isVisible}
                  compact={compact}
                  onOpen={openPreview}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {activePreview && (
        <dialog
          ref={dialogRef}
          className={styles.dialog}
          aria-labelledby={dialogTitleId}
          aria-describedby={dialogDescriptionId}
          onCancel={(event) => {
            event.preventDefault();
            closePreview();
          }}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            ) {
              closePreview();
            }
          }}
        >
          <div className={styles.dialogHeader}>
            <div className={styles.dialogHeading}>
              <span className={styles.dialogEyebrow}>Imagen clínica privada</span>
              <h2 id={dialogTitleId} className={styles.dialogTitle}>
                {activePreview.attachment.caption?.trim() || activePreview.attachment.asset.originalName}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className={styles.closeButton}
              onClick={closePreview}
              aria-label="Cerrar vista ampliada"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <div className={styles.dialogImageFrame}>
            <Image
              unoptimized
              src={activePreview.objectUrl}
              width={Math.max(activePreview.attachment.asset.width, 1)}
              height={Math.max(activePreview.attachment.asset.height, 1)}
              alt={getRecordAttachmentAltText(activePreview.attachment)}
              className={styles.dialogImage}
            />
          </div>

          <div id={dialogDescriptionId} className={styles.dialogMeta}>
            {activePreview.attachment.caption?.trim() && (
              <p>{activePreview.attachment.caption.trim()}</p>
            )}
            <p className={styles.dialogFile}>
              {activePreview.attachment.asset.originalName} <span aria-hidden="true">·</span>{' '}
              {activePreview.attachment.asset.width} × {activePreview.attachment.asset.height} px{' '}
              <span aria-hidden="true">·</span>{' '}
              {formatRecordAttachmentSize(activePreview.attachment.asset.sizeBytes)}
            </p>
          </div>
        </dialog>
      )}
    </section>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/shared/services/api-client';
import {
  MAX_RECORD_ATTACHMENTS,
  MAX_RECORD_MEDIA_TOTAL_BYTES,
  normalizeAttachmentReferences,
  sumRecordMediaBytes,
  validateRecordMediaCandidate,
  type RecordAttachmentFormReference,
} from '@/app/(private)/patients/[id]/records/new/record-form-model';
import {
  deleteTemporaryRecordMedia,
  getRecordMediaContent,
  getRecordMediaMetadata,
  uploadRecordMedia,
} from '../services/record-media.service';
import {
  clearRecordMediaObjectUrls,
  getRecordMediaBlockingMessage,
  isRecordMediaSubmissionBlocked,
  removeRecordMediaObjectUrl,
  replaceRecordMediaObjectUrl,
  retryRecordMediaQueueItem,
} from '../lib/record-media-state';
import type { ClinicalMediaAsset } from '../types/record';

export type RecordMediaUploadStatus = 'queued' | 'uploading' | 'error' | 'rejected';
export type RecordMediaLoadStatus = 'loading' | 'ready' | 'error';

export interface RecordMediaUploadItem {
  id: string;
  file: File;
  status: RecordMediaUploadStatus;
  error?: string;
}

export interface RecordMediaAssetState {
  asset?: ClinicalMediaAsset;
  metadataStatus: RecordMediaLoadStatus;
  metadataError?: string;
  previewUrl?: string;
  previewStatus: 'idle' | RecordMediaLoadStatus;
  previewError?: string;
  isRemoving?: boolean;
  removeError?: string;
}

export interface RecordMediaCleanupResult {
  deletedIds: string[];
  skippedAttachedIds: string[];
  failures: Array<{ assetId: string; message: string }>;
}

interface UseRecordMediaOptions {
  patientId: string;
  attachments: RecordAttachmentFormReference[];
  onAttachmentsChange: (attachments: RecordAttachmentFormReference[]) => void;
  initialAssets?: readonly ClinicalMediaAsset[];
}

function readableError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

function uploadId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function initialAssetStates(assets: readonly ClinicalMediaAsset[]): Record<string, RecordMediaAssetState> {
  return Object.fromEntries(assets.map((asset) => [asset.id, {
    asset,
    metadataStatus: 'ready' as const,
    previewStatus: 'idle' as const,
  }]));
}

export function useRecordMedia({
  patientId,
  attachments,
  onAttachmentsChange,
  initialAssets = [],
}: UseRecordMediaOptions) {
  const [uploads, setUploads] = useState<RecordMediaUploadItem[]>([]);
  const [assetStates, setAssetStates] = useState<Record<string, RecordMediaAssetState>>(
    () => initialAssetStates(initialAssets),
  );
  const [liveMessage, setLiveMessage] = useState('');
  const attachmentsRef = useRef(attachments);
  const onAttachmentsChangeRef = useRef(onAttachmentsChange);
  const assetStatesRef = useRef(assetStates);
  const uploadsRef = useRef(uploads);
  const processingUploadRef = useRef(false);
  const metadataRequestsRef = useRef(new Set<string>());
  const previewRequestsRef = useRef(new Set<string>());
  const objectUrlsRef = useRef(new Map<string, string>());
  const mountedRef = useRef(true);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    onAttachmentsChangeRef.current = onAttachmentsChange;
  }, [onAttachmentsChange]);

  useEffect(() => {
    assetStatesRef.current = assetStates;
  }, [assetStates]);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  const rememberAsset = useCallback((asset: ClinicalMediaAsset) => {
    setAssetStates((current) => ({
      ...current,
      [asset.id]: {
        ...current[asset.id],
        asset,
        metadataStatus: 'ready',
        metadataError: undefined,
        previewStatus: current[asset.id]?.previewStatus ?? 'idle',
      },
    }));
  }, []);

  const loadMetadata = useCallback(async (assetId: string) => {
    if (metadataRequestsRef.current.has(assetId)) return;
    metadataRequestsRef.current.add(assetId);
    setAssetStates((current) => ({
      ...current,
      [assetId]: {
        ...current[assetId],
        metadataStatus: 'loading',
        metadataError: undefined,
        previewStatus: current[assetId]?.previewStatus ?? 'idle',
      },
    }));
    try {
      const asset = await getRecordMediaMetadata(patientId, assetId);
      if (!mountedRef.current
        || !attachmentsRef.current.some((attachment) => attachment.assetId === assetId)) return;
      rememberAsset(asset);
    } catch (error) {
      if (!mountedRef.current
        || !attachmentsRef.current.some((attachment) => attachment.assetId === assetId)) return;
      setAssetStates((current) => ({
        ...current,
        [assetId]: {
          ...current[assetId],
          metadataStatus: 'error',
          metadataError: readableError(error, 'No se pudo recuperar la información de la imagen.'),
          previewStatus: current[assetId]?.previewStatus ?? 'idle',
        },
      }));
    } finally {
      metadataRequestsRef.current.delete(assetId);
    }
  }, [patientId, rememberAsset]);

  const loadPreview = useCallback(async (assetId: string) => {
    if (previewRequestsRef.current.has(assetId)) return;
    previewRequestsRef.current.add(assetId);
    setAssetStates((current) => ({
      ...current,
      [assetId]: {
        ...current[assetId],
        metadataStatus: current[assetId]?.metadataStatus ?? 'loading',
        previewStatus: 'loading',
        previewError: undefined,
      },
    }));
    try {
      const blob = await getRecordMediaContent(patientId, assetId);
      const nextUrl = URL.createObjectURL(blob);
      if (!mountedRef.current
        || !attachmentsRef.current.some((attachment) => attachment.assetId === assetId)) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      replaceRecordMediaObjectUrl(objectUrlsRef.current, assetId, nextUrl, URL.revokeObjectURL);
      setAssetStates((current) => ({
        ...current,
        [assetId]: {
          ...current[assetId],
          metadataStatus: current[assetId]?.metadataStatus ?? 'ready',
          previewUrl: nextUrl,
          previewStatus: 'ready',
          previewError: undefined,
        },
      }));
    } catch (error) {
      if (!mountedRef.current
        || !attachmentsRef.current.some((attachment) => attachment.assetId === assetId)) return;
      setAssetStates((current) => ({
        ...current,
        [assetId]: {
          ...current[assetId],
          metadataStatus: current[assetId]?.metadataStatus ?? 'ready',
          previewStatus: 'error',
          previewError: readableError(error, 'No se pudo cargar la vista previa.'),
        },
      }));
    } finally {
      previewRequestsRef.current.delete(assetId);
    }
  }, [patientId]);

  useEffect(() => {
    for (const attachment of attachments) {
      const state = assetStates[attachment.assetId];
      if (!state) void loadMetadata(attachment.assetId);
      else if (state.metadataStatus === 'ready' && state.asset && state.previewStatus === 'idle') {
        void loadPreview(attachment.assetId);
      }
    }
  }, [assetStates, attachments, loadMetadata, loadPreview]);

  useEffect(() => {
    const retainedIds = new Set(attachments.map(({ assetId }) => assetId));
    for (const assetId of objectUrlsRef.current.keys()) {
      if (retainedIds.has(assetId)) continue;
      removeRecordMediaObjectUrl(objectUrlsRef.current, assetId, URL.revokeObjectURL);
      setAssetStates((current) => {
        if (!(assetId in current)) return current;
        const next = { ...current };
        delete next[assetId];
        return next;
      });
    }
  }, [attachments]);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRecordMediaObjectUrls(objectUrls, URL.revokeObjectURL);
    };
  }, []);

  useEffect(() => {
    if (processingUploadRef.current) return;
    const nextUpload = uploads.find((upload) => upload.status === 'queued');
    if (!nextUpload) return;
    processingUploadRef.current = true;
    setUploads((current) => current.map((upload) => upload.id === nextUpload.id
      ? { ...upload, status: 'uploading', error: undefined }
      : upload));
    setLiveMessage(`Subiendo ${nextUpload.file.name}.`);

    void uploadRecordMedia(patientId, nextUpload.file)
      .then((asset) => {
        if (!mountedRef.current) {
          if (asset.status === 'TEMPORARY') {
            void deleteTemporaryRecordMedia(patientId, asset.id, asset.version).catch(() => undefined);
          }
          return;
        }
        rememberAsset(asset);
        const currentAttachments = attachmentsRef.current;
        if (!currentAttachments.some((attachment) => attachment.assetId === asset.id)) {
          onAttachmentsChangeRef.current(normalizeAttachmentReferences([
            ...currentAttachments,
            { assetId: asset.id, sortOrder: currentAttachments.length },
          ]));
        }
        setUploads((current) => current.filter((upload) => upload.id !== nextUpload.id));
        setLiveMessage(`${nextUpload.file.name} se cargó correctamente.`);
      })
      .catch((error) => {
        if (!mountedRef.current) return;
        setUploads((current) => current.map((upload) => upload.id === nextUpload.id
          ? {
            ...upload,
            status: 'error',
            error: readableError(error, 'No se pudo subir la imagen. Inténtalo nuevamente.'),
          }
          : upload));
        setLiveMessage(`No se pudo subir ${nextUpload.file.name}.`);
      })
      .finally(() => {
        processingUploadRef.current = false;
        if (mountedRef.current) setUploads((current) => [...current]);
      });
  }, [patientId, rememberAsset, uploads]);

  const attachedAssets = useMemo(() => attachments
    .map(({ assetId }) => assetStates[assetId]?.asset)
    .filter((asset): asset is ClinicalMediaAsset => Boolean(asset)), [assetStates, attachments]);

  const retryableUploads = uploads.filter(({ status }) => status !== 'rejected');
  const totalBytes = sumRecordMediaBytes(attachedAssets)
    + retryableUploads.reduce((total, upload) => total + upload.file.size, 0);
  const hasPendingUploads = uploads.some(({ status }) => status === 'queued' || status === 'uploading');
  const hasUploadErrors = uploads.some(({ status }) => status === 'error' || status === 'rejected');
  const hasMetadataPending = attachments.some(({ assetId }) => (
    !assetStates[assetId] || assetStates[assetId]?.metadataStatus === 'loading'
  ));
  const hasMetadataErrors = attachments.some(({ assetId }) => (
    assetStates[assetId]?.metadataStatus === 'error'
  ));
  const isRemoving = Object.values(assetStates).some(({ isRemoving: removing }) => removing);
  const blockingState = {
    hasPendingUploads,
    hasUploadErrors,
    hasMetadataPending,
    hasMetadataErrors,
    isRemoving,
  };

  const addFiles = useCallback((files: readonly File[]) => {
    const currentUploads = uploadsRef.current;
    const currentAttachments = attachmentsRef.current;
    const currentAssets = currentAttachments
      .map(({ assetId }) => assetStatesRef.current[assetId]?.asset)
      .filter((asset): asset is ClinicalMediaAsset => Boolean(asset));
    let count = currentAttachments.length
      + currentUploads.filter(({ status }) => status !== 'rejected').length;
    let bytes = sumRecordMediaBytes(currentAssets)
      + currentUploads
        .filter(({ status }) => status !== 'rejected')
        .reduce((total, upload) => total + upload.file.size, 0);
    const nextUploads: RecordMediaUploadItem[] = [];

    for (const file of files) {
      const error = validateRecordMediaCandidate(file, { count, totalBytes: bytes });
      nextUploads.push({
        id: uploadId(),
        file,
        status: error ? 'rejected' : 'queued',
        ...(error ? { error } : {}),
      });
      if (!error) {
        count += 1;
        bytes += file.size;
      }
    }
    if (nextUploads.length === 0) return;
    setUploads((current) => [...current, ...nextUploads]);
    const accepted = nextUploads.filter(({ status }) => status === 'queued').length;
    const rejected = nextUploads.length - accepted;
    setLiveMessage(
      rejected > 0
        ? `${accepted} ${accepted === 1 ? 'imagen preparada' : 'imágenes preparadas'}; ${rejected} rechazadas.`
        : `${accepted} ${accepted === 1 ? 'imagen preparada para subir' : 'imágenes preparadas para subir'}.`,
    );
  }, []);

  const retryUpload = useCallback((uploadIdValue: string) => {
    setUploads((current) => retryRecordMediaQueueItem(current, uploadIdValue));
  }, []);

  const dismissUpload = useCallback((uploadIdValue: string) => {
    const removed = uploadsRef.current.find((upload) => upload.id === uploadIdValue);
    setUploads((current) => current.filter((upload) => upload.id !== uploadIdValue));
    if (removed) setLiveMessage(`${removed.file.name} se quitó de la cola.`);
  }, []);

  const clearUploadErrors = useCallback(() => {
    setUploads((current) => current.filter(
      ({ status }) => status === 'queued' || status === 'uploading',
    ));
  }, []);

  const updateAttachment = useCallback((
    assetId: string,
    patch: Partial<Pick<RecordAttachmentFormReference, 'sectionKey' | 'caption' | 'altText'>>,
  ) => {
    onAttachmentsChangeRef.current(normalizeAttachmentReferences(
      attachmentsRef.current.map((attachment) => attachment.assetId === assetId
        ? { ...attachment, ...patch }
        : attachment),
    ));
  }, []);

  const moveAttachment = useCallback((fromIndex: number, toIndex: number) => {
    const current = normalizeAttachmentReferences(attachmentsRef.current);
    if (fromIndex < 0 || fromIndex >= current.length || toIndex < 0 || toIndex >= current.length) return;
    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    onAttachmentsChangeRef.current(next.map((attachment, sortOrder) => ({ ...attachment, sortOrder })));
    setLiveMessage(`${moved.caption || assetStatesRef.current[moved.assetId]?.asset?.originalName || 'Imagen'} cambió a la posición ${toIndex + 1}.`);
  }, []);

  const forgetAsset = useCallback((assetId: string) => {
    removeRecordMediaObjectUrl(objectUrlsRef.current, assetId, URL.revokeObjectURL);
    setAssetStates((current) => {
      const next = { ...current };
      delete next[assetId];
      return next;
    });
  }, []);

  const removeAttachment = useCallback(async (assetId: string) => {
    const detachReference = () => {
      onAttachmentsChangeRef.current(normalizeAttachmentReferences(
        attachmentsRef.current.filter((attachment) => attachment.assetId !== assetId),
      ));
      forgetAsset(assetId);
    };
    setAssetStates((current) => ({
      ...current,
      [assetId]: {
        ...current[assetId],
        metadataStatus: current[assetId]?.metadataStatus ?? 'loading',
        previewStatus: current[assetId]?.previewStatus ?? 'idle',
        isRemoving: true,
        removeError: undefined,
      },
    }));
    try {
      let asset = assetStatesRef.current[assetId]?.asset;
      if (!asset) asset = await getRecordMediaMetadata(patientId, assetId);
      if (asset.status === 'TEMPORARY') {
        await deleteTemporaryRecordMedia(patientId, asset.id, asset.version);
      }
      detachReference();
      setLiveMessage(`${asset.originalName} se quitó de los adjuntos.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        detachReference();
        setLiveMessage('La imagen ya no estaba disponible; se quitó su referencia.');
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        try {
          const refreshed = await getRecordMediaMetadata(patientId, assetId);
          if (refreshed.status === 'ATTACHED') {
            detachReference();
            setLiveMessage(`${refreshed.originalName} se quitó de los adjuntos.`);
            return;
          }
          setAssetStates((current) => ({
            ...current,
            [assetId]: {
              ...current[assetId],
              asset: refreshed,
              metadataStatus: 'ready',
              previewStatus: current[assetId]?.previewStatus ?? 'idle',
              isRemoving: false,
              removeError: 'La imagen cambió en el servidor. Reintenta para quitar la versión actual.',
            },
          }));
          return;
        } catch (refreshError) {
          if (refreshError instanceof ApiError && refreshError.status === 404) {
            detachReference();
            setLiveMessage('La imagen ya no estaba disponible; se quitó su referencia.');
            return;
          }
        }
      }
      setAssetStates((current) => ({
        ...current,
        [assetId]: {
          ...current[assetId],
          metadataStatus: current[assetId]?.metadataStatus ?? 'error',
          previewStatus: current[assetId]?.previewStatus ?? 'idle',
          isRemoving: false,
          removeError: readableError(error, 'No se pudo quitar la imagen.'),
        },
      }));
    }
  }, [forgetAsset, patientId]);

  const cleanupTemporaryAssets = useCallback(async (
    references: readonly RecordAttachmentFormReference[],
  ): Promise<RecordMediaCleanupResult> => {
    const result: RecordMediaCleanupResult = {
      deletedIds: [],
      skippedAttachedIds: [],
      failures: [],
    };
    for (const reference of normalizeAttachmentReferences(references)) {
      try {
        const asset = assetStatesRef.current[reference.assetId]?.asset
          ?? await getRecordMediaMetadata(patientId, reference.assetId);
        if (asset.status === 'ATTACHED') {
          result.skippedAttachedIds.push(asset.id);
          continue;
        }
        await deleteTemporaryRecordMedia(patientId, asset.id, asset.version);
        result.deletedIds.push(asset.id);
        forgetAsset(asset.id);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          result.deletedIds.push(reference.assetId);
          forgetAsset(reference.assetId);
          continue;
        }
        result.failures.push({
          assetId: reference.assetId,
          message: readableError(error, 'No se pudo eliminar la imagen temporal.'),
        });
      }
    }
    return result;
  }, [forgetAsset, patientId]);

  return {
    uploads,
    assetStates,
    liveMessage,
    totalBytes,
    totalCount: attachments.length + retryableUploads.length,
    hasPendingUploads,
    hasUploadErrors,
    hasMetadataPending,
    hasMetadataErrors,
    isRemoving,
    isSubmissionBlocked: isRecordMediaSubmissionBlocked(blockingState),
    submissionBlockingMessage: getRecordMediaBlockingMessage(blockingState),
    canAdd: attachments.length + retryableUploads.length < MAX_RECORD_ATTACHMENTS
      && totalBytes < MAX_RECORD_MEDIA_TOTAL_BYTES
      && !hasMetadataPending && !hasMetadataErrors,
    addFiles,
    retryUpload,
    dismissUpload,
    clearUploadErrors,
    retryMetadata: loadMetadata,
    retryPreview: loadPreview,
    updateAttachment,
    moveAttachment,
    removeAttachment,
    cleanupTemporaryAssets,
  };
}

export type RecordMediaController = ReturnType<typeof useRecordMedia>;

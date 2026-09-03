export interface RecordMediaBlockingState {
  hasPendingUploads: boolean;
  hasUploadErrors: boolean;
  hasMetadataPending: boolean;
  hasMetadataErrors: boolean;
  isRemoving: boolean;
}

export function isRecordMediaSubmissionBlocked(state: RecordMediaBlockingState): boolean {
  return state.hasPendingUploads
    || state.hasUploadErrors
    || state.hasMetadataPending
    || state.hasMetadataErrors
    || state.isRemoving;
}

export function getRecordMediaBlockingMessage(state: RecordMediaBlockingState): string | null {
  if (state.hasPendingUploads) return 'Espera a que finalicen las cargas de imágenes.';
  if (state.isRemoving) return 'Espera a que termine la eliminación de la imagen.';
  if (state.hasMetadataPending) return 'Espera a que se recupere la información de las imágenes.';
  if (state.hasUploadErrors) return 'Reintenta o quita los archivos que no pudieron cargarse.';
  if (state.hasMetadataErrors) return 'Recupera la información pendiente o quita la referencia afectada.';
  return null;
}

export function retryRecordMediaQueueItem<
  Item extends { id: string; status: string; error?: string },
>(items: readonly Item[], id: string): Item[] {
  return items.map((item) => item.id === id && item.status === 'error'
    ? { ...item, status: 'queued', error: undefined }
    : item);
}

export function replaceRecordMediaObjectUrl(
  registry: Map<string, string>,
  assetId: string,
  nextUrl: string,
  revoke: (url: string) => void,
): void {
  const previousUrl = registry.get(assetId);
  if (previousUrl && previousUrl !== nextUrl) revoke(previousUrl);
  registry.set(assetId, nextUrl);
}

export function removeRecordMediaObjectUrl(
  registry: Map<string, string>,
  assetId: string,
  revoke: (url: string) => void,
): void {
  const url = registry.get(assetId);
  if (!url) return;
  revoke(url);
  registry.delete(assetId);
}

export function clearRecordMediaObjectUrls(
  registry: Map<string, string>,
  revoke: (url: string) => void,
): void {
  for (const url of registry.values()) revoke(url);
  registry.clear();
}

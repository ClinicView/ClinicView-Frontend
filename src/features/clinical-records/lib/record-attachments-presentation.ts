import type { ClinicalRecordAttachment, RecordType } from '../types/record';
import { getRecordTypeDefinition } from './record-type-definitions';

export interface RecordAttachmentGroup {
  id: string;
  sectionId: string | null;
  title: string;
  attachments: ClinicalRecordAttachment[];
}

export interface LoadableAttachment {
  id: string;
  originalName: string;
  contentUrl: string;
}

export interface RecordExportAttachment extends LoadableAttachment {
  sectionId: string | null;
  sectionTitle: string;
  caption: string | null;
  description: string;
  mimeType: 'image/jpeg' | 'image/png';
  sizeBytes: number;
  width: number;
  height: number;
}

export type ResolvedAttachment<T extends LoadableAttachment> = T & { dataUrl: string };

export type AttachmentBlobLoader = (contentUrl: string) => Promise<Blob>;
export type AttachmentDataUrlEncoder = (blob: Blob) => Promise<string>;

export class RequiredAttachmentResolutionError extends Error {
  readonly attachmentId: string;

  constructor(attachment: LoadableAttachment, cause: unknown) {
    super(
      `No se pudo incluir la imagen clínica “${attachment.originalName}”. La exportación se canceló para evitar un PDF incompleto. Inténtalo nuevamente.`,
      { cause },
    );
    this.name = 'RequiredAttachmentResolutionError';
    this.attachmentId = attachment.id;
  }
}

function compareAttachments(
  left: ClinicalRecordAttachment,
  right: ClinicalRecordAttachment,
): number {
  return (
    left.sortOrder - right.sortOrder ||
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() ||
    left.id.localeCompare(right.id)
  );
}

function resolveSectionId(
  recordType: RecordType,
  sectionKey: string | null,
): string | null {
  const normalized = sectionKey?.trim();
  if (!normalized) return null;

  const definition = getRecordTypeDefinition(recordType);
  const section = definition.sections.find(
    (candidate) =>
      normalized === candidate.id ||
      normalized.startsWith(`${candidate.id}.`) ||
      candidate.fields.some(
        (field) =>
          normalized === field.key || normalized.startsWith(`${field.key}.`),
      ),
  );
  return section?.id ?? null;
}

export function getRecordAttachmentGroups(
  recordType: RecordType,
  attachments: readonly ClinicalRecordAttachment[] | null | undefined,
): RecordAttachmentGroup[] {
  if (!attachments?.length) return [];

  const definition = getRecordTypeDefinition(recordType);
  const grouped = new Map<string, ClinicalRecordAttachment[]>();
  const general: ClinicalRecordAttachment[] = [];

  for (const attachment of [...attachments].sort(compareAttachments)) {
    const sectionId = resolveSectionId(recordType, attachment.sectionKey);
    if (!sectionId) {
      general.push(attachment);
      continue;
    }
    const current = grouped.get(sectionId) ?? [];
    current.push(attachment);
    grouped.set(sectionId, current);
  }

  const result = definition.sections.flatMap<RecordAttachmentGroup>((section) => {
    const sectionAttachments = grouped.get(section.id);
    return sectionAttachments?.length
      ? [
          {
            id: `section:${section.id}`,
            sectionId: section.id,
            title: section.title,
            attachments: sectionAttachments,
          },
        ]
      : [];
  });

  if (general.length > 0) {
    result.push({
      id: 'general',
      sectionId: null,
      title: 'Imágenes adjuntas',
      attachments: general,
    });
  }

  return result;
}

export function getRecordAttachmentAltText(
  attachment: ClinicalRecordAttachment,
): string {
  const authoredAlt = attachment.altText?.trim();
  if (authoredAlt) return authoredAlt;

  const filename = attachment.asset.originalName.trim() || 'archivo sin nombre';
  return `Imagen clínica adjunta: ${filename}`;
}

export function getRecordExportAttachments(
  recordType: RecordType,
  attachments: readonly ClinicalRecordAttachment[] | null | undefined,
): RecordExportAttachment[] {
  return getRecordAttachmentGroups(recordType, attachments).flatMap((group) =>
    group.attachments.map((attachment) => ({
      id: attachment.id,
      sectionId: group.sectionId,
      sectionTitle: group.title,
      caption: attachment.caption?.trim() || null,
      description: getRecordAttachmentAltText(attachment),
      originalName: attachment.asset.originalName,
      mimeType: attachment.asset.mimeType,
      sizeBytes: attachment.asset.sizeBytes,
      width: attachment.asset.width,
      height: attachment.asset.height,
      contentUrl: attachment.asset.contentUrl,
    })),
  );
}

export function fitRecordAttachmentDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  const scale = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight);
  return { width: safeWidth * scale, height: safeHeight * scale };
}

export function formatRecordAttachmentSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return 'Tamaño no disponible';
  if (sizeBytes < 1024) return `${Math.round(sizeBytes)} B`;

  const units = ['KB', 'MB', 'GB'] as const;
  let value = sizeBytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
}

export async function resolveRequiredAttachmentData<T extends LoadableAttachment>(
  attachments: readonly T[],
  loadBlob: AttachmentBlobLoader,
  encodeDataUrl: AttachmentDataUrlEncoder,
): Promise<Array<ResolvedAttachment<T>>> {
  return Promise.all(
    attachments.map(async (attachment) => {
      try {
        const blob = await loadBlob(attachment.contentUrl);
        const dataUrl = await encodeDataUrl(blob);
        if (!dataUrl.startsWith('data:')) throw new Error('Formato de imagen no válido.');
        return { ...attachment, dataUrl };
      } catch (cause) {
        throw new RequiredAttachmentResolutionError(attachment, cause);
      }
    }),
  );
}

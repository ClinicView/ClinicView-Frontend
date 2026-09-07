import type { ClinicalHistoryExport } from '../types/patient';
import { documentSortDate } from '../../medical-documents/lib/document-metadata';

export function historyExportOrder(history: ClinicalHistoryExport, grouping: 'DATE' | 'EPISODE') {
  const entries = [
    ...history.records.map((record) => ({
      kind: 'RECORD' as const,
      id: record.id,
      date: record.attendedAt,
      createdAt: record.createdAt,
      episodeId: record.episode?.id ?? '',
    })),
    // Originals are exported once, not copied into every episode that cites them.
    ...history.documents.map((document) => ({
      kind: 'DOCUMENT' as const,
      id: document.id,
      date: documentSortDate(document),
      createdAt: document.createdAt,
      episodeId: '',
    })),
  ];
  const episodes = new Map((history.episodes ?? []).map((episode, index) => [episode.id, index]));
  const groupIndex = (entry: (typeof entries)[number]) =>
    episodes.get(entry.episodeId) ??
    (entry.kind === 'DOCUMENT' ? episodes.size + 1 : episodes.size);
  return entries.sort((a, b) => {
    const group = grouping === 'EPISODE' ? groupIndex(a) - groupIndex(b) : 0;
    return (
      group ||
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
      a.kind.localeCompare(b.kind) ||
      a.id.localeCompare(b.id)
    );
  });
}

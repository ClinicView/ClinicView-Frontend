'use client';
import type { ClinicalHistoryExport } from '../types/patient';
import {
  clinicalHistoryDocumentToExportItem,
  clinicalSummaryToExportItem,
  exportPatientPdf,
  recordToExportItem,
  type ExportItem,
  type PatientPdfOptions,
} from '../../medical-documents/lib/pdf-export';
import { formatDateOnly, formatInstant } from '@/shared/lib/date-time';
import { historyExportOrder } from './history-export-order';
import {
  EPISODE_ACTION_LABELS,
  episodeChangeText,
} from '../../clinical-records/lib/episode-presentation';

export function clinicalHistoryPdfOptions(
  history: ClinicalHistoryExport,
  grouping: 'DATE' | 'EPISODE' = 'DATE',
): PatientPdfOptions {
  const records = new Map(history.records.map((record) => [record.id, record]));
  const documents = new Map(history.documents.map((document) => [document.id, document]));
  const items: ExportItem[] = (history.clinicalSummaryRevisions ?? []).map((revision, index) =>
    clinicalSummaryToExportItem(revision, index === 0),
  );
  for (const episode of history.episodes ?? [])
    items.push({
      title: `Episodio · ${episode.title}`,
      date: episode.startedOn,
      dateLabel: 'Inicio clínico',
      status: episode.status === 'CLOSED' ? 'Cerrado' : 'Abierto',
      origin: 'Agrupación asistencial',
      attachments: [],
      sections: [
        {
          title: 'Identificación del episodio',
          content: `Identificador: ${episode.id}\nVersión: ${episode.version}\nDescripción: ${episode.description || 'No registrada'}\nCierre clínico: ${episode.endedOn ? formatDateOnly(episode.endedOn) : 'No cerrado'}`,
        },
        ...episode.events.map((event) => ({
          title: `${EPISODE_ACTION_LABELS[event.action] ?? event.action} · ${formatInstant(event.createdAt)}`,
          content: `Responsable: ${event.actorName}\nMotivo: ${event.reason}${event.recordId ? `\nAtención: ${event.recordId}` : ''}\n${episodeChangeText(event.payload)}`,
        })),
      ],
    });
  for (const entry of historyExportOrder(history, grouping)) {
    const item =
      entry.kind === 'RECORD'
        ? recordToExportItem(records.get(entry.id)!)
        : clinicalHistoryDocumentToExportItem(documents.get(entry.id)!);
    if (grouping === 'EPISODE')
      item.title = `${entry.episodeId ? records.get(entry.id)?.episode?.title : entry.kind === 'DOCUMENT' ? 'Originales documentales' : 'Sin episodio'} · ${item.title}`;
    items.push(item);
  }
  if (!items.length)
    throw new Error('No hay contenido para el alcance elegido. Amplía los filtros.');
  const complete = history.scope?.kind !== 'FILTERED';
  return {
    patient: history.patient,
    items,
    subtitle: complete ? 'Historia clínica completa' : 'Historia clínica · selección',
    fileName: `clinicview_${history.patient.id.slice(0, 8)}_${complete ? 'historia_completa' : 'seleccion'}`,
    generatedAt: history.generatedAt,
    orderDescription: `${history.scope?.description ?? 'Historia completa.'} ${history.records.length} versiones de atenciones; ${history.documents.length} documentos. Contexto longitudinal y trazabilidad primero. ${grouping === 'EPISODE' ? 'Atenciones por episodio y fecha, luego atenciones sin episodio y originales documentales (cada original una sola vez).' : 'Entradas por fecha clínica; se identifica fecha de carga cuando no consta fecha clínica.'}`,
  };
}

export async function exportClinicalHistoryPdf(
  history: ClinicalHistoryExport,
  grouping: 'DATE' | 'EPISODE' = 'DATE',
) {
  await exportPatientPdf(clinicalHistoryPdfOptions(history, grouping));
}

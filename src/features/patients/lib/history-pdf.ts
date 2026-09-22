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

function historyScopePresentation(
  history: ClinicalHistoryExport,
): Pick<PatientPdfOptions, 'scopeSummary' | 'scopeDetails'> {
  const complete = history.scope?.kind !== 'FILTERED';
  const countSummary = [
    `${history.records.length} ${history.records.length === 1 ? 'atención' : 'atenciones'}`,
    `${history.documents.length} ${history.documents.length === 1 ? 'documento' : 'documentos'}`,
  ].join(' · ');
  if (complete)
    return {
      scopeSummary: `Expediente completo · ${countSummary}.\nIncluye todas las versiones, también las previas o no vigentes; cada versión se cuenta como una entrada.`,
    };

  // The API exposes dates, episode and version filters in this description,
  // not as separate fields. Keep it intact instead of inferring the selection
  // from its resulting records or silently truncating a filter or exception.
  const description = history.scope?.description.trim() ||
    'No se informó el detalle de los filtros. Esta selección no representa todo el expediente.';
  const outsidePeriodNotice =
    'Se incluyen originales citados fuera del período o sin fecha clínica para conservar la procedencia.';
  return {
    scopeSummary: `Selección filtrada · ${countSummary}.`,
    scopeDetails: [
      description,
      history.scope?.includesSourceDocumentsOutsidePeriod && !description.includes(outsidePeriodNotice)
        ? outsidePeriodNotice
        : null,
    ].filter(Boolean).join('\n'),
  };
}

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
          title: 'Contexto clínico del episodio',
          placement: 'body',
          content: `Descripción: ${episode.description || 'No registrada'}\nCierre clínico: ${episode.endedOn ? formatDateOnly(episode.endedOn) : 'No cerrado'}`,
        },
        {
          title: 'Identificación del episodio',
          placement: 'appendix',
          content: `Identificador: ${episode.id}\nVersión: ${episode.version}`,
        },
        ...episode.events.map((event) => ({
          title: `${EPISODE_ACTION_LABELS[event.action] ?? event.action} · ${formatInstant(event.createdAt)}`,
          placement: 'appendix' as const,
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
    ...historyScopePresentation(history),
    orderDescription: `${history.scope?.description ?? 'Historia completa.'} ${history.records.length} versiones de atenciones; ${history.documents.length} documentos. Contexto longitudinal y episodios primero; trazabilidad detallada en el anexo. ${grouping === 'EPISODE' ? 'Atenciones por episodio y fecha, luego atenciones sin episodio y originales documentales (cada original una sola vez).' : 'Entradas por fecha clínica; se identifica fecha de carga cuando no consta fecha clínica.'}`,
  };
}

export async function exportClinicalHistoryPdf(
  history: ClinicalHistoryExport,
  grouping: 'DATE' | 'EPISODE' = 'DATE',
) {
  await exportPatientPdf(clinicalHistoryPdfOptions(history, grouping));
}

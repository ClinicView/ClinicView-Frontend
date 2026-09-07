import type { ClinicalSummaryPayload } from '../types/clinical-summary';

const STATE = {
  UNKNOWN: 'Por verificar',
  NONE_KNOWN: 'Ninguno conocido (declarado)',
  RECORDED: 'Elementos registrados',
};
const SEVERITY = {
  UNKNOWN: 'No precisada',
  MILD: 'Leve',
  MODERATE: 'Moderada',
  SEVERE: 'Grave',
};

export function clinicalSummarySections(payload: ClinicalSummaryPayload) {
  return [
    {
      title: 'Alergias y reacciones',
      content: [
        STATE[payload.allergyStatus],
        ...payload.allergies.map(
          (a) =>
            `${a.name} · Reacción: ${a.reaction} · Gravedad: ${SEVERITY[a.severity]}${a.notes ? `\nObservaciones: ${a.notes}` : ''}`,
        ),
      ].join('\n\n'),
    },
    {
      title: 'Problemas de salud',
      content: [
        STATE[payload.problemStatus],
        ...payload.problems.map(
          (p) =>
            `${p.name}${p.code ? ` (${p.code})` : ''} · ${p.status === 'ACTIVE' ? 'Activo' : 'Resuelto'}${p.onsetDate ? ` · Inicio: ${p.onsetDate}` : ''}${p.notes ? `\nObservaciones: ${p.notes}` : ''}`,
        ),
      ].join('\n\n'),
    },
    {
      title: 'Medicación habitual (no constituye una prescripción)',
      content: [
        STATE[payload.medicationStatus],
        ...payload.medications.map(
          (m) =>
            `${m.name} · ${m.regimen} · ${m.status === 'ACTIVE' ? 'Activa' : 'Suspendida'}${m.indication ? `\nIndicación: ${m.indication}` : ''}${m.notes ? `\nObservaciones: ${m.notes}` : ''}`,
        ),
      ].join('\n\n'),
    },
  ];
}

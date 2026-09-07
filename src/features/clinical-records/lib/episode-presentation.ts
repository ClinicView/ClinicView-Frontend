import { formatDateOnly } from '../../../shared/lib/date-time';
export const EPISODE_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Apertura',
  UPDATE: 'Actualización',
  CLOSE: 'Cierre',
  REOPEN: 'Reapertura',
  ATTACH: 'Atención incorporada',
  DETACH: 'Atención retirada',
  CORRECT: 'Corrección de atención',
  VOID: 'Anulación de atención',
};
const LABELS: Record<string, string> = {
  before: 'Antes',
  after: 'Después',
  id: 'Identificador',
  patientId: 'Paciente',
  title: 'Título',
  description: 'Descripción',
  startedOn: 'Inicio clínico',
  endedOn: 'Fin clínico',
  status: 'Estado',
  version: 'Versión',
  recordVersion: 'Versión de atención',
  fromEpisodeId: 'Episodio anterior',
  toEpisodeId: 'Episodio nuevo',
};
export function episodeChangeText(payload: unknown, indent = ''): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return 'Sin datos adicionales.';
  const entries = Object.entries(payload);
  if (!entries.length) return 'Sin datos adicionales; consulta la versión relacionada y el motivo.';
  return entries
    .map(([key, value]) => {
      const label = `${indent}${LABELS[key] ?? key}`;
      if (value && typeof value === 'object')
        return `${label}:\n${episodeChangeText(value, `${indent}  `)}`;
      const displayed =
        value == null
          ? 'No registrado'
          : key === 'status' && value === 'OPEN'
            ? 'Abierto'
            : key === 'status' && value === 'CLOSED'
              ? 'Cerrado'
              : ['startedOn', 'endedOn'].includes(key) && typeof value === 'string'
                ? formatDateOnly(value)
                : String(value);
      return `${label}: ${displayed}`;
    })
    .join('\n');
}

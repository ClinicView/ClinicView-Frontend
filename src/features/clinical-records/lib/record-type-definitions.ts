import type {
  RecordDetailsByType,
  RecordType,
} from '../types/record';

export type RecordFieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime-local'
  | 'select'
  | 'repeatable';

export interface RecordFieldOption {
  value: string;
  label: string;
}

export interface RecordColumnDefinition {
  key: string;
  label: string;
  kind?: Exclude<RecordFieldKind, 'repeatable' | 'textarea'>;
  required?: boolean;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
  maxLength?: number;
  options?: readonly RecordFieldOption[];
}

export interface RecordFieldDefinition {
  key: string;
  label: string;
  kind: RecordFieldKind;
  required?: boolean;
  description?: string;
  placeholder?: string;
  maxLength?: number;
  maxItems?: number;
  pastOrPresent?: boolean;
  min?: number;
  max?: number;
  step?: number;
  inputMode?: 'decimal' | 'numeric' | 'text';
  options?: readonly RecordFieldOption[];
  addLabel?: string;
  itemLabel?: string;
  columns?: readonly RecordColumnDefinition[];
}

export interface RecordSectionDefinition {
  id: string;
  title: string;
  description?: string;
  fields: readonly RecordFieldDefinition[];
}

export interface RecordTypeDefinition {
  label: string;
  shortLabel: string;
  description: string;
  help: readonly string[];
  sections: readonly RecordSectionDefinition[];
}

const DIAGNOSIS_TYPES = [
  { value: 'PRELIMINARY', label: 'Preliminar' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'RULED_OUT', label: 'Descartado' },
] as const;

const RESULT_FLAGS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Bajo' },
  { value: 'HIGH', label: 'Alto' },
  { value: 'CRITICAL', label: 'Crítico' },
  { value: 'ABNORMAL', label: 'Anormal' },
] as const;

const LATERALITY_OPTIONS = [
  { value: 'LEFT', label: 'Izquierda' },
  { value: 'RIGHT', label: 'Derecha' },
  { value: 'BILATERAL', label: 'Bilateral' },
  { value: 'NOT_APPLICABLE', label: 'No aplica' },
] as const;

const CONSENT_OPTIONS = [
  { value: 'DOCUMENTED', label: 'Documentado' },
  { value: 'NOT_REQUIRED', label: 'No requerido' },
  { value: 'UNKNOWN', label: 'Sin confirmar' },
] as const;

/**
 * Registro central v1. Formulario, detalle, búsqueda y exportación deben usar
 * estas etiquetas para evitar interpretaciones distintas del mismo payload.
 */
export const RECORD_TYPE_DEFINITIONS: Readonly<Record<RecordType, RecordTypeDefinition>> = {
  CONSULTATION: {
    label: 'Consulta externa',
    shortLabel: 'Consulta',
    description: 'Motivo, evaluación clínica, signos vitales y diagnósticos de la consulta.',
    help: [
      'Registra el motivo principal con las palabras del paciente cuando sea relevante.',
      'Anota solo signos vitales realmente medidos; los campos vacíos no se interpretan como cero.',
      'Los diagnósticos pueden incluir un código y su sistema, pero la descripción clínica es obligatoria.',
    ],
    sections: [
      {
        id: 'consultation-clinical',
        title: 'Evaluación clínica',
        fields: [
          { key: 'chiefComplaint', label: 'Motivo de consulta', kind: 'textarea', required: true, maxLength: 1000, placeholder: 'Describe el motivo principal de la atención.' },
          { key: 'presentIllness', label: 'Enfermedad actual', kind: 'textarea', maxLength: 4000, placeholder: 'Inicio, evolución, síntomas y factores relevantes.' },
          { key: 'relevantHistory', label: 'Antecedentes relevantes', kind: 'textarea', maxLength: 4000 },
          { key: 'physicalExam', label: 'Examen físico', kind: 'textarea', maxLength: 4000 },
          { key: 'followUp', label: 'Seguimiento', kind: 'textarea', maxLength: 2000 },
        ],
      },
      {
        id: 'consultation-vitals',
        title: 'Signos vitales',
        description: 'Completa únicamente valores medidos durante esta atención.',
        fields: [
          { key: 'vitalSigns.systolicBloodPressure', label: 'Presión sistólica (mmHg)', kind: 'number', min: 0, max: 400, step: 0.1, inputMode: 'decimal' },
          { key: 'vitalSigns.diastolicBloodPressure', label: 'Presión diastólica (mmHg)', kind: 'number', min: 0, max: 300, step: 0.1, inputMode: 'decimal' },
          { key: 'vitalSigns.heartRate', label: 'Frecuencia cardiaca (lpm)', kind: 'number', min: 0, max: 400, step: 0.1, inputMode: 'decimal' },
          { key: 'vitalSigns.respiratoryRate', label: 'Frecuencia respiratoria (rpm)', kind: 'number', min: 0, max: 150, step: 0.1, inputMode: 'decimal' },
          { key: 'vitalSigns.temperatureCelsius', label: 'Temperatura (°C)', kind: 'number', min: 20, max: 50, step: 0.01, inputMode: 'decimal' },
          { key: 'vitalSigns.oxygenSaturation', label: 'Saturación de oxígeno (%)', kind: 'number', min: 0, max: 100, step: 0.1, inputMode: 'decimal' },
          { key: 'vitalSigns.weightKg', label: 'Peso (kg)', kind: 'number', min: 0, max: 700, step: 0.001, inputMode: 'decimal' },
          { key: 'vitalSigns.heightCm', label: 'Talla (cm)', kind: 'number', min: 0, max: 300, step: 0.01, inputMode: 'decimal' },
        ],
      },
      {
        id: 'consultation-diagnoses',
        title: 'Diagnósticos',
        fields: [
          {
            key: 'diagnoses', label: 'Diagnósticos de la consulta', kind: 'repeatable', maxItems: 20, addLabel: 'Agregar diagnóstico', itemLabel: 'Diagnóstico',
            columns: [
              { key: 'description', label: 'Descripción', required: true, maxLength: 300, placeholder: 'Diagnóstico clínico' },
              { key: 'code', label: 'Código', maxLength: 40, placeholder: 'Ej. J00' },
              { key: 'codeSystem', label: 'Sistema', maxLength: 80, placeholder: 'Ej. CIE-10' },
              { key: 'type', label: 'Tipo', kind: 'select', options: DIAGNOSIS_TYPES },
            ],
          },
        ],
      },
    ],
  },
  EVOLUTION: {
    label: 'Hoja de evolución',
    shortLabel: 'Evolución',
    description: 'Cambio clínico, valoración y respuesta al tratamiento desde la última atención.',
    help: [
      'Describe primero el cambio clínico relevante desde la última evaluación.',
      'Separa lo referido por el paciente de los hallazgos objetivos cuando dispongas de ambos.',
      'Incluye incidentes y seguimiento si modifican el plan de cuidado.',
    ],
    sections: [{
      id: 'evolution-note', title: 'Evolución clínica', fields: [
        { key: 'evolution', label: 'Evolución', kind: 'textarea', required: true, maxLength: 4000, placeholder: 'Describe el cambio clínico y el estado actual.' },
        { key: 'subjective', label: 'Subjetivo', kind: 'textarea', maxLength: 3000 },
        { key: 'objective', label: 'Objetivo', kind: 'textarea', maxLength: 3000 },
        { key: 'assessment', label: 'Valoración', kind: 'textarea', maxLength: 3000 },
        { key: 'treatmentResponse', label: 'Respuesta al tratamiento', kind: 'textarea', maxLength: 3000 },
        { key: 'incidents', label: 'Incidentes', kind: 'textarea', maxLength: 2000 },
        { key: 'followUp', label: 'Seguimiento', kind: 'textarea', maxLength: 2000 },
      ],
    }],
  },
  LAB_RESULT: {
    label: 'Resultado de laboratorio',
    shortLabel: 'Laboratorio',
    description: 'Estudio, muestra, fechas y resultados analíticos estructurados.',
    help: [
      'Transcribe cada analito, valor y unidad tal como aparecen en el informe de origen.',
      'No infieras banderas clínicas: selecciónalas solo cuando el informe las indique.',
      'La interpretación complementa los resultados y no reemplaza los valores originales.',
    ],
    sections: [
      { id: 'lab-study', title: 'Datos del estudio', fields: [
        { key: 'studyName', label: 'Nombre del estudio', kind: 'text', required: true, maxLength: 300, placeholder: 'Ej. Hemograma completo' },
        { key: 'laboratoryName', label: 'Laboratorio', kind: 'text', maxLength: 200 },
        { key: 'specimen', label: 'Muestra', kind: 'text', maxLength: 300, placeholder: 'Ej. Sangre venosa' },
        { key: 'collectedAt', label: 'Fecha y hora de toma', kind: 'datetime-local', pastOrPresent: true },
        { key: 'issuedAt', label: 'Fecha y hora de emisión', kind: 'datetime-local', pastOrPresent: true },
      ] },
      { id: 'lab-results', title: 'Resultados', fields: [{
        key: 'results', label: 'Resultados analíticos', kind: 'repeatable', required: true, maxItems: 100, addLabel: 'Agregar resultado', itemLabel: 'Resultado',
        columns: [
          { key: 'analyte', label: 'Analito', required: true, maxLength: 200, placeholder: 'Ej. Hemoglobina' },
          { key: 'value', label: 'Valor', required: true, maxLength: 200, placeholder: 'Ej. 13.5' },
          { key: 'unit', label: 'Unidad', maxLength: 60, placeholder: 'Ej. g/dL' },
          { key: 'referenceRange', label: 'Rango de referencia', maxLength: 160 },
          { key: 'flag', label: 'Bandera', kind: 'select', options: RESULT_FLAGS },
        ],
      }, { key: 'interpretation', label: 'Interpretación', kind: 'textarea', maxLength: 4000 } ] },
    ],
  },
  PRESCRIPTION: {
    label: 'Receta / prescripción',
    shortLabel: 'Prescripción',
    description: 'Medicamentos e indicaciones prescritas, sin valores sugeridos automáticamente.',
    help: [
      'Verifica medicamento, concentración, dosis, vía, frecuencia y duración antes de registrar.',
      'ClinicView nunca completa dosis: cada valor debe ser indicado explícitamente por el profesional.',
      'Usa instrucciones no farmacológicas para recomendaciones que no correspondan a un medicamento.',
    ],
    sections: [
      { id: 'prescription-context', title: 'Indicación y vigencia', fields: [
        { key: 'indication', label: 'Indicación clínica', kind: 'textarea', maxLength: 1000 },
        { key: 'validFrom', label: 'Válida desde', kind: 'date' },
        { key: 'validUntil', label: 'Válida hasta', kind: 'date' },
      ] },
      { id: 'prescription-medications', title: 'Medicamentos', description: 'No se autocompletan dosis ni pautas.', fields: [{
        key: 'medications', label: 'Medicamentos prescritos', kind: 'repeatable', required: true, maxItems: 30, addLabel: 'Agregar medicamento', itemLabel: 'Medicamento',
        columns: [
          { key: 'name', label: 'Medicamento', required: true, maxLength: 240 },
          { key: 'presentation', label: 'Presentación', maxLength: 160 },
          { key: 'concentration', label: 'Concentración', maxLength: 120 },
          { key: 'dose', label: 'Dosis', required: true, maxLength: 160 },
          { key: 'route', label: 'Vía', required: true, maxLength: 120 },
          { key: 'frequency', label: 'Frecuencia', required: true, maxLength: 160 },
          { key: 'duration', label: 'Duración', required: true, maxLength: 160 },
          { key: 'quantity', label: 'Cantidad', maxLength: 120 },
          { key: 'instructions', label: 'Instrucciones', maxLength: 1000 },
        ],
      }, { key: 'nonPharmacologicalInstructions', label: 'Indicaciones no farmacológicas', kind: 'textarea', maxLength: 3000 } ] },
    ],
  },
  PROCEDURE: {
    label: 'Procedimiento',
    shortLabel: 'Procedimiento',
    description: 'Técnica, sitio, consentimiento, hallazgos y resultado del procedimiento.',
    help: [
      'Registra la técnica realizada y no solo el nombre del procedimiento.',
      'Documenta explícitamente las complicaciones; si no hubo, indícalo sin dejar el campo vacío.',
      'Selecciona el estado del consentimiento según la evidencia disponible.',
    ],
    sections: [{ id: 'procedure-detail', title: 'Detalle del procedimiento', fields: [
      { key: 'procedureName', label: 'Nombre del procedimiento', kind: 'text', required: true, maxLength: 300 },
      { key: 'indication', label: 'Indicación', kind: 'textarea', maxLength: 2000 },
      { key: 'bodySite', label: 'Sitio anatómico', kind: 'text', maxLength: 240 },
      { key: 'laterality', label: 'Lateralidad', kind: 'select', options: LATERALITY_OPTIONS },
      { key: 'consentStatus', label: 'Consentimiento', kind: 'select', options: CONSENT_OPTIONS },
      { key: 'technique', label: 'Técnica', kind: 'textarea', required: true, maxLength: 5000 },
      { key: 'anesthesia', label: 'Anestesia', kind: 'text', maxLength: 1000 },
      { key: 'findings', label: 'Hallazgos', kind: 'textarea', maxLength: 4000 },
      { key: 'complications', label: 'Complicaciones', kind: 'textarea', required: true, maxLength: 2000, placeholder: 'Describe las complicaciones o indica explícitamente que no se presentaron.' },
      { key: 'outcome', label: 'Resultado', kind: 'textarea', maxLength: 2000 },
      { key: 'postProcedureCare', label: 'Cuidados posteriores', kind: 'textarea', maxLength: 3000 },
    ] }],
  },
  THERAPY_NOTE: {
    label: 'Nota de terapia',
    shortLabel: 'Terapia',
    description: 'Disciplina, intervención, respuesta y mediciones de una sesión terapéutica.',
    help: [
      'Relaciona las intervenciones con los objetivos de la sesión.',
      'Describe la respuesta observada sin sustituirla por una valoración genérica.',
      'Agrega mediciones solo cuando fueron obtenidas durante la sesión.',
    ],
    sections: [
      { id: 'therapy-session', title: 'Sesión terapéutica', fields: [
        { key: 'discipline', label: 'Disciplina', kind: 'text', required: true, maxLength: 200, placeholder: 'Ej. Terapia física' },
        { key: 'sessionNumber', label: 'Número de sesión', kind: 'number', min: 1, max: 10000, step: 1, inputMode: 'numeric' },
        { key: 'goals', label: 'Objetivos', kind: 'textarea', maxLength: 3000 },
        { key: 'baselineStatus', label: 'Estado basal', kind: 'textarea', maxLength: 3000 },
        { key: 'interventions', label: 'Intervenciones', kind: 'textarea', required: true, maxLength: 5000 },
        { key: 'response', label: 'Respuesta a la sesión', kind: 'textarea', required: true, maxLength: 4000 },
        { key: 'homeInstructions', label: 'Indicaciones para casa', kind: 'textarea', maxLength: 3000 },
        { key: 'nextSessionAt', label: 'Próxima sesión', kind: 'datetime-local' },
      ] },
      { id: 'therapy-measurements', title: 'Mediciones', fields: [{
        key: 'measurements', label: 'Mediciones de la sesión', kind: 'repeatable', maxItems: 30, addLabel: 'Agregar medición', itemLabel: 'Medición',
        columns: [
          { key: 'name', label: 'Medición', required: true, maxLength: 160 },
          { key: 'value', label: 'Valor', required: true, maxLength: 160 },
          { key: 'unit', label: 'Unidad', maxLength: 60 },
        ],
      }] },
    ],
  },
  OTHER: {
    label: 'Otro documento clínico',
    shortLabel: 'Otro',
    description: 'Nota clínica estructurada que no corresponde a las plantillas anteriores.',
    help: [
      'Usa una categoría concreta que facilite encontrar el registro más adelante.',
      'Explica el contexto cuando sea necesario para interpretar el contenido.',
      'Si el contenido corresponde a otra plantilla, cambia el tipo antes de registrar.',
    ],
    sections: [{ id: 'other-detail', title: 'Contenido clínico', fields: [
      { key: 'title', label: 'Título', kind: 'text', required: true, maxLength: 300 },
      { key: 'category', label: 'Categoría', kind: 'text', required: true, maxLength: 160 },
      { key: 'context', label: 'Contexto', kind: 'textarea', maxLength: 2000 },
      { key: 'content', label: 'Contenido', kind: 'textarea', required: true, maxLength: 8000 },
    ] }],
  },
};

export const RECORD_TYPE_OPTIONS = (Object.keys(RECORD_TYPE_DEFINITIONS) as RecordType[]).map(
  (value) => ({ value, label: RECORD_TYPE_DEFINITIONS[value].label }),
);

export function getRecordTypeDefinition(type: RecordType): RecordTypeDefinition {
  return RECORD_TYPE_DEFINITIONS[type];
}

export function createEmptyRecordDetails<Type extends RecordType>(
  type: Type,
): RecordDetailsByType[Type] {
  const details: RecordDetailsByType = {
    CONSULTATION: { chiefComplaint: '', vitalSigns: {}, diagnoses: [] },
    EVOLUTION: { evolution: '' },
    LAB_RESULT: { studyName: '', results: [{ analyte: '', value: '' }] },
    PRESCRIPTION: {
      medications: [{ name: '', dose: '', route: '', frequency: '', duration: '' }],
    },
    PROCEDURE: { procedureName: '', technique: '', complications: '' },
    THERAPY_NOTE: { discipline: '', interventions: '', response: '', measurements: [] },
    OTHER: { title: '', category: '', content: '' },
  };

  return details[type];
}

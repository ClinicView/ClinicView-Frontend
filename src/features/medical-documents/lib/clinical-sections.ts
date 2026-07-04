/**
 * Parser de secciones de la historia clínica (formato del médico — único
 * soportado por ahora). Divide el texto OCR/corregido en secciones canónicas
 * detectando encabezados, y lo reconstruye sin pérdidas al guardar.
 */

export interface ClinicalSection {
  key: string;
  title: string;
  /** Texto original del encabezado tal como aparece en el documento. */
  heading: string | null;
  content: string;
}

interface SectionDef {
  key: string;
  title: string;
  pattern: RegExp;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Orden canónico de las secciones (STYLEGUIDE.md §5). */
const SECTION_DEFS: SectionDef[] = [
  {
    key: 'identificacion',
    title: 'DATOS DE IDENTIFICACIÓN',
    pattern: /^(datos de identificacion|filiacion|identificacion del paciente|datos del paciente)\b/,
  },
  {
    key: 'antecedentes',
    title: 'ANTECEDENTES',
    pattern: /^antecedentes?\b/,
  },
  {
    key: 'anamnesis',
    title: 'ANAMNESIS / ENFERMEDAD ACTUAL',
    pattern: /^(anamnesis|enfermedad actual|historia de la enfermedad|relato)\b/,
  },
  {
    key: 'funciones',
    title: 'FUNCIONES BIOLÓGICAS',
    pattern: /^funciones biologicas\b/,
  },
  {
    key: 'examen',
    title: 'EXAMEN FÍSICO',
    pattern: /^(examen fisico|examen clinico|exploracion fisica)\b/,
  },
  {
    key: 'observaciones',
    title: 'OBSERVACIONES',
    pattern: /^(observaciones|plan de trabajo|impresion diagnostica|plan y tratamiento)\b/,
  },
];

export const SECTION_ORDER = SECTION_DEFS.map((def) => ({ key: def.key, title: def.title }));

function matchHeader(line: string): SectionDef | null {
  const normalized = normalize(line);
  if (!normalized || normalized.length > 60) return null;
  for (const def of SECTION_DEFS) {
    if (def.pattern.test(normalized)) return def;
  }
  return null;
}

export interface ParsedClinicalText {
  /** Texto previo al primer encabezado reconocido (o todo, si no hay ninguno). */
  preamble: string;
  sections: ClinicalSection[];
  /** true si se reconoció al menos un encabezado. */
  isStructured: boolean;
}

export function parseClinicalSections(text: string): ParsedClinicalText {
  const lines = text.split(/\r?\n/);
  const preambleLines: string[] = [];
  const sections: ClinicalSection[] = [];
  let current: ClinicalSection | null = null;

  for (const line of lines) {
    const def = matchHeader(line);
    if (def) {
      current = { key: def.key, title: def.title, heading: line.trim(), content: '' };
      sections.push(current);
      continue;
    }
    if (current) {
      current.content += (current.content ? '\n' : '') + line;
    } else {
      preambleLines.push(line);
    }
  }

  for (const section of sections) {
    section.content = section.content.replace(/\s+$/, '');
  }

  return {
    preamble: preambleLines.join('\n').replace(/\s+$/, ''),
    sections,
    isStructured: sections.length > 0,
  };
}

export function buildClinicalText(parsed: ParsedClinicalText): string {
  const parts: string[] = [];
  if (parsed.preamble.trim()) parts.push(parsed.preamble.trimEnd());
  for (const section of parsed.sections) {
    parts.push(section.heading ?? section.title);
    if (section.content.trim()) parts.push(section.content.trimEnd());
  }
  return parts.join('\n');
}

/* ─── Campos "Etiqueta: valor" dentro de una sección ─────────── */

export interface SectionField {
  label: string;
  value: string;
}

const FIELD_LINE = /^\s*([^:\n]{2,40}):\s*(.*)$/;

/**
 * Si la mayoría de líneas no vacías de la sección tienen forma
 * "Etiqueta: valor", la sección se puede editar como grid de campos.
 */
export function tryParseFields(content: string): SectionField[] | null {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return null;

  const fields: SectionField[] = [];
  let matched = 0;
  for (const line of lines) {
    const match = FIELD_LINE.exec(line);
    if (match) {
      matched += 1;
      fields.push({ label: match[1].trim(), value: match[2].trim() });
    } else if (fields.length > 0) {
      // Línea de continuación: se anexa al último valor.
      fields[fields.length - 1].value += (fields[fields.length - 1].value ? ' ' : '') + line.trim();
    } else {
      return null;
    }
  }

  if (matched / lines.length < 0.6) return null;
  return fields;
}

export function buildFieldsContent(fields: SectionField[]): string {
  return fields.map((field) => `${field.label}: ${field.value}`.trimEnd()).join('\n');
}

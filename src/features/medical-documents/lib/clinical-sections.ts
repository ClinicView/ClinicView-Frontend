/**
 * Conservative presentation parser. It recognizes explicit headings, not clinical
 * meaning, and never sorts, merges or rewrites the source blocks.
 */
export interface ClinicalSection {
  key: string;
  /** Original visible title, including numbering and clinical qualifiers. */
  title: string;
  /** Literal heading, excluding an inline value but including its colon. */
  heading: string | null;
  content: string;
  /** True only when the source placed a value after a heading's colon. */
  inlineValue?: boolean;
  /** Original whitespace/newline between heading and editable content. */
  headingSeparator?: string;
  /** Single structural newline before the next heading, outside editable content. */
  trailingSeparator?: string;
}

interface SectionDef {
  key: string;
  title: string;
  pattern: RegExp;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Every pattern matches a complete label. A narrative sentence starting with a
// known word (for example "Antecedentes que no recuerda") is not a heading.
const SECTION_DEFS: SectionDef[] = [
  { key: 'encabezado', title: 'Encabezado', pattern: /^encabezado$/ },
  { key: 'filiacion', title: 'Datos de filiación', pattern: /^(?:datos de )?filiacion$/ },
  { key: 'identificacion', title: 'Datos de identificación', pattern: /^(?:datos de identificac?[it]on|datos de identification|identificacion del paciente|datos del paciente|datos personales)$/ },
  { key: 'motivo', title: 'Motivo de consulta', pattern: /^motivo (?:de )?consulta$/ },
  { key: 'tiempo', title: 'Tiempo de enfermedad', pattern: /^tiempo (?:de )?enfermedad$/ },
  { key: 'antecedentes_personales', title: 'Antecedentes personales', pattern: /^antecedente?s? personales(?:\s*\/\s*patologicos)?$/ },
  { key: 'antecedentes_familiares', title: 'Antecedentes familiares', pattern: /^antecedente?s? familiares$/ },
  { key: 'antecedentes', title: 'Antecedentes', pattern: /^antecedente?s?$/ },
  { key: 'anamnesis', title: 'Anamnesis', pattern: /^(?:anamnesis(?:\s*\/\s*enfermedad actual)?|enfermedad actual|historia de la enfermedad(?: actual)?|relato(?: cronologico)?)$/ },
  { key: 'funciones', title: 'Funciones biológicas', pattern: /^func[it]one?s? biologicas?$/ },
  { key: 'examen_general', title: 'Examen físico general', pattern: /^examen (?:fisico|phisico|clinico) general$/ },
  { key: 'examen_regional', title: 'Examen físico regional', pattern: /^examen (?:fisico|phisico|clinico) (?:regional(?:\s*\(por sistemas\))?|por sistemas)$/ },
  { key: 'examen', title: 'Examen físico', pattern: /^(?:examen (?:fisico|phisico|clinico)|exploracion fisica)$/ },
  { key: 'diagnosticos_presuntivos', title: 'Diagnósticos presuntivos', pattern: /^(?:impresion diagnostica\s*\/\s*)?diagnosticos? presuntivos?$/ },
  { key: 'diagnosticos_definitivos', title: 'Diagnósticos definitivos', pattern: /^diagnosticos? definitivos?$/ },
  { key: 'impresion_diagnostica', title: 'Impresión diagnóstica', pattern: /^impresion (?:diagnostica|clinica)$/ },
  { key: 'diagnosticos', title: 'Diagnósticos', pattern: /^diagnosticos?(?:\s*\/\s*impresion clinica)?$/ },
  { key: 'plan_examenes', title: 'Plan de trabajo / exámenes auxiliares', pattern: /^plan de trabajo\s*\/\s*examenes auxiliares$/ },
  { key: 'plan', title: 'Plan de trabajo', pattern: /^(?:plan|plan de trabajo)$/ },
  { key: 'examenes_auxiliares', title: 'Exámenes auxiliares', pattern: /^examenes (?:auxiliares|complementarios)$/ },
  { key: 'tratamiento', title: 'Tratamiento / indicaciones', pattern: /^(?:tratamiento(?:\s*\/\s*indicaciones)?|indicaciones|plan y tratamiento)$/ },
  { key: 'evolucion', title: 'Evolución / observaciones', pattern: /^evolucion(?:\s*\/\s*observaciones)?$/ },
  { key: 'observaciones', title: 'Observaciones', pattern: /^observac[it]one?s?$/ },
  { key: 'firma', title: 'Nombre, firma y sello del médico', pattern: /^(?:nombre,? )?firma y sello(?: del medico)?$/ },
];

/** Available labels, not a sorting instruction. Source order always wins. */
export const SECTION_ORDER = SECTION_DEFS.map(({ key, title }) => ({ key, title }));

function headingLabel(label: string): string {
  return normalize(label)
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[*•-]\s+/, '')
    .replace(/^(?:\(\d+(?:\.\d+)*\)|\d+(?:\.\d+)*[.)º°])(?:\s*[-–—])?\s*/, '')
    .replace(/^\d+(?:\.\d+)*\s+(?:[-–—]\s*)?/, '')
    .replace(/\s*[.:]\s*$/, '')
    .trim();
}

function matchHeader(line: string): { key: string; heading: string; inline: string | null; separator: string } | null {
  const colon = line.indexOf(':');
  const label = colon < 0 ? line : line.slice(0, colon);
  const normalized = headingLabel(label);
  if (!normalized || normalized.length > 160) return null;
  const def = SECTION_DEFS.find((candidate) => candidate.pattern.test(normalized));

  // Unknown labels are preserved as unclassified sections only when the author
  // used an explicit Markdown heading. Unknown prose stays untouched in its block.
  const explicitUnknown = /^\s*#{1,6}\s+\S/.test(line) && colon < 0;
  if (!def && !explicitUnknown) return null;
  if (colon < 0 || !line.slice(colon + 1).trim()) {
    return { key: def?.key ?? 'sin_clasificar', heading: line, inline: null, separator: '' };
  }
  const rest = line.slice(colon + 1);
  const separator = rest.match(/^[\t ]*/)?.[0] ?? '';
  return {
    key: def!.key,
    heading: line.slice(0, colon + 1),
    inline: rest.slice(separator.length),
    separator,
  };
}

export interface ParsedClinicalText {
  /** Exact source before the first recognized heading (or the entire source). */
  preamble: string;
  sections: ClinicalSection[];
  isStructured: boolean;
  /** Used only if an edit needs a new block boundary. */
  lineEnding?: string;
}

export function parseClinicalSections(text: string): ParsedClinicalText {
  let preamble = '';
  const sections: ClinicalSection[] = [];
  let current: ClinicalSection | null = null;
  for (const token of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    const [raw, line, ending] = token;
    if (!raw) continue;
    const header = matchHeader(line);
    if (header) {
      current = {
        key: header.key,
        title: header.heading.trim(),
        heading: header.heading,
        content: header.inline === null ? '' : header.inline + ending,
        inlineValue: header.inline !== null,
        headingSeparator: header.inline === null ? ending : header.separator,
        trailingSeparator: '',
      };
      sections.push(current);
    } else if (current) {
      current.content += raw;
    } else {
      preamble += raw;
    }
  }
  for (const [index, section] of sections.entries()) {
    // Only the delimiter before another heading is structural. Additional blank
    // lines (and all final newlines) remain editable, including a newly typed Enter.
    const trailing = index < sections.length - 1
      ? section.content.match(/(?:\r\n|\r|\n)$/)?.[0] ?? ''
      : '';
    section.trailingSeparator = trailing;
    section.content = section.content.slice(0, section.content.length - trailing.length);
  }
  return { preamble, sections, isStructured: sections.length > 0, lineEnding: text.match(/\r\n|\r|\n/)?.[0] ?? '\n' };
}

export function buildClinicalText(parsed: ParsedClinicalText): string {
  let text = parsed.preamble;
  const lineEnding = parsed.lineEnding ?? '\n';
  for (const section of parsed.sections) {
    // An edit to an empty block/preamble must not attach the next heading to it.
    if (text && !/[\r\n]$/.test(text)) text += lineEnding;
    let separator = section.headingSeparator ?? (section.content ? lineEnding : '');
    if (!separator && section.content && !section.inlineValue) separator = lineEnding;
    text += (section.heading ?? section.title) + separator + section.content + (section.trailingSeparator ?? '');
  }
  return text;
}

export interface SectionField {
  label: string;
  value: string;
  /** Exact label, colon and spacing, including preceding blank lines. */
  prefix?: string;
  /** Exact line ending and any following blank lines. */
  suffix?: string;
}

const FIELD_LINE = /^([\t ]*([^:\r\n]{2,80}):[\t ]*)(.*)$/;

/**
 * Only wholly single-line label/value blocks use inputs. Narrative continuations
 * deliberately fall back to a textarea: an input cannot preserve multiline text.
 */
export function tryParseFields(content: string): SectionField[] | null {
  const fields: SectionField[] = [];
  let leading = '';
  for (const [raw, line, ending] of content.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (!raw) continue;
    if (!line.trim()) {
      if (fields.length) fields[fields.length - 1].suffix += raw;
      else leading += raw;
      continue;
    }
    const match = FIELD_LINE.exec(line);
    if (!match || !match[2].trim()) return null;
    fields.push({ label: match[2].trim(), value: match[3], prefix: leading + match[1], suffix: ending });
    leading = '';
  }
  return fields.length ? fields : null;
}

export function buildFieldsContent(fields: SectionField[]): string {
  return fields.map((field, index) =>
    (field.prefix ?? field.label + ': ') + field.value + (field.suffix ?? (index < fields.length - 1 ? '\n' : '')),
  ).join('');
}

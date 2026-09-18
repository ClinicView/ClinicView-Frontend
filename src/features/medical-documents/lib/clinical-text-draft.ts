import {
  buildClinicalText,
  buildFieldsContent,
  parseClinicalSections,
  tryParseFields,
  type ParsedClinicalText,
  type SectionField,
} from './clinical-sections';

export interface ClinicalTextDraft {
  incomingText: string;
  emittedText: string | null;
  parsed: ParsedClinicalText;
  fields: Array<SectionField[] | null>;
}

export function createClinicalTextDraft(text: string): ClinicalTextDraft {
  const parsed = parseClinicalSections(text);
  return { incomingText: text, emittedText: null, parsed, fields: parsed.sections.map((section) => tryParseFields(section.content)) };
}

/** Own controlled-input echoes must not reclassify text or hide typed whitespace. */
export function receiveClinicalText(draft: ClinicalTextDraft, text: string): ClinicalTextDraft {
  if (text === draft.incomingText) return draft;
  if (text === draft.emittedText) return { ...draft, incomingText: text };
  return createClinicalTextDraft(text);
}

function emit(draft: ClinicalTextDraft, parsed: ParsedClinicalText): ClinicalTextDraft {
  return { ...draft, parsed, emittedText: buildClinicalText(parsed) };
}

export function updateClinicalPreamble(draft: ClinicalTextDraft, content: string): ClinicalTextDraft {
  return emit(draft, { ...draft.parsed, preamble: content });
}

export function updateClinicalSection(draft: ClinicalTextDraft, index: number, content: string): ClinicalTextDraft {
  const parsed = {
    ...draft.parsed,
    sections: draft.parsed.sections.map((section, position) => position === index ? { ...section, content } : section),
  };
  return emit(draft, parsed);
}

export function updateClinicalField(draft: ClinicalTextDraft, sectionIndex: number, fieldIndex: number, value: string): ClinicalTextDraft {
  const currentFields = draft.fields[sectionIndex];
  if (!currentFields) return draft;
  const fields = currentFields.map((field, index) => index === fieldIndex ? { ...field, value } : field);
  return updateClinicalSection(
    { ...draft, fields: draft.fields.map((current, index) => index === sectionIndex ? fields : current) },
    sectionIndex,
    buildFieldsContent(fields),
  );
}

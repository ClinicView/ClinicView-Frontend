import type { OcrBox, OcrLayout, OcrLayoutPage, OcrReviewLine } from '../types/ocr-layout';

export function orderedLines(lines: OcrReviewLine[]): OcrReviewLine[] {
  return [...lines].sort((a, b) => a.page - b.page || a.order - b.order);
}

export function reviewLines(layout: OcrLayout): OcrReviewLine[] {
  if (layout.review) return orderedLines(layout.review.lines).map((line) => ({ ...line, bbox: [...line.bbox], sourceLineIds: [...line.sourceLineIds] }));
  return orderedLines(layout.pages.flatMap((page) => page.lines.map((line) => ({
    lineId: line.lineId, page: page.page, bbox: [...line.bbox] as OcrBox,
    order: line.order, text: line.text, reviewed: false, sourceLineIds: [line.lineId],
  }))));
}

export function reviewSelection(lines: OcrReviewLine[], pages: OcrLayoutPage[], previous: { lineId: string; page: number }) {
  const line = lines.find((item) => item.lineId === previous.lineId)
    ?? lines.find((item) => item.page === previous.page)
    ?? lines[0];
  return { lineId: line?.lineId ?? '', page: line?.page ?? (pages.find((item) => item.page === previous.page)?.page ?? pages[0]?.page ?? 1) };
}

export function boxError(box: readonly number[], page: Pick<OcrLayoutPage, 'width' | 'height'>): string | null {
  if (box.length !== 4 || box.some((value) => !Number.isSafeInteger(value))) return 'Usa cuatro coordenadas enteras en píxeles.';
  if (box[0] < 0 || box[1] < 0 || box[2] > page.width || box[3] > page.height) return `El recorte debe quedar dentro de la página (${page.width} × ${page.height} px).`;
  if (box[0] >= box[2] || box[1] >= box[3]) return 'El borde derecho debe superar al izquierdo y el inferior al superior.';
  return null;
}

function renumber(lines: OcrReviewLine[]) {
  const counts = new Map<number, number>();
  return lines.map((line) => {
    const order = (counts.get(line.page) ?? 0) + 1;
    counts.set(line.page, order);
    return { ...line, order };
  });
}

export function moveLine(lines: OcrReviewLine[], id: string, direction: -1 | 1): OcrReviewLine[] {
  const next = orderedLines(lines);
  const index = next.findIndex((line) => line.lineId === id);
  const target = index + direction;
  if (index < 0 || !next[target] || next[target].page !== next[index].page) return lines;
  [next[index], next[target]] = [next[target], next[index]];
  // A changed reading relationship must be checked again.
  next[index] = { ...next[index], reviewed: false };
  next[target] = { ...next[target], reviewed: false };
  return renumber(next);
}

export function mergeWithNext(lines: OcrReviewLine[], id: string, newId: string): OcrReviewLine[] {
  const ordered = orderedLines(lines);
  const index = ordered.findIndex((line) => line.lineId === id);
  const a = ordered[index];
  const b = ordered[index + 1];
  if (!a || !b || a.page !== b.page) throw new Error('Solo puedes unir fragmentos consecutivos de la misma página.');
  if (ordered.some((line) => line.lineId === newId)) throw new Error('El identificador del fragmento ya existe.');
  const text = [a.text, b.text].join('\n');
  if (text.length > 4000) throw new Error('La unión supera los 4000 caracteres por fragmento.');
  const merged: OcrReviewLine = {
    lineId: newId, page: a.page, order: a.order, text, reviewed: false,
    bbox: [Math.min(a.bbox[0], b.bbox[0]), Math.min(a.bbox[1], b.bbox[1]), Math.max(a.bbox[2], b.bbox[2]), Math.max(a.bbox[3], b.bbox[3])],
    sourceLineIds: [...new Set([...a.sourceLineIds, ...b.sourceLineIds])],
    reason: 'Unión manual de fragmentos consecutivos.',
  };
  ordered.splice(index, 2, merged);
  return renumber(ordered);
}

export function splitLine(lines: OcrReviewLine[], id: string, input: {
  axis: 'horizontal' | 'vertical'; position: number; texts: [string, string]; ids: [string, string];
}): OcrReviewLine[] {
  const ordered = orderedLines(lines);
  const index = ordered.findIndex((line) => line.lineId === id);
  const source = ordered[index];
  if (!source) throw new Error('El fragmento ya no está disponible.');
  const axis = input.axis === 'horizontal' ? 1 : 0;
  if (!Number.isSafeInteger(input.position) || input.position <= source.bbox[axis] || input.position >= source.bbox[axis + 2]) throw new Error('La división debe quedar estrictamente dentro del recorte.');
  if (input.texts.some((text) => text.length > 4000)) throw new Error('Cada fragmento admite hasta 4000 caracteres.');
  if (input.ids[0] === input.ids[1] || input.ids.some((newId) => ordered.some((line) => line.lineId === newId))) throw new Error('Los fragmentos necesitan identificadores distintos.');
  const boxes: [OcrBox, OcrBox] = [[...source.bbox], [...source.bbox]];
  boxes[0][axis + 2] = input.position;
  boxes[1][axis] = input.position;
  const fragments = boxes.map((bbox, i) => ({ ...source, lineId: input.ids[i], bbox, text: input.texts[i], reviewed: false, sourceLineIds: [...source.sourceLineIds], reason: 'División manual del recorte original.' }));
  ordered.splice(index, 1, ...fragments);
  return renumber(ordered);
}

export function reviewError(lines: OcrReviewLine[], pages: OcrLayoutPage[]): string | null {
  const originals = new Map(pages.flatMap((page) => page.lines.map((line) => [line.lineId, page.page] as const)));
  const covered = new Set<string>();
  const ids = new Set<string>();
  const orders = new Set<string>();
  for (const line of lines) {
    const page = pages.find((candidate) => candidate.page === line.page);
    if (!page) return 'Un fragmento hace referencia a una página inexistente.';
    const geometry = boxError(line.bbox, page);
    if (geometry) return `Fragmento ${line.order}: ${geometry}`;
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(line.lineId) || ids.has(line.lineId)) return 'Los identificadores de fragmentos deben ser únicos y válidos.';
    ids.add(line.lineId);
    const key = `${line.page}:${line.order}`;
    if (!Number.isSafeInteger(line.order) || line.order < 1 || orders.has(key)) return 'El orden de lectura debe ser único dentro de cada página.';
    orders.add(key);
    if (line.text.length > 4000) return 'Cada fragmento admite hasta 4000 caracteres.';
    if (!line.sourceLineIds.length && (line.reason?.trim().length ?? 0) < 10) return 'Explica el motivo de los fragmentos agregados (al menos 10 caracteres).';
    for (const origin of line.sourceLineIds) {
      if (originals.get(origin) !== line.page) return 'La procedencia de un fragmento no corresponde a su página.';
      covered.add(origin);
    }
  }
  if ([...originals.keys()].some((id) => !covered.has(id))) return 'Faltan fragmentos originales. No se permite descartar contenido silenciosamente.';
  if (reviewText(lines).length > 50000) return 'La transcripción supera el límite de 50 000 caracteres.';
  return null;
}

export function reviewText(lines: OcrReviewLine[]): string {
  // Keep byte-for-byte parity with the backend's explicit replacement contract.
  return orderedLines(lines).map((line) => line.text).join('\n').trim();
}

const WARNING_LABELS: Record<string, string> = {
  ambiguous_reading_order: 'El orden de lectura necesita revisión.',
  reading_order_ambiguous: 'El orden de lectura necesita revisión.',
  oversized_crop: 'El recorte puede incluir más de un renglón.',
  possible_multiline: 'El recorte puede incluir más de un renglón.',
  overlapping_boxes: 'Hay recortes superpuestos; comprueba si duplican contenido.',
  low_confidence: 'El detector señaló una confianza baja.',
  no_text_detected: 'No se detectaron renglones. Revisa la página completa.',
  non_text_content_requires_page_review: 'Comprueba firmas, sellos, dibujos y cualquier zona sin rectángulo; el detector busca texto, no garantiza detectar todo el contenido.',
  no_text_detected_requires_review: 'No se detectaron renglones. Revisa la página completa y agrega las zonas omitidas.',
  no_text_regions_detected: 'El detector no encontró regiones de texto.',
  no_lines_detected: 'No hay renglones detectados en esta página.',
  oversized_crop_requires_review: 'Este recorte es grande y puede contener varios renglones. Comprueba si conviene dividirlo.',
  line_warnings_require_review: 'Algunos fragmentos tienen observaciones específicas. Selecciónalos para revisarlas.',
  reading_order_provisional_requires_review: 'El orden fue propuesto automáticamente. Comprueba la secuencia de lectura.',
  reading_order_image_unavailable_geometry_fallback: 'El orden se estimó solo con coordenadas porque la imagen no estaba disponible.',
  reading_order_multiple_local_gutters_ambiguous_fallback: 'Hay varias posibles separaciones de columnas. Comprueba que el texto no se intercale.',
  reading_order_unpartitioned_region_requires_review: 'Este panel no pudo dividirse con seguridad. Comprueba sus renglones y su orden.',
  reading_order_unpartitioned_regions_require_review: 'Algunos paneles no pudieron dividirse con seguridad. Comprueba su secuencia.',
  reading_order_spanning_detection_gutter_not_applied: 'Un recorte atraviesa una posible separación de columnas. Comprueba si mezcla campos.',
  reading_order_no_panel_evidence_geometry_fallback: 'No se encontraron límites claros de paneles; el orden se estimó por ubicación.',
  polygon_clipped_to_image: 'La detección llegaba fuera de la imagen y se limitó a sus bordes. Comprueba si falta contenido.',
  invalid_detection_confidence: 'La confianza del detector no estaba disponible en un formato válido.',
  paddle_score_count_mismatch: 'Hay detecciones sin una confianza asociada. Revisa los recortes visualmente.',
  segmentation_failed: 'Falló la segmentación de esta página. Revisa el archivo original.',
  recognition_not_started_segmentation_failed: 'No se inició el reconocimiento porque falló la segmentación.',
  ocr_recognition_failed: 'Falló la transcripción automática. Los recortes conservados se pueden transcribir manualmente.',
  artifact_persistence_failed: 'No se pudieron conservar todas las imágenes del procesamiento. Revisa el archivo original.',
  trocr_failed_tesseract_fallback: 'TrOCR falló y se utilizó un motor alternativo. Contrasta la transcripción con la fuente.',
};

export function warningLabel(warning: string): string {
  if (warning.startsWith('paddle_invalid_polygon:') || warning.startsWith('paddle_degenerate_polygon:')) return 'Se recibió una detección con geometría inválida. Comprueba si falta alguna zona de la página.';
  return WARNING_LABELS[warning] ?? `Observación técnica: ${warning.replace(/[_-]/g, ' ')}. Verifica esta zona en la página.`;
}

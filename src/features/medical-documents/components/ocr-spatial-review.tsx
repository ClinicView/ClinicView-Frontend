'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/shared/ui';
import { ApiError } from '@/shared/services/api-client';
import { formatInstant } from '@/shared/lib/date-time';
import { boxError, mergeWithNext, moveLine, orderedLines, reviewError, reviewLines, reviewSelection, reviewText, splitLine, warningLabel } from '../lib/ocr-layout';
import { getOcrLayout, getOcrPageImage, getOcrReviewRevision, saveOcrReview } from '../services/ocr-layout.service';
import type { OcrBox, OcrLayout, OcrLayoutPage, OcrReviewLine, OcrRevision } from '../types/ocr-layout';
import styles from './ocr-spatial-review.module.css';

interface Props {
  patientId: string;
  docId: string;
  version: number;
  canEdit: boolean;
  blocked: boolean;
  correctedText: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSavingChange: (saving: boolean) => void;
  onSaved: () => Promise<boolean>;
}

const LIST_SIZE = 10;
const newId = () => `manual_${crypto.randomUUID().replaceAll('-', '_')}`;

function usePageImage(patientId: string, docId: string, page: OcrLayoutPage | undefined, runId: string | null, retry: number) {
  const [result, setResult] = useState<{ key: string; url?: string; error?: string }>({ key: '' });
  const key = `${patientId}/${docId}/${runId}/${page?.page}/${retry}`;
  const pageNumber = page?.page;
  const available = page?.imageAvailable;
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    if (!runId || !pageNumber || !available) return;
    void getOcrPageImage(patientId, docId, pageNumber, runId).then((blob) => {
      if (cancelled) return;
      if (!blob.type.startsWith('image/')) throw new Error('La respuesta no contiene una imagen de página válida.');
      objectUrl = URL.createObjectURL(blob);
      setResult({ key, url: objectUrl });
    }).catch((error: unknown) => {
      if (!cancelled) setResult({ key, error: error instanceof Error ? error.message : 'No se pudo cargar la imagen.' });
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [patientId, docId, pageNumber, runId, key, available]);
  return result.key === key ? result : { key };
}

export function OcrSpatialReview({ patientId, docId, version, canEdit, blocked, correctedText, onDirtyChange, onSavingChange, onSaved }: Props) {
  const [layout, setLayout] = useState<OcrLayout | null>(null);
  const [lines, setLines] = useState<OcrReviewLine[]>([]);
  const [saved, setSaved] = useState('[]');
  const [history, setHistory] = useState<OcrReviewLine[][]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [showBoxes, setShowBoxes] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [region, setRegion] = useState('');
  const [listPage, setListPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [imageRetry, setImageRetry] = useState(0);
  const [pendingForms, setPendingForms] = useState({ geometry: false, split: false, manual: false });
  const [formEpoch, setFormEpoch] = useState(0);
  const geometryPending = useCallback((pending: boolean) => setPendingForms((prior) => prior.geometry === pending ? prior : { ...prior, geometry: pending }), []);
  const splitPending = useCallback((pending: boolean) => setPendingForms((prior) => prior.split === pending ? prior : { ...prior, split: pending }), []);
  const manualPending = useCallback((pending: boolean) => setPendingForms((prior) => prior.manual === pending ? prior : { ...prior, manual: pending }), []);
  const hasPendingForm = Object.values(pendingForms).some(Boolean);
  const lineDirty = JSON.stringify(lines) !== saved;
  const dirty = lineDirty || hasPendingForm;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const errorRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ lineId: selectedId, page: pageNumber });
  selectionRef.current = { lineId: selectedId, page: pageNumber };
  const page = layout?.pages.find((candidate) => candidate.page === pageNumber);
  const image = usePageImage(patientId, docId, page, layout?.runId ?? null, imageRetry);
  const ordered = useMemo(() => orderedLines(lines), [lines]);
  const pageLines = useMemo(() => ordered.filter((line) => line.page === pageNumber), [ordered, pageNumber]);
  const selected = lines.find((line) => line.lineId === selectedId && line.page === pageNumber);
  const selectedIndex = pageLines.findIndex((line) => line.lineId === selectedId);
  const originalMap = useMemo(() => new Map(layout?.pages.flatMap((item) => item.lines.map((line) => [line.lineId, line] as const)) ?? []), [layout]);
  const regions = [...new Set(page?.lines.map((line) => line.regionId).filter((value): value is string => Boolean(value)) ?? [])];
  const filtered = pageLines.filter((line) => (!pendingOnly || !line.reviewed) && (!region || line.sourceLineIds.some((id) => originalMap.get(id)?.regionId === region)));
  const listCount = Math.max(1, Math.ceil(filtered.length / LIST_SIZE));
  const currentListPage = Math.min(listPage, listCount - 1);
  const shownLines = filtered.slice(currentListPage * LIST_SIZE, (currentListPage + 1) * LIST_SIZE);
  const editable = canEdit && !blocked && !saving && !syncPending && !conflict;
  const reviewed = lines.filter((line) => line.reviewed).length;

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange(saving || syncPending); }, [saving, syncPending, onSavingChange]);
  useEffect(() => () => { onDirtyChange(false); onSavingChange(false); }, [onDirtyChange, onSavingChange]);

  useEffect(() => {
    let cancelled = false;
    if (dirtyRef.current) {
      if (layoutRef.current?.documentVersion !== version) {
        setConflict(true);
        setError('El documento cambió mientras tenías un borrador. Tus cambios siguen aquí; descártalos y recarga para trabajar sobre la versión actual.');
      }
      return;
    }
    setLoading(true);
    void getOcrLayout(patientId, docId).then((next) => {
      if (cancelled) return;
      // An assignment/version refresh must never erase a draft made while fetching.
      if (dirtyRef.current) {
        if (layoutRef.current?.documentVersion !== next.documentVersion) {
          setConflict(true);
          setError('Llegó una versión más reciente. Tu borrador local se conserva hasta que decidas descartarlo.');
        }
        return;
      }
      const initial = reviewLines(next);
      setLayout(next);
      setLines(initial);
      setSaved(JSON.stringify(initial));
      setHistory([]);
      const selection = reviewSelection(initial, next.pages, selectionRef.current);
      setSelectedId(selection.lineId);
      setPageNumber(selection.page);
      setConflict(false);
      setError(null);
    }).catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : 'No se pudo cargar la revisión visual.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId, docId, version, retry]);

  function change(next: OcrReviewLine[], message?: string) {
    if (!editable) return;
    setHistory((prior) => [...prior.slice(-39), lines]);
    setLines(next);
    setError(null);
    setNotice(message ?? 'Borrador local actualizado. Guarda para conservar los cambios.');
  }

  function select(line: OcrReviewLine, focus = false, resetFilters = false) {
    if (!allowSelection()) return;
    setPageNumber(line.page); setSelectedId(line.lineId);
    if (resetFilters) { setPendingOnly(false); setRegion(''); }
    const candidates = resetFilters ? ordered.filter((item) => item.page === line.page) : filtered;
    const index = candidates.findIndex((item) => item.lineId === line.lineId);
    if (index >= 0) setListPage(Math.floor(index / LIST_SIZE));
    if (focus) window.requestAnimationFrame(() => textRef.current?.focus());
  }

  function allowSelection() {
    if (!hasPendingForm) return true;
    if (!window.confirm('Hay ajustes de recorte, división o zona nueva que todavía no aplicaste. ¿Descartar esos ajustes y cambiar de fragmento?')) return false;
    setPendingForms({ geometry: false, split: false, manual: false }); setFormEpoch((value) => value + 1);
    return true;
  }

  function updateSelected(patch: Partial<OcrReviewLine>) {
    if (!selected) return;
    change(lines.map((line) => line.lineId === selected.lineId ? { ...line, ...patch } : line));
  }

  function discard() {
    if (dirty && !window.confirm('¿Descartar los cambios locales de recortes y transcripción? La última revisión guardada no se elimina.')) return;
    dirtyRef.current = false;
    setLines(JSON.parse(saved) as OcrReviewLine[]); setHistory([]);
    setPendingForms({ geometry: false, split: false, manual: false }); setFormEpoch((value) => value + 1);
    setError(null); setNotice('Borrador descartado.'); setRetry((value) => value + 1);
  }

  async function save() {
    if (!layout?.runId || !editable || hasPendingForm) return;
    const invalid = reviewError(lines, layout.pages);
    if (invalid) { setError(invalid); window.requestAnimationFrame(() => errorRef.current?.focus()); return; }
    const text = reviewText(lines);
    if ((correctedText !== null && correctedText !== text) || layout.review?.stale) {
      if (!window.confirm('Guardar esta revisión reemplazará el borrador de texto clínico por la transcripción de estos fragmentos, en su orden actual. Las secciones deberán revisarse nuevamente. No valida el documento. ¿Deseas continuar?')) return;
    }
    setSaving(true); setError(null);
    let committed = false;
    try {
      const next = await saveOcrReview(patientId, docId, { expectedVersion: layout.documentVersion, runId: layout.runId, lines, confirmTextReplacement: correctedText !== null && correctedText !== text });
      const persisted = reviewLines(next);
      dirtyRef.current = false;
      setLayout(next); setLines(persisted); setSaved(JSON.stringify(persisted)); setHistory([]);
      onDirtyChange(false);
      setNotice('Revisión guardada y transcripción actualizada. La validación clínica sigue pendiente.');
      committed = true;
    } catch (caught) {
      setConflict(caught instanceof ApiError && caught.status === 409);
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar. Tu borrador permanece en esta pantalla.');
      window.requestAnimationFrame(() => errorRef.current?.focus());
    }
    if (committed) await synchronizeSavedDocument();
    setSaving(false);
  }

  async function synchronizeSavedDocument() {
    setSyncPending(true);
    try {
      const synchronized = await onSaved();
      setSyncPending(!synchronized);
      if (!synchronized) setNotice('La revisión sí quedó guardada. Falta actualizar el editor clínico; reintenta la sincronización antes de continuar.');
      else setNotice('Revisión guardada y editor clínico actualizado. La validación sigue siendo una acción separada.');
    } catch {
      setNotice('La revisión sí quedó guardada, pero no se pudo actualizar el editor clínico. Reintenta la sincronización.');
    }
  }

  if (loading && !layout) return <section className={styles.shell} aria-busy="true"><div className={styles.empty} role="status">Preparando página, recortes y transcripción…</div></section>;
  if (!layout || !layout.available) return <section className={styles.shell} aria-labelledby="spatial-heading">
    <div className={styles.heading}><Icon name="scan" size={22} /><div><h2 id="spatial-heading">Revisión visual por fragmentos</h2><p>{error ?? 'Este documento no tiene coordenadas de digitalización conservadas.'}</p></div></div>
    <div className={styles.empty}><p>El archivo original y la corrección clínica siguen disponibles abajo. Los documentos digitalizados con el nuevo módulo mostrarán aquí su página, recortes y texto; no se inventan rectángulos para registros anteriores.</p>{error && <button className={styles.button} type="button" onClick={() => setRetry((value) => value + 1)}>Reintentar revisión visual</button>}</div>
  </section>;

  const originalSelected = selected?.sourceLineIds.flatMap((id) => originalMap.get(id) ? [originalMap.get(id)!] : []) ?? [];
  const lineWarnings = [...new Set(originalSelected.flatMap((line) => line.warnings ?? []))];
  const warningCount = layout.pages.reduce((total, item) => total + item.warnings.length + item.lines.filter((line) => line.warnings?.length).length, 0);

  return <section className={styles.shell} aria-labelledby="spatial-heading" aria-busy={saving || loading}>
    <header className={styles.heading}>
      <span className={styles.headingIcon}><Icon name="scan" size={23} /></span>
      <div className={styles.headingText}><span className={styles.eyebrow}>01 · Fuente y transcripción</span><h2 id="spatial-heading">Cada fragmento, en su contexto</h2><p>Compara la página con los recortes. Corrige el contenido y su orden antes de la revisión clínica.</p></div>
      <details className={styles.help}><summary><Icon name="info" size={18} /> Cómo revisar</summary><div><p>Los números indican el orden de lectura. Selecciona un rectángulo o utiliza la lista y los botones Anterior/Siguiente.</p><p>En «Ajustar recorte» puedes cambiar sus límites en píxeles, sin arrastrar. Unir o dividir conserva la procedencia; no vuelve a ejecutar OCR. Comprueba letras, márgenes y contenido omitido.</p><p>La confianza es una señal del modelo, no una medida de exactitud. Marcar un fragmento como revisado no valida la historia clínica.</p></div></details>
    </header>

    <div className={styles.summary}>
      <span><strong>{layout.pages.length}</strong> {layout.pages.length === 1 ? 'página' : 'páginas'}</span>
      <span><strong>{lines.length}</strong> fragmentos</span>
      <span><strong>{reviewed}/{lines.length}</strong> revisados</span>
      <span>{warningCount ? `${warningCount} observaciones para verificar` : 'Comprueba también las zonas sin recorte'}</span>
    </div>

    {(blocked || !canEdit || conflict || layout.review?.stale) && <div className={styles.banner}>
      {blocked ? 'Guarda o descarta primero los cambios del editor clínico. La revisión visual permanece en consulta.' : !canEdit ? 'Modo consulta. Para corregir, el documento debe estar en revisión y asignado a tu usuario.' : conflict ? 'Hay un conflicto de versión. Conservamos tu borrador local; recarga cuando estés listo para descartarlo.' : 'El texto clínico cambió después de esta revisión. Guardar aquí lo reemplazará por el texto de los fragmentos.'}
    </div>}

    {error && <div className={styles.error} role="alert" tabIndex={-1} ref={errorRef}>{error}{conflict && <button type="button" className={styles.button} onClick={discard}>Descartar borrador y recargar</button>}</div>}
    {hasPendingForm && <p className={styles.banner} role="status">Hay ajustes sin aplicar en las herramientas avanzadas. Aplica o cancela esos ajustes antes de guardar la revisión.</p>}
    {syncPending && !saving && <div className={styles.banner} role="status"><p>El guardado ya fue confirmado. El editor clínico permanece bloqueado hasta cargar la nueva versión.</p><button type="button" className={styles.button} onClick={() => void synchronizeSavedDocument()}>Sincronizar versión guardada</button></div>}

    <div className={styles.workspace}>
      <div className={styles.sourceColumn}>
        <div className={styles.toolbar}>
          <label className={styles.pageSelect}>Página<select value={pageNumber} onChange={(event) => { if (!allowSelection()) return; const number = Number(event.target.value); setPageNumber(number); setSelectedId(ordered.find((line) => line.page === number)?.lineId ?? ''); setListPage(0); setRegion(''); setZoom(1); }}>{layout.pages.map((item) => <option key={item.page} value={item.page}>{item.page} de {layout.pages.length}</option>)}</select></label>
          <div className={styles.zoomControls} aria-label="Tamaño de página">
            <button type="button" className={styles.iconButton} aria-label="Reducir página" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - .25))}><Icon name="zoom-out" size={18} /></button>
            <button type="button" className={styles.button} onClick={() => setZoom(1)}>{zoom === 1 ? 'Ajustar' : `${Math.round(zoom * 100)} %`}</button>
            <button type="button" className={styles.iconButton} aria-label="Ampliar página" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + .25))}><Icon name="zoom-in" size={18} /></button>
          </div>
          <button type="button" className={styles.button} aria-pressed={showBoxes} onClick={() => setShowBoxes((value) => !value)}><Icon name={showBoxes ? 'eye' : 'eye-off'} size={17} /> Recortes</button>
        </div>

        <div className={styles.pageScroll} tabIndex={0} role="region" aria-label="Página digitalizada. Usa la lista de fragmentos para seleccionar con teclado.">
          {page && image.url ? <svg className={styles.pageImage} style={{ width: `${zoom * 100}%` }} viewBox={`0 0 ${page.width} ${page.height}`} role="img" aria-label={`Página ${page.page} procesada. ${pageLines.length} recortes. La lista de abajo permite recorrerlos.`}>
            <image href={image.url} width={page.width} height={page.height} />
            {showBoxes && pageLines.map((line) => <g key={line.lineId} className={`${styles.box} ${line.lineId === selectedId ? styles.boxSelected : ''} ${line.reviewed ? styles.boxReviewed : ''}`} onClick={() => select(line, false, true)} aria-hidden="true">
              <rect x={line.bbox[0]} y={line.bbox[1]} width={line.bbox[2] - line.bbox[0]} height={line.bbox[3] - line.bbox[1]} vectorEffect="non-scaling-stroke" />
              <text x={line.bbox[0] + 5} y={Math.max(28, line.bbox[1] + 28)} fontSize={Math.max(25, page.width / 70)}>{line.order}</text>
            </g>)}
          </svg> : <div className={styles.imageEmpty} role="status"><Icon name="document" size={36} /><p>{image.error ?? (page?.imageAvailable ? 'Cargando imagen protegida…' : 'La imagen de esta ejecución no está disponible. Usa el archivo original para contrastar el texto.')}</p>{image.error && <button className={styles.button} type="button" onClick={() => setImageRetry((value) => value + 1)}>Reintentar imagen</button>}</div>}
        </div>
        <p className={styles.caption}>Página procesada · recortes en píxeles de esta imagen · el archivo original permanece intacto.</p>

        {Boolean(page?.warnings.length) && <details className={styles.disclosure}><summary><Icon name="warning" size={17} /> Observaciones de esta página ({page?.warnings.length})</summary><ul>{page?.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warningLabel(warning)}</li>)}</ul></details>}

        <div className={styles.listHeader}><h3>Orden de lectura</h3><label className={styles.checkLabel}><input type="checkbox" checked={pendingOnly} onChange={(event) => { setPendingOnly(event.target.checked); setListPage(0); }} /> Solo pendientes</label></div>
        {regions.length > 1 && <label className={styles.regionSelect}>Panel detectado<select value={region} onChange={(event) => { setRegion(event.target.value); setListPage(0); }}><option value="">Todos los paneles</option>{regions.map((id, index) => <option key={id} value={id}>Panel {index + 1}</option>)}</select></label>}
        <ol className={styles.lineList} aria-label={`Fragmentos de la página ${pageNumber}`}>
          {shownLines.map((line) => <li key={line.lineId}><button type="button" className={`${styles.lineButton} ${line.lineId === selectedId ? styles.lineActive : ''}`} aria-current={line.lineId === selectedId ? 'true' : undefined} onClick={() => select(line, true)}><span className={styles.lineNumber}>{line.order}</span><span className={styles.lineText}>{line.text || 'Sin texto reconocido'}</span><span className={styles.lineState}>{line.reviewed ? 'Revisado' : 'Pendiente'}</span></button></li>)}
        </ol>
        {!filtered.length && <p className={styles.empty}>No hay fragmentos con este filtro. También puedes agregar una zona omitida.</p>}
        {listCount > 1 && <nav className={styles.pagination} aria-label="Paginación de fragmentos"><button type="button" className={styles.button} disabled={currentListPage === 0} onClick={() => setListPage(currentListPage - 1)}>Lista anterior</button><span>{currentListPage + 1} de {listCount}</span><button type="button" className={styles.button} disabled={currentListPage === listCount - 1} onClick={() => setListPage(currentListPage + 1)}>Lista siguiente</button></nav>}
      </div>

      <div className={styles.editorColumn}>
        {selected && page ? <>
          <div className={styles.editorHeader}><div><span className={styles.eyebrow}>Página {selected.page}</span><h3>Fragmento {selected.order}</h3></div><span className={`${styles.stateBadge} ${selected.reviewed ? styles.reviewedBadge : ''}`}>{selected.reviewed ? 'Revisado' : 'Por revisar'}</span></div>
          <div className={styles.pagination}><button type="button" className={styles.button} disabled={selectedIndex <= 0} onClick={() => select(pageLines[selectedIndex - 1])}>Anterior</button><span>{selectedIndex + 1} / {pageLines.length}</span><button type="button" className={styles.button} disabled={selectedIndex < 0 || selectedIndex >= pageLines.length - 1} onClick={() => select(pageLines[selectedIndex + 1])}>Siguiente</button></div>
          <div className={styles.crop}>{image.url ? <svg viewBox={`${selected.bbox[0]} ${selected.bbox[1]} ${selected.bbox[2] - selected.bbox[0]} ${selected.bbox[3] - selected.bbox[1]}`} role="img" aria-label={`Recorte del fragmento ${selected.order}, página ${selected.page}`}><image href={image.url} width={page.width} height={page.height} /></svg> : <p>El recorte se mostrará cuando la imagen esté disponible.</p>}</div>
          <label className={styles.field}>Transcripción del fragmento<textarea ref={textRef} value={selected.text} maxLength={4000} rows={5} disabled={!editable || hasPendingForm} onChange={(event) => updateSelected({ text: event.target.value, reviewed: false })} aria-describedby="spatial-text-hint" /></label>
          <p id="spatial-text-hint" className={styles.caption}>Transcribe solo lo visible. No completes datos por suposición. {selected.text.length}/4000 caracteres.</p>
          <label className={styles.reviewCheck}><input type="checkbox" checked={selected.reviewed} disabled={!editable || !image.url || hasPendingForm} onChange={(event) => updateSelected({ reviewed: event.target.checked })} /> He contrastado este fragmento con la imagen</label>
          <details className={styles.disclosure}><summary>Texto automático y procedencia</summary><div>{originalSelected.length ? originalSelected.map((line) => <div key={line.lineId} className={styles.originalLine}><p>{line.text || 'Sin texto automático.'}</p><small>Confianza OCR: {line.confidence === null || line.confidence === undefined ? 'no disponible' : `${Math.round(line.confidence * 100)} %`} · no equivale a exactitud.</small></div>) : <p>Fragmento añadido manualmente. {selected.reason}</p>}<p className={styles.caption}>{selected.sourceLineIds.length} fragmento(s) original(es) conservado(s) como procedencia.</p></div></details>
          {lineWarnings.length > 0 && <div className={styles.warning}><Icon name="warning" size={18} /><ul>{lineWarnings.map((warning) => <li key={warning}>{warningLabel(warning)}</li>)}</ul></div>}
          <GeometryEditor key={`${formEpoch}-${selected.lineId}-${selected.bbox.join('-')}`} line={selected} page={page} disabled={!editable || pendingForms.split || pendingForms.manual} onPending={geometryPending} onApply={(bbox) => updateSelected({ bbox, reviewed: false })} />
          <details className={styles.disclosure}><summary>Orden, unión y división</summary><div className={styles.advanced}>
            <p>Los cambios quedan en el borrador y conservan la procedencia original. Puedes deshacerlos antes de guardar.</p>
            <div className={styles.actionRow}><button className={styles.button} type="button" disabled={!editable || hasPendingForm || selectedIndex <= 0} onClick={() => change(moveLine(lines, selected.lineId, -1), 'Fragmento movido hacia arriba. Verifica su nuevo orden.')}>Subir en el orden</button><button className={styles.button} type="button" disabled={!editable || hasPendingForm || selectedIndex >= pageLines.length - 1} onClick={() => change(moveLine(lines, selected.lineId, 1), 'Fragmento movido hacia abajo. Verifica su nuevo orden.')}>Bajar en el orden</button></div>
            <button className={styles.button} type="button" disabled={!editable || hasPendingForm || selectedIndex >= pageLines.length - 1} onClick={() => { if (!window.confirm('¿Unir este fragmento y el siguiente? Se conservarán ambos textos y sus referencias.')) return; try { const id = newId(); change(mergeWithNext(lines, selected.lineId, id), 'Fragmentos unidos. Comprueba su recorte y texto.'); setSelectedId(id); } catch (caught) { setError((caught as Error).message); } }}>Unir con el siguiente</button>
            <SplitEditor key={`${formEpoch}-${selected.lineId}-${selected.text}-${selected.bbox.join('-')}`} line={selected} disabled={!editable || pendingForms.geometry || pendingForms.manual} onPending={splitPending} onSplit={(input) => { try { const ids: [string, string] = [newId(), newId()]; change(splitLine(lines, selected.lineId, { ...input, ids }), 'Fragmento dividido. Revisa ambos recortes y sus textos.'); setSelectedId(ids[0]); } catch (caught) { setError((caught as Error).message); } }} />
          </div></details>
        </> : <div className={styles.empty}><Icon name="scan" size={30} /><h3>Selecciona un fragmento</h3><p>Usa un rectángulo de la página o su entrada en la lista para contrastar la transcripción.</p></div>}
        {page && <ManualRegion key={`${formEpoch}-${page.page}`} page={page} disabled={!editable || !image.url || pendingForms.geometry || pendingForms.split} onPending={manualPending} onAdd={(bbox, reason) => { const id = newId(); const next = [...lines, { lineId: id, page: page.page, bbox, order: Math.max(0, ...pageLines.map((line) => line.order)) + 1, text: '', reviewed: false, sourceLineIds: [], reason }]; change(next, 'Zona agregada al final de la página. Transcribe su contenido y ajusta el orden.'); setSelectedId(id); setPendingOnly(false); setRegion(''); setFormEpoch((value) => value + 1); }} />}
      </div>
    </div>

    {Boolean(layout.revisions?.length) && <RevisionHistory key={layout.runId} patientId={patientId} docId={docId} layout={layout} />}

    <footer className={styles.footer}>
      <div><strong>{dirty ? 'Cambios sin guardar' : layout.review ? `Revisión ${layout.review.revision} guardada` : 'Sin revisión humana guardada'}</strong><p>Guardar actualiza la transcripción clínica con estos fragmentos. No valida ni publica el documento.</p>{layout.review && <p>Por {layout.review.recordedBy.fullName} (@{layout.review.recordedBy.username}) · {formatInstant(layout.review.recordedAt)}</p>}<p className={styles.caption}>Ejecución: {layout.runId}</p></div>
      <div className={styles.footerActions}><button type="button" className={styles.button} disabled={!editable || !history.length || hasPendingForm} onClick={() => { const prior = history[history.length - 1]; const selection = reviewSelection(prior, layout.pages, selectionRef.current); setLines(prior); setHistory((items) => items.slice(0, -1)); setSelectedId(selection.lineId); setPageNumber(selection.page); setNotice('Último cambio deshecho.'); }}>Deshacer</button><button type="button" className={styles.button} disabled={saving || (!dirty && !conflict)} onClick={discard}>Descartar</button><button type="button" className={`${styles.button} ${styles.primary}`} disabled={!editable || !lineDirty || hasPendingForm} onClick={() => void save()}><Icon name="check" size={17} />{saving ? 'Guardando…' : 'Guardar revisión y actualizar transcripción'}</button></div>
    </footer>
    <p className={styles.status} role="status" aria-live="polite">{notice}</p>
  </section>;
}

function RevisionHistory({ patientId, docId, layout }: { patientId: string; docId: string; layout: OcrLayout }) {
  const [selectedRevision, setSelectedRevision] = useState(layout.revisions?.[0]?.revision ?? 1);
  const [revision, setRevision] = useState<OcrRevision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  async function inspect() {
    if (!layout.runId) return;
    const current = ++request.current;
    setLoading(true); setError(null); setRevision(null);
    try {
      const result = await getOcrReviewRevision(patientId, docId, layout.runId, selectedRevision);
      if (request.current === current) setRevision(result);
    } catch (caught) {
      if (request.current === current) setError(caught instanceof Error ? caught.message : 'No se pudo consultar la revisión.');
    } finally { if (request.current === current) setLoading(false); }
  }
  return <details className={`${styles.disclosure} ${styles.history}`}><summary><Icon name="clock" size={18} /> Historial de revisiones ({layout.revisions?.length})</summary><div className={styles.advanced}>
    <p>Versiones guardadas de esta ejecución. La consulta es de solo lectura y no reemplaza el borrador actual.</p>
    <div className={styles.actionRow}><label className={styles.field}>Revisión<select value={selectedRevision} onChange={(event) => { request.current += 1; setLoading(false); setSelectedRevision(Number(event.target.value)); setRevision(null); }}>{layout.revisions?.map((item) => <option key={item.revision} value={item.revision}>#{item.revision} · @{item.recordedBy.username} · {formatInstant(item.recordedAt)}</option>)}</select></label><button className={styles.button} type="button" disabled={loading} onClick={() => void inspect()}>{loading ? 'Cargando…' : 'Consultar versión guardada'}</button></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {revision && <div><p><strong>Revisión {revision.revision}</strong> · {revision.recordedBy.fullName} (@{revision.recordedBy.username}) · {revision.lines.length} fragmentos · versión documental {revision.documentVersion}</p><label className={styles.field}>Transcripción guardada<textarea rows={7} readOnly value={revision.correctedText} /></label><details className={styles.disclosure}><summary>Texto clínico conservado antes de este guardado</summary><label className={styles.field}>Versión anterior {revision.previousCorrection.documentVersion}<textarea rows={5} readOnly value={revision.previousCorrection.text ?? 'No había un texto clínico corregido guardado.'} /></label></details></div>}
  </div></details>;
}

function CoordinateFields({ values, onChange, page, disabled }: { values: string[]; onChange: (values: string[]) => void; page: OcrLayoutPage; disabled: boolean }) {
  return <div className={styles.coordinates}>{['Izquierda (x1)', 'Superior (y1)', 'Derecha (x2)', 'Inferior (y2)'].map((label, index) => <label key={label} className={styles.field}>{label}<input type="number" min={0} max={index % 2 ? page.height : page.width} step={1} value={values[index]} disabled={disabled} onChange={(event) => onChange(values.map((value, i) => i === index ? event.target.value : value))} /></label>)}</div>;
}

function usePendingForm(dirty: boolean, onPending: (pending: boolean) => void) {
  useEffect(() => { onPending(dirty); }, [dirty, onPending]);
  useEffect(() => () => { onPending(false); }, [onPending]);
}

function GeometryEditor({ line, page, disabled, onApply, onPending }: { line: OcrReviewLine; page: OcrLayoutPage; disabled: boolean; onApply: (box: OcrBox) => void; onPending: (pending: boolean) => void }) {
  const [values, setValues] = useState(line.bbox.map(String));
  const [error, setError] = useState<string | null>(null);
  const dirty = values.some((value, index) => value !== String(line.bbox[index]));
  usePendingForm(dirty, onPending);
  return <details className={styles.disclosure}><summary>Ajustar recorte</summary><div className={styles.advanced}><p>Bordes de la imagen en píxeles. El origen (0, 0) está en la esquina superior izquierda.</p><CoordinateFields values={values} onChange={setValues} page={page} disabled={disabled} />{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.actionRow}><button type="button" className={styles.button} disabled={disabled || !dirty} onClick={() => { const box = values.map((value) => value.trim() === '' ? NaN : Number(value)) as OcrBox; const invalid = boxError(box, page); setError(invalid); if (!invalid) onApply(box); }}>Aplicar límites</button><button type="button" className={styles.button} disabled={!dirty} onClick={() => { setValues(line.bbox.map(String)); setError(null); }}>Cancelar ajuste</button></div></div></details>;
}

function SplitEditor({ line, disabled, onSplit, onPending }: { line: OcrReviewLine; disabled: boolean; onSplit: (input: { axis: 'horizontal' | 'vertical'; position: number; texts: [string, string] }) => void; onPending: (pending: boolean) => void }) {
  const [axis, setAxis] = useState<'horizontal' | 'vertical'>('horizontal');
  const [position, setPosition] = useState(String(Math.floor((line.bbox[1] + line.bbox[3]) / 2)));
  const [texts, setTexts] = useState<[string, string]>([line.text, '']);
  const initialPosition = String(Math.floor((line.bbox[1] + line.bbox[3]) / 2));
  const dirty = axis !== 'horizontal' || position !== initialPosition || texts[0] !== line.text || texts[1] !== '';
  usePendingForm(dirty, onPending);
  return <fieldset className={styles.splitFields} disabled={disabled}><legend>Dividir en dos fragmentos</legend><p>Distribuye todo el texto visible entre las dos partes. La división no transcribe automáticamente.</p><label className={styles.field}>Dirección<select value={axis} onChange={(event) => { const value = event.target.value as 'horizontal' | 'vertical'; setAxis(value); const coordinate = value === 'horizontal' ? 1 : 0; setPosition(String(Math.floor((line.bbox[coordinate] + line.bbox[coordinate + 2]) / 2))); }}><option value="horizontal">Arriba / abajo</option><option value="vertical">Izquierda / derecha</option></select></label><label className={styles.field}>Posición {axis === 'horizontal' ? 'Y' : 'X'} de la división (px)<input type="number" value={position} onChange={(event) => setPosition(event.target.value)} /></label>{texts.map((text, index) => <label key={index} className={styles.field}>Texto de la parte {index + 1}<textarea value={text} maxLength={4000} rows={3} onChange={(event) => setTexts((prior) => index === 0 ? [event.target.value, prior[1]] : [prior[0], event.target.value])} /></label>)}<div className={styles.actionRow}><button type="button" className={styles.button} onClick={() => onSplit({ axis, position: position.trim() ? Number(position) : NaN, texts })}>Aplicar división</button><button type="button" className={styles.button} disabled={!dirty} onClick={() => { setAxis('horizontal'); setPosition(initialPosition); setTexts([line.text, '']); }}>Cancelar división</button></div></fieldset>;
}

function ManualRegion({ page, disabled, onAdd, onPending }: { page: OcrLayoutPage; disabled: boolean; onAdd: (box: OcrBox, reason: string) => void; onPending: (pending: boolean) => void }) {
  const [values, setValues] = useState(['0', '0', String(Math.min(400, page.width)), String(Math.min(80, page.height))]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const initial = ['0', '0', String(Math.min(400, page.width)), String(Math.min(80, page.height))];
  const dirty = reason !== '' || values.some((value, index) => value !== initial[index]);
  usePendingForm(dirty, onPending);
  return <details className={styles.disclosure}><summary><Icon name="edit" size={17} /> Agregar una zona omitida</summary><div className={styles.advanced}><p>Si falta contenido, registra su ubicación en la página. No se crea texto automáticamente.</p><CoordinateFields values={values} onChange={setValues} page={page} disabled={disabled} /><label className={styles.field}>Motivo de la incorporación<textarea value={reason} minLength={10} maxLength={500} rows={2} disabled={disabled} onChange={(event) => setReason(event.target.value)} placeholder="Describe el contenido que no fue detectado." /></label>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.actionRow}><button type="button" className={styles.button} disabled={disabled} onClick={() => { const box = values.map((value) => value.trim() === '' ? NaN : Number(value)) as OcrBox; const invalid = boxError(box, page) ?? (reason.trim().length < 10 ? 'Explica el motivo con al menos 10 caracteres.' : null); setError(invalid); if (!invalid) { onAdd(box, reason.trim()); setReason(''); } }}>Crear fragmento manual</button><button type="button" className={styles.button} disabled={!dirty} onClick={() => { setValues(initial); setReason(''); setError(null); }}>Cancelar zona</button></div></div></details>;
}

'use client';
import { useRef, useState, type FormEvent } from 'react';
import { getClinicalHistoryExport } from '../services/patients.service';
import { exportClinicalHistoryPdf } from '../lib/history-pdf';
import { isValidDateOnly } from '@/shared/lib/date-time';
import { Alert } from '@/shared/ui';
import { ContextHelp } from '@/shared/ui/context-help';
import type { components } from '@/shared/types/api.generated';
import styles from '@/features/clinical-records/components/clinical-workflow.module.css';

export function HistoryExportPanel({
  patientId,
  episodes,
}: {
  patientId: string;
  episodes: components['schemas']['EpisodeOverviewDto'][];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  async function generate(form?: HTMLFormElement) {
    const data = form ? new FormData(form) : null;
    const from = String(data?.get('from') ?? '');
    const to = String(data?.get('to') ?? '');
    setError('');
    if (
      (from && !isValidDateOnly(from)) ||
      (to && !isValidDateOnly(to)) ||
      (from && to && from > to)
    ) {
      setError('Revisa el período clínico antes de exportar.');
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    try {
      const history = await getClinicalHistoryExport(patientId, {
        from,
        to,
        episodeId: String(data?.get('episodeId') ?? ''),
        versions: data?.get('versions') === 'CURRENT' ? 'CURRENT' : 'ALL',
      });
      await exportClinicalHistoryPdf(
        history,
        data?.get('grouping') === 'EPISODE' ? 'EPISODE' : 'DATE',
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo generar el PDF. No se descargó un archivo parcial.',
      );
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void generate(event.currentTarget);
  }
  return (
    <section className={styles.panel} aria-busy={busy}>
      <header>
        <h2>Exportar historia clínica</h2>
        <ContextHelp title="Alcance del PDF" compact>
          <p>
            Estos controles son independientes de la búsqueda superior. El PDF declara si contiene
            toda la historia o una selección. Nunca depende de las páginas cargadas.
          </p>
          <p>
            Los originales citados se conservan aunque queden fuera del período; no se incluye texto
            documental sin validar. El contexto longitudinal y la trazabilidad de episodios se
            conservan como antecedentes, con sus fechas y responsables. Las imágenes adjuntas se
            incluyen; si alguna no puede recuperarse, se detiene la exportación.
          </p>
          <p>
            El índice del PDF permite saltar a sus secciones. Los episodios se cargan desde el
            selector superior; usa «Cargar más» allí si no encuentras uno.
          </p>
        </ContextHelp>
      </header>
      <p>
        Exporta todo o define una selección explícita. La confirmación clínica interna no equivale a
        una firma digital certificada.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className={`${styles.fields} ${styles.fieldset}`}>
          <legend>Alcance y organización</legend>
          <label>
            Desde
            <input name="from" type="date" />
          </label>
          <label>
            Hasta
            <input name="to" type="date" />
          </label>
          <label>
            Episodio
            <select name="episodeId">
              <option value="">Todos</option>
              {episodes.map((episode) => (
                <option key={episode.id} value={episode.id}>
                  {episode.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Versiones
            <select name="versions">
              <option value="ALL">Todas, con estados e historial</option>
              <option value="CURRENT">Vigentes y documentos validados</option>
            </select>
          </label>
          <label>
            Orden
            <select name="grouping">
              <option value="DATE">Cronológico</option>
              <option value="EPISODE">Por episodio y fecha</option>
            </select>
          </label>
        </fieldset>
        <div className={styles.actions}>
          <button type="submit" disabled={busy}>
            Exportar con este alcance
          </button>
          <button type="button" disabled={busy} onClick={() => void generate()}>
            Exportar todo, sin filtros
          </button>
        </div>
      </form>
      {busy && <p role="status">Preparando el PDF completo del alcance solicitado…</p>}
      {error && (
        <div ref={errorRef} tabIndex={-1}>
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </section>
  );
}

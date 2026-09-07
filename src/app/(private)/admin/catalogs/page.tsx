'use client';
import { useState, type FormEvent } from 'react';
import { PageShell } from '@/shared/components/page-shell';
import { RequirePermissions } from '@/shared/guards/require-permissions';
import { apiPatch, apiPost } from '@/shared/services/api-client';
import type { components } from '@/shared/types/api.generated';
import { ContextHelp } from '@/shared/ui/context-help';
import { Alert } from '@/shared/ui';
import { useClinicalPage } from '@/features/clinical-records/hooks/use-clinical-page';
import { ClinicalPageControls } from '@/features/clinical-records/components/clinical-page-controls';
import styles from '@/features/clinical-records/components/clinical-workflow.module.css';
type Entry = components['schemas']['CatalogEntryDto'];

function CatalogEditor({ entry, onSaved }: { entry?: Entry; onSaved: () => Promise<void> }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(true); setError('');
    try {
      const name = String(data.get('name')).trim();
      if (entry) await apiPatch(`/clinical-catalogs/${entry.id}`, { expectedVersion: entry.version, name, isActive: data.get('active') === 'on' });
      else await apiPost('/clinical-catalogs', { kind: String(data.get('kind')), code: String(data.get('code')).trim(), name });
      form.reset(); await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar. Recarga el catálogo y revisa posibles duplicados.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={(event) => void save(event)}><fieldset disabled={busy} className={styles.fieldset}><legend>{entry ? `Editar ${entry.code}` : 'Nueva opción'}</legend>
    {!entry && <div className={styles.fields}><label>Tipo<select name="kind"><option value="SERVICE">Servicio</option><option value="SPECIALTY">Especialidad</option></select></label><label>Código estable<input name="code" required pattern="[A-Z0-9_\-]{2,40}" maxLength={40} placeholder="CONS_EXT" /><span>2–40 letras mayúsculas, números, guion o guion bajo.</span></label></div>}
    <label>Nombre<input name="name" required minLength={2} maxLength={120} defaultValue={entry?.name} /></label>
    {entry && <label className={styles.check}><input name="active" type="checkbox" defaultChecked={entry.isActive} />Disponible en sugerencias de los formularios</label>}
    <p>Desactivar o renombrar una opción no cambia las atenciones ni documentos ya guardados.</p>
    <button type="submit">{busy ? 'Guardando…' : 'Guardar opción'}</button>
  </fieldset>{error && <Alert variant="error">{error}</Alert>}</form>;
}
function CatalogWorkspace() {
  const [kind, setKind] = useState(''); const [status, setStatus] = useState('ALL'); const [query, setQuery] = useState('');
  const entries = useClinicalPage<Entry>(`/clinical-catalogs?status=${status}${kind ? `&kind=${kind}` : ''}&q=${encodeURIComponent(query)}`, 'opciones');
  return <PageShell><section className={styles.panel}><header><h1>Catálogos clínicos</h1><ContextHelp title="Servicios y especialidades" compact><p>Las opciones se comparten entre los formularios. Servicio describe dónde se presta la atención; especialidad identifica el área profesional. No se reinterpretan automáticamente los valores históricos.</p><p>El código y el tipo son estables. Puedes renombrar o desactivar; los registros conservan su texto original. La auditoría identifica quién hizo el cambio.</p></ContextHelp></header>
    <details><summary>Agregar servicio o especialidad</summary><CatalogEditor onSaved={entries.reload} /></details>
    <div className={styles.fields}><label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">Todos</option><option value="SERVICE">Servicios</option><option value="SPECIALTY">Especialidades</option></select></label><label>Disponibilidad<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Todas</option><option value="ACTIVE">Activas</option><option value="INACTIVE">Inactivas</option></select></label></div>
    <form onSubmit={(event) => { event.preventDefault(); setQuery(String(new FormData(event.currentTarget).get('q')).trim()); }}><label>Buscar nombre o código<input name="q" type="search" maxLength={120} /></label><button type="submit">Buscar en todo el catálogo</button></form>
    <ClinicalPageControls state={entries} resource="opciones" />
    {entries.total === 0 && <p>No hay opciones que coincidan con los filtros.</p>}
    {entries.items.map((entry) => <article key={`${entry.id}-${entry.version}`} className={styles.panel}><header><h2>{entry.name}</h2><span>{entry.isActive ? 'Activa' : 'Inactiva'}</span></header><p>{entry.kind === 'SERVICE' ? 'Servicio' : 'Especialidad'} · {entry.code}</p><details><summary>Editar o cambiar disponibilidad</summary><CatalogEditor entry={entry} onSaved={entries.reload} /></details></article>)}
  </section></PageShell>;
}
export default function CatalogsPage() { return <RequirePermissions allOf={['catalogs.manage']}><CatalogWorkspace /></RequirePermissions>; }

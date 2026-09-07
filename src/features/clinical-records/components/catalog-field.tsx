'use client';
import { useEffect, useState } from 'react';
import type { components } from '@/shared/types/api.generated';
import { useClinicalPage } from '../hooks/use-clinical-page';
import styles from './catalog-field.module.css';

/** La etiqueta histórica es una instantánea: renombrar el catálogo no la reescribe. */
export function CatalogField({ id, kind, value, onChange, disabled, className, errorId, invalid, maxLength = 120 }: { id: string; kind: 'SERVICE' | 'SPECIALTY'; value: string; onChange: (value: string) => void; disabled?: boolean; className?: string; errorId?: string; invalid?: boolean; maxLength?: number }) {
  const [query, setQuery] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setQuery(value), 300); return () => clearTimeout(timer); }, [value]);
  const catalog = useClinicalPage<components['schemas']['CatalogEntryDto']>(`/clinical-catalogs?kind=${kind}&q=${encodeURIComponent(query.slice(0, 120))}`, 'opciones del catálogo');
  return <>
    <input id={id} list={`${id}-options`} className={className} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} maxLength={maxLength} autoComplete="off" aria-invalid={invalid} aria-describedby={[`${id}-catalog-help`, errorId].filter(Boolean).join(' ')} />
    <datalist id={`${id}-options`}>{catalog.items.map((entry) => <option key={entry.id} value={entry.name}>{entry.code}</option>)}</datalist>
    <p className={styles.help} id={`${id}-catalog-help`}>Escribe para buscar opciones institucionales. Puedes conservar el texto del original si no figura en el catálogo.</p>
    {catalog.error && <p role="status">Catálogo no disponible; el texto escrito se conserva. <button type="button" disabled={disabled || catalog.loading} onClick={() => void catalog.reload()}>Reintentar catálogo</button></p>}
    {catalog.hasMore && <button type="button" disabled={disabled || catalog.loading} onClick={() => void catalog.loadMore()}>Cargar más opciones ({catalog.items.length} de {catalog.total})</button>}
  </>;
}

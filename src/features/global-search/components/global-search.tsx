'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { formatInstant } from '@/shared/lib/date-time';
import { can } from '@/shared/permissions/can';
import { Icon } from '@/shared/ui';
import { useGlobalSearch } from '../hooks/use-global-search';
import type {
  GlobalDocumentSearchResult,
  GlobalPatientSearchResult,
} from '../types/global-search';
import styles from './global-search.module.css';

interface GlobalSearchProps {
  permissions: string[];
}

interface SearchOption {
  key: string;
  href: string;
  kind: 'patient' | 'document';
  patient?: GlobalPatientSearchResult;
  document?: GlobalDocumentSearchResult;
}

const STATUS_LABEL: Record<GlobalDocumentSearchResult['status'], string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  PROCESSED: 'Por revisar',
  FAILED: 'Error de OCR',
  VALIDATED: 'Validado',
  REJECTED: 'Rechazado',
};

export function GlobalSearch({ permissions }: GlobalSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const reactId = useId().replace(/:/g, '');
  const listboxId = `global-search-results-${reactId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const canReadPatients = can(permissions, 'patients.read');
  const canReadDocuments = can(permissions, 'documents.read');
  const canSearch = canReadPatients || canReadDocuments;
  const normalizedQuery = query.trim();
  const { results, isLoading, error, retry } = useGlobalSearch(normalizedQuery, isOpen && canSearch);

  const options = useMemo<SearchOption[]>(() => [
    ...(results?.patients.data ?? []).map((patient) => ({
      key: `patient-${patient.id}`,
      kind: 'patient' as const,
      href: `/patients/${patient.id}`,
      patient,
    })),
    ...(results?.documents.data ?? []).map((document) => ({
      key: `document-${document.id}`,
      kind: 'document' as const,
      href: `/patients/${document.patientId}/documents/${document.id}`,
      document,
    })),
  ], [results]);

  useEffect(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, [pathname]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, options.length - 1));
  }, [options.length]);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeIndex, listboxId]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey)
        && event.key.toLowerCase() === 'k'
        && !document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')
      ) {
        event.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  if (!canSearch) return null;

  const showPanel = isOpen && normalizedQuery.length >= 2;
  const hasResults = options.length > 0;
  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;
  const liveMessage = isLoading
    ? 'Buscando…'
    : error
      ? error
      : results
        ? `${options.length} resultado${options.length === 1 ? '' : 's'} disponible${options.length === 1 ? '' : 's'}.`
        : '';

  function navigate(option: SearchOption) {
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(option.href);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const option = activeIndex >= 0 ? options[activeIndex] : options[0];
    if (option) {
      navigate(option);
    } else if (canReadPatients && normalizedQuery.length >= 2 && !isLoading) {
      setIsOpen(false);
      router.push(`/patients?q=${encodeURIComponent(normalizedQuery)}`);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'ArrowDown' && options.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % options.length);
    }
    if (event.key === 'ArrowUp' && options.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
    }
  }

  let optionIndex = -1;

  return (
    <div className={styles.root} ref={rootRef}>
      <form className={styles.form} role="search" onSubmit={handleSubmit}>
        <span className={styles.searchIcon} aria-hidden="true">
          <Icon name="search" size={17} />
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          role="combobox"
          placeholder={
            canReadPatients && canReadDocuments
              ? 'Buscar pacientes o documentos'
              : canReadPatients
                ? 'Buscar pacientes'
                : 'Buscar documentos'
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          aria-label="Busqueda global"
          aria-keyshortcuts="Control+K Meta+K"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showPanel}
          aria-activedescendant={activeOptionId}
        />
        {isLoading ? (
          <span className={styles.loadingMark} aria-hidden="true" />
        ) : (
          <kbd className={styles.kbd} aria-hidden="true">Ctrl K</kbd>
        )}
      </form>

      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </span>

      {showPanel && (
        <section className={styles.panel} aria-label="Resultados de busqueda">
          {error ? (
            <div className={styles.feedback} role="alert">
              <Icon name="alert" size={18} />
              <div>
                <strong>No pudimos completar la busqueda</strong>
                <span>Comprueba la conexion e intenta nuevamente.</span>
                <button className={styles.retryButton} type="button" onClick={retry}>
                  Reintentar
                </button>
              </div>
            </div>
          ) : !isLoading && results && !hasResults ? (
            <div className={styles.feedback}>
              <Icon name="search" size={18} />
              <div>
                <strong>Sin coincidencias para “{normalizedQuery}”</strong>
                <span>Prueba con un apellido, numero de documento o nombre de archivo.</span>
              </div>
            </div>
          ) : (
            <div id={listboxId} role="listbox" aria-label="Coincidencias de busqueda">
              {results && results.patients.data.length > 0 && (
                <div role="group" aria-labelledby={`${listboxId}-patients`}>
                  <div className={styles.groupHeading} id={`${listboxId}-patients`}>
                    <span>Pacientes</span>
                    {results.patients.hasMore && <small>Mas coincidencias disponibles</small>}
                  </div>
                  {results.patients.data.map((patient) => {
                    optionIndex += 1;
                    const index = optionIndex;
                    const selected = index === activeIndex;
                    return (
                      <Link
                        id={`${listboxId}-option-${index}`}
                        key={patient.id}
                        role="option"
                        aria-selected={selected}
                        className={`${styles.option} ${selected ? styles.optionActive : ''}`}
                        href={`/patients/${patient.id}`}
                        onPointerMove={() => setActiveIndex(index)}
                        onClick={() => setIsOpen(false)}
                      >
                        <span className={styles.optionIcon} aria-hidden="true"><Icon name="patient" size={17} /></span>
                        <span className={styles.optionBody}>
                          <strong>{patient.lastName}, {patient.firstName}</strong>
                          <span>{patient.documentType} {patient.documentNumber}</span>
                        </span>
                        <Icon name="chevron-right" size={15} />
                      </Link>
                    );
                  })}
                </div>
              )}

              {results && results.documents.data.length > 0 && (
                <div role="group" aria-labelledby={`${listboxId}-documents`}>
                  <div className={styles.groupHeading} id={`${listboxId}-documents`}>
                    <span>Documentos</span>
                    {results.documents.hasMore && <small>Mas coincidencias disponibles</small>}
                  </div>
                  {results.documents.data.map((documentResult) => {
                    optionIndex += 1;
                    const index = optionIndex;
                    const selected = index === activeIndex;
                    return (
                      <Link
                        id={`${listboxId}-option-${index}`}
                        key={documentResult.id}
                        role="option"
                        aria-selected={selected}
                        className={`${styles.option} ${selected ? styles.optionActive : ''}`}
                        href={`/patients/${documentResult.patientId}/documents/${documentResult.id}`}
                        onPointerMove={() => setActiveIndex(index)}
                        onClick={() => setIsOpen(false)}
                      >
                        <span className={`${styles.optionIcon} ${styles.documentIcon}`} aria-hidden="true">
                          <Icon name="document" size={17} />
                        </span>
                        <span className={styles.optionBody}>
                          <strong>{documentResult.originalName}</strong>
                          <span>
                            {documentResult.patient
                              ? `${documentResult.patient.lastName}, ${documentResult.patient.firstName} · `
                              : ''}
                            {STATUS_LABEL[documentResult.status]} · {formatInstant(documentResult.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          {documentResult.snippet && <small>{documentResult.snippet}</small>}
                        </span>
                        <Icon name="chevron-right" size={15} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isLoading && !results && (
            <div className={styles.feedback} aria-hidden="true">
              <span className={styles.loadingMark} />
              <div><strong>Buscando coincidencias…</strong></div>
            </div>
          )}

          {hasResults && (
            <footer className={styles.footer}>
              <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
              <span><kbd>Enter</kbd> abrir</span>
              <span><kbd>Esc</kbd> cerrar</span>
            </footer>
          )}
        </section>
      )}
    </div>
  );
}

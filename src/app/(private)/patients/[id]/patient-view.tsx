'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { activatePatient, getClinicalHistoryExport, usePatient } from '@/features/patients';
import type { ClinicalRecord } from '@/features/clinical-records';
import { RecordDetailsView } from '@/features/clinical-records/components/record-details-view';
import { RecordAttachmentsGallery } from '@/features/clinical-records/components/record-attachments-gallery';
import {
  getRecordDetailsPresentation,
  getRecordDetailsSearchText,
  recordDetailsIncludeValue,
  type RecordDetailsSection,
} from '@/features/clinical-records/lib/record-details-presentation';
import { getRecordTypeDefinition } from '@/features/clinical-records/lib/record-type-definitions';
import { RequiredAttachmentResolutionError } from '@/features/clinical-records/lib/record-attachments-presentation';
import type { MedicalDocument, NerEntity } from '@/features/medical-documents';
import { parseClinicalSections } from '@/features/medical-documents';
import {
  clinicalHistoryDocumentToExportItem,
  documentToExportItem,
  exportPatientPdf,
  recordToExportItem,
  type ExportItem,
} from '@/features/medical-documents/lib/pdf-export';
import { can } from '@/shared/permissions/can';
import { PageShell } from '@/shared/components/page-shell';
import { ageFromDateOnly, formatDateOnly, formatInstant } from '@/shared/lib/date-time';
import { Alert, Icon, Spinner } from '@/shared/ui';
import { usePatientOverview } from './use-patient-overview';
import styles from './patient-profile.module.css';

/* ─── Helpers ────────────────────────────────────────────────── */

const SEX_LABEL: Record<string, string> = { M: 'Masculino', F: 'Femenino', OTHER: 'Otro' };
const DOC_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  PROCESSED: 'En corrección',
  FAILED: 'Error OCR',
  VALIDATED: 'Validado',
  REJECTED: 'Rechazado',
};
const DOC_STATUS_TONE: Record<string, string> = {
  PENDING: 'slate',
  PROCESSING: 'amber',
  PROCESSED: 'amber',
  FAILED: 'red',
  VALIDATED: 'green',
  REJECTED: 'red',
};
function formatDate(iso: string): string {
  return formatInstant(iso, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateLong(iso: string): string {
  return formatDateOnly(iso, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

/** Entrada unificada del timeline (documento digitalizado o registro manual). */
interface TimelineEntry {
  id: string;
  kind: 'document' | 'record';
  date: string;
  title: string;
  statusLabel: string;
  statusTone: string;
  service: string;
  href: string | null;
  searchText: string;
  document?: MedicalDocument;
  record?: ClinicalRecord;
  recordDetails?: RecordDetailsSection[];
}

function buildTimeline(
  patientId: string,
  documents: MedicalDocument[],
  records: ClinicalRecord[],
): TimelineEntry[] {
  const docEntries: TimelineEntry[] = documents.map((doc) => ({
    id: `doc-${doc.id}`,
    kind: 'document',
    date: doc.createdAt,
    title: doc.originalName,
    statusLabel: DOC_STATUS_LABEL[doc.status] ?? doc.status,
    statusTone: DOC_STATUS_TONE[doc.status] ?? 'slate',
    service: 'Digitalización · Archivo clínico',
    href: `/patients/${patientId}/documents/${doc.id}`,
    searchText: [doc.originalName, doc.correctedText ?? '', doc.ocrText ?? '']
      .join('\n')
      .toLowerCase(),
    document: doc,
  }));

  const recordEntries: TimelineEntry[] = records.map((record) => {
    const recordDetails = getRecordDetailsPresentation(record.recordType, record.details);
    return {
      id: `rec-${record.id}`,
      kind: 'record',
      date: record.attendedAt,
      title: getRecordTypeDefinition(record.recordType).shortLabel,
      statusLabel:
        record.status === 'ACTIVE' ? 'Activo' : record.status === 'CORRECTED' ? 'Corregido' : 'Anulado',
      statusTone: record.status === 'ACTIVE' ? 'green' : record.status === 'CORRECTED' ? 'teal' : 'red',
      service:
        [record.professionalNameSnapshot ?? record.doctorName, record.service]
          .filter(Boolean)
          .join(' · ') ||
        (record.origin === 'DIGITIZED' ? 'Origen digitalizado' : 'Registro manual'),
      href: `/patients/${patientId}/records/${record.id}`,
      searchText: [
        record.summary,
        record.notes ?? '',
        getRecordDetailsSearchText(recordDetails),
      ]
        .join('\n')
        .toLocaleLowerCase('es-PE'),
      record,
      recordDetails,
    };
  });

  return [...docEntries, ...recordEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

function keyEntities(doc: MedicalDocument): NerEntity[] {
  const entities = doc.nerEntities ?? [];
  const priority = ['DIAGNOSIS', 'MEDICATION', 'PROCEDURE'];
  return entities
    .filter((entity) => priority.includes(entity.type))
    .slice(0, 4);
}

type TabId = 'resumen' | 'historia' | 'documentos' | 'metricas';

/* ─── Vista ──────────────────────────────────────────────────── */

interface PatientViewProps {
  id: string;
}

export function PatientView({ id }: PatientViewProps) {
  const { user } = useSession();
  const router = useRouter();
  const { patient, isLoading, error } = usePatient(id);
  const overview = usePatientOverview(id);

  const [activeTab, setActiveTab] = useState<TabId>('resumen');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const timeline = useMemo(
    () => buildTimeline(id, overview.documents, overview.records),
    [id, overview.documents, overview.records],
  );

  const filteredTimeline = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return timeline;
    return timeline.filter((entry) => entry.searchText.includes(query));
  }, [timeline, searchQuery]);

  const metricsDocs = useMemo(
    () =>
      overview.documents
        .filter((doc) => doc.metrics && (doc.metrics.cer != null || doc.metrics.wer != null))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [overview.documents],
  );

  const entityFrequency = useMemo(() => {
    const counts = new Map<string, { value: string; type: string; count: number }>();
    for (const doc of overview.documents) {
      const entities = (doc.correctedEntities ?? doc.nerEntities ?? []) as Array<{
        type: string;
        value: string;
      }>;
      for (const entity of entities) {
        const key = `${entity.type}::${entity.value.toLowerCase()}`;
        const existing = counts.get(key);
        if (existing) existing.count += 1;
        else counts.set(key, { value: entity.value, type: entity.type, count: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [overview.documents]);

  if (!user) return null;

  if (isLoading) {
    return (
      <PageShell>
        <Spinner label="Cargando ficha del paciente…" />
      </PageShell>
    );
  }

  if (error || !patient) {
    return (
      <PageShell>
        <Alert variant="error">{error ?? 'Paciente no encontrado.'}</Alert>
      </PageShell>
    );
  }

  const permissions = user.permissions;
  const patientAge = ageFromDateOnly(patient.dateOfBirth);
  const pendingDocs = overview.documents.filter(
    (doc) => doc.status !== 'VALIDATED' && doc.status !== 'REJECTED',
  ).length;
  const lastEntry = timeline[0] ?? null;

  async function handleActivate() {
    setIsActivating(true);
    try {
      await activatePatient(id);
      window.location.reload();
    } catch {
      setIsActivating(false);
    }
  }

  async function runExport(
    items: ExportItem[],
    subtitle: string,
    fileName: string,
    orderDescription?: string,
  ) {
    if (!patient || items.length === 0) return;
    setIsExporting(true);
    setExportError(null);
    try {
      await exportPatientPdf({ patient, items, subtitle, fileName, orderDescription });
    } catch (cause) {
      setExportError(
        cause instanceof RequiredAttachmentResolutionError
          ? cause.message
          : 'No se pudo generar el PDF. Inténtalo nuevamente.',
      );
    } finally {
      setIsExporting(false);
    }
  }

  function exportSingle(doc: MedicalDocument) {
    void runExport(
      [documentToExportItem(doc)],
      'Documento clínico digitalizado',
      `clinicview_${patient?.id.slice(0, 8)}_${doc.id.slice(0, 8)}`,
      'fecha indicada corresponde a la carga',
    );
  }

  function exportSelected() {
    const docs = overview.documents.filter((doc) => selectedDocs.has(doc.id));
    const items = docs
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(documentToExportItem);
    void runExport(
      items,
      `Documentos seleccionados (${items.length})`,
      `clinicview_${patient?.id.slice(0, 8)}_seleccion`,
      'orden por fecha de carga',
    );
  }

  async function exportFullHistory() {
    if (!patient) return;

    setIsExporting(true);
    setExportError(null);
    let history: Awaited<ReturnType<typeof getClinicalHistoryExport>>;
    try {
      history = await getClinicalHistoryExport(id);
    } catch {
      setExportError(
        'No se pudo obtener la historia clínica completa. No se generó ningún archivo.',
      );
      setIsExporting(false);
      return;
    }

    try {
      const items = [
        ...history.documents.map((document) => ({
          date: document.createdAt,
          createdAt: document.createdAt,
          kind: 'document' as const,
          id: document.id,
          item: clinicalHistoryDocumentToExportItem(document),
        })),
        ...history.records.map((record) => ({
          date: record.attendedAt,
          createdAt: record.createdAt,
          kind: 'record' as const,
          id: record.id,
          item: recordToExportItem(record),
        })),
      ]
        .sort(
          (a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime() ||
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
            a.kind.localeCompare(b.kind) ||
            a.id.localeCompare(b.id),
        )
        .map((entry) => entry.item);

      if (items.length === 0) {
        setExportError('Este paciente todavía no tiene entradas clínicas para exportar.');
        return;
      }

      await exportPatientPdf({
        patient: history.patient,
        items,
        subtitle: 'Historia clínica completa',
        fileName: `clinicview_${history.patient.id.slice(0, 8)}_historia_completa`,
        generatedAt: history.generatedAt,
        orderDescription: 'orden por fecha de atención o de carga, según el tipo de entrada',
      });
    } catch (cause) {
      setExportError(
        cause instanceof RequiredAttachmentResolutionError
          ? cause.message
          : 'La historia se obtuvo, pero no se pudo generar el PDF. Inténtalo nuevamente.',
      );
    } finally {
      setIsExporting(false);
    }
  }

  function toggleDocSelection(docId: string) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedDocs((prev) =>
      prev.size === overview.documents.length
        ? new Set()
        : new Set(overview.documents.map((doc) => doc.id)),
    );
  }

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'historia', label: 'Historia clínica' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'metricas', label: 'Métricas' },
  ];

  function openTab(tabId: TabId, focusPanel = false) {
    setActiveTab(tabId);
    if (focusPanel) {
      requestAnimationFrame(() => document.getElementById(`patient-panel-${tabId}`)?.focus());
    }
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % TABS.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = TABS[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab.id);
    requestAnimationFrame(() => document.getElementById(`patient-tab-${nextTab.id}`)?.focus());
  }

  return (
    <PageShell>
      {/* ─── Header del paciente ─── */}
      <section className={styles.headerCard}>
        <div className={styles.headerTop}>
          <span className={styles.avatar} aria-hidden="true">
            {getInitials(patient.firstName, patient.lastName)}
          </span>
          <div className={styles.headerInfo}>
            <h1 className={styles.patientName}>
              {patient.lastName}, {patient.firstName}
            </h1>
            <div className={styles.badgeRow}>
              <span className={styles.docBadge}>
                {patient.documentType} <strong>{patient.documentNumber}</strong>
              </span>
              <span className={`${styles.stateBadge} ${patient.isActive ? styles.badge_green : styles.badge_red}`}>
                <Icon name={patient.isActive ? 'check' : 'close'} size={13} />
                {patient.isActive ? 'Paciente activo' : 'Paciente inactivo'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.demoGrid}>
          <div className={styles.demoItem}>
            <Icon name="calendar" size={17} />
            <div>
              <span className={styles.demoLabel}>Fecha de nacimiento</span>
              <span className={styles.demoValue}>
                {formatDateLong(patient.dateOfBirth)}
                {patientAge === null ? '' : ` (${patientAge} años)`}
              </span>
            </div>
          </div>
          <div className={styles.demoItem}>
            <Icon name="patient" size={17} />
            <div>
              <span className={styles.demoLabel}>Sexo</span>
              <span className={styles.demoValue}>{SEX_LABEL[patient.sex]}</span>
            </div>
          </div>
          <div className={styles.demoItem}>
            <Icon name="phone" size={17} />
            <div>
              <span className={styles.demoLabel}>Teléfono</span>
              <span className={styles.demoValue}>{patient.phone ?? '—'}</span>
            </div>
          </div>
          <div className={styles.demoItem}>
            <Icon name="mail" size={17} />
            <div>
              <span className={styles.demoLabel}>Correo electrónico</span>
              <span className={styles.demoValue}>{patient.email ?? '—'}</span>
            </div>
          </div>
          <div className={styles.demoItem}>
            <Icon name="location" size={17} />
            <div>
              <span className={styles.demoLabel}>Dirección</span>
              <span className={styles.demoValue}>{patient.address ?? '—'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Banner de paciente inactivo ─── */}
      {!patient.isActive && (
        <div className={styles.inactiveBanner} role="alert">
          <div>
            <p className={styles.inactiveBannerTitle}>Este paciente está desactivado.</p>
            <p className={styles.inactiveBannerText}>
              Su historia clínica se conserva por trazabilidad, pero no aparece en las
              listas ni admite nuevas digitalizaciones.
            </p>
          </div>
          {can(permissions, 'patients.update') && (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              type="button"
              onClick={() => void handleActivate()}
              disabled={isActivating}
            >
              {isActivating ? 'Reactivando…' : 'Reactivar paciente'}
            </button>
          )}
        </div>
      )}

      {/* ─── Cards resumen ─── */}
      <section className={styles.summaryGrid} aria-label="Resumen del paciente">
        <article className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.sIcon_blue}`}>
            <Icon name="calendar" size={20} />
          </span>
          <div>
            <span className={styles.summaryLabel}>Última atención</span>
            <span className={styles.summaryValue}>
              {lastEntry ? formatDate(lastEntry.date) : '—'}
            </span>
            <span className={styles.summaryHint}>{lastEntry?.title ?? 'Sin registros'}</span>
          </div>
        </article>
        <article className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.sIcon_green}`}>
            <Icon name="folder" size={20} />
          </span>
          <div>
            <span className={styles.summaryLabel}>Documentos clínicos</span>
            <span className={styles.summaryValue}>
              {overview.documents.length + overview.records.length}
            </span>
            <span className={styles.summaryHint}>Historias y documentos</span>
          </div>
        </article>
        <article className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.sIcon_indigo}`}>
            <Icon name="scan" size={20} />
          </span>
          <div>
            <span className={styles.summaryLabel}>Digitalizaciones</span>
            <span className={styles.summaryValue}>{overview.documents.length}</span>
            <span className={styles.summaryHint}>Archivos digitalizados</span>
          </div>
        </article>
        <article className={styles.summaryCard}>
          <span className={`${styles.summaryIcon} ${styles.sIcon_amber}`}>
            <Icon name="clock" size={20} />
          </span>
          <div>
            <span className={styles.summaryLabel}>Pendientes</span>
            <span className={styles.summaryValue}>{pendingDocs}</span>
            <span className={styles.summaryHint}>Por revisar / completar</span>
          </div>
        </article>
      </section>

      {/* ─── Tabs ─── */}
      <div className={styles.tabs} role="tablist" aria-label="Secciones de la ficha del paciente">
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={`patient-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            aria-controls={activeTab === tab.id ? `patient-panel-${tab.id}` : undefined}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => openTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {overview.error && <Alert variant="error">{overview.error}</Alert>}
      {exportError && <Alert variant="error">{exportError}</Alert>}

      {/* ─── Tab: Resumen ─── */}
      {activeTab === 'resumen' && (
        <div
          id="patient-panel-resumen"
          className={styles.resumenGrid}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby="patient-tab-resumen"
        >
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Documentación clínica reciente</h2>
              <button className={styles.panelLink} type="button" onClick={() => openTab('historia', true)}>
                Ver todos <Icon name="chevron-right" size={13} />
              </button>
            </div>
            {overview.isLoading ? (
              <Spinner label="Cargando documentación…" />
            ) : timeline.length === 0 ? (
              <p className={styles.emptyHint}>Sin documentación clínica registrada todavía.</p>
            ) : (
              <table className={styles.recentTable}>
                <caption className={styles.visuallyHidden}>Documentación clínica reciente</caption>
                <thead>
                  <tr>
                    <th scope="col">Documento</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Servicio</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.slice(0, 6).map((entry) => (
                    <tr key={entry.id}>
                      <td data-label="Documento">
                        {entry.href ? (
                          <Link href={entry.href} className={styles.recentTitle}>
                            <span>{entry.title}</span>
                            <Icon name="chevron-right" size={15} />
                          </Link>
                        ) : (
                          <span className={styles.recentTitle}>{entry.title}</span>
                        )}
                        <span className={styles.recentCode}>
                          {entry.kind === 'document' ? 'DIG' : 'REG'}-{entry.id.slice(-8).toUpperCase()}
                        </span>
                      </td>
                      <td className={styles.cellMuted} data-label="Fecha">
                        <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                      </td>
                      <td className={styles.cellMuted} data-label="Servicio">{entry.service}</td>
                      <td data-label="Estado">
                        <span className={`${styles.stateBadge} ${styles[`badge_${entry.statusTone}`]}`}>
                          {entry.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className={styles.resumenSide}>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Acciones rápidas</h2>
              <div className={styles.quickActions}>
                {can(permissions, 'documents.read') && (
                  <Link href={`/patients/${id}/documents`} className={styles.quickAction}>
                    <span className={`${styles.quickActionIcon} ${styles.sIcon_blue}`}>
                      <Icon name="scan" size={18} />
                    </span>
                    <span>
                      <span className={styles.quickActionTitle}>Nueva digitalización</span>
                      <span className={styles.quickActionHint}>Digitaliza documentos</span>
                    </span>
                    <Icon name="chevron-right" size={15} />
                  </Link>
                )}
                {can(permissions, 'records.read') && (
                  <Link href={`/patients/${id}/records/new`} className={styles.quickAction}>
                    <span className={`${styles.quickActionIcon} ${styles.sIcon_green}`}>
                      <Icon name="records" size={18} />
                    </span>
                    <span>
                      <span className={styles.quickActionTitle}>Registrar atención</span>
                      <span className={styles.quickActionHint}>Nueva atención clínica</span>
                    </span>
                    <Icon name="chevron-right" size={15} />
                  </Link>
                )}
                {can(permissions, 'documents.upload') && (
                  <Link href={`/patients/${id}/documents`} className={styles.quickAction}>
                    <span className={`${styles.quickActionIcon} ${styles.sIcon_indigo}`}>
                      <Icon name="upload" size={18} />
                    </span>
                    <span>
                      <span className={styles.quickActionTitle}>Subir documento</span>
                      <span className={styles.quickActionHint}>Sube archivos clínicos</span>
                    </span>
                    <Icon name="chevron-right" size={15} />
                  </Link>
                )}
                <button
                  type="button"
                  className={styles.quickAction}
                  onClick={() => openTab('historia', true)}
                >
                  <span className={`${styles.quickActionIcon} ${styles.sIcon_amber}`}>
                    <Icon name="folder" size={18} />
                  </span>
                  <span>
                    <span className={styles.quickActionTitle}>Ver historia clínica</span>
                    <span className={styles.quickActionHint}>Timeline completo</span>
                  </span>
                  <Icon name="chevron-right" size={15} />
                </button>
              </div>
            </section>

            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Última actividad</h2>
              {timeline.length === 0 ? (
                <p className={styles.emptyHint}>Sin actividad registrada.</p>
              ) : (
                <ul className={styles.miniTimeline}>
                  {timeline.slice(0, 4).map((entry) => (
                    <li key={`mini-${entry.id}`} className={styles.miniTimelineItem}>
                      <span
                        className={`${styles.miniDot} ${styles[`dot_${entry.statusTone}`]}`}
                        aria-hidden="true"
                      />
                      <div>
                        <p className={styles.miniTitle}>{entry.title}</p>
                        <p className={styles.miniMeta}>
                          {entry.service} · {formatDate(entry.date)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ─── Tab: Historia clínica ─── */}
      {activeTab === 'historia' && (
        <section
          id="patient-panel-historia"
          className={styles.panel}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby="patient-tab-historia"
        >
          <div className={styles.historiaToolbar}>
            <div className={styles.searchWrap}>
              <Icon name="search" size={16} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Buscar por palabras clave en el texto de los documentos…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Buscar en la historia clínica"
              />
            </div>
            <span className={styles.resultCount} aria-live="polite" aria-atomic="true">
              {filteredTimeline.length} {filteredTimeline.length === 1 ? 'entrada' : 'entradas'}
            </span>
          </div>

          {overview.isLoading ? (
            <Spinner label="Cargando historia…" />
          ) : filteredTimeline.length === 0 ? (
            <p className={styles.emptyHint}>
              {searchQuery
                ? 'Ninguna entrada coincide con la búsqueda.'
                : 'Sin entradas en la historia clínica.'}
            </p>
          ) : (
            <ol className={styles.timeline}>
              {filteredTimeline.map((entry) => {
                const text =
                  entry.document?.correctedText ?? entry.document?.ocrText ?? null;
                const parsed = text ? parseClinicalSections(text) : null;
                const entities = entry.document ? keyEntities(entry.document) : [];

                return (
                  <li key={entry.id} className={styles.timelineItem}>
                    <span
                      className={`${styles.timelineDot} ${styles[`dot_${entry.statusTone}`]}`}
                      aria-hidden="true"
                    />
                    <details className={styles.timelineCard}>
                      <summary className={styles.timelineSummary}>
                        <div className={styles.timelineHead}>
                          <span className={styles.timelineDate}>{formatDate(entry.date)}</span>
                          <span className={styles.timelineTitle}>{entry.title}</span>
                          <span className={styles.timelineService}>{entry.service}</span>
                        </div>
                        <div className={styles.timelineRight}>
                          {entities.length > 0 && (
                            <span className={styles.entityChips}>
                              {entities.map((entity, index) => (
                                <span key={index} className={styles.entityChip}>
                                  {entity.value}
                                </span>
                              ))}
                            </span>
                          )}
                          <span className={`${styles.stateBadge} ${styles[`badge_${entry.statusTone}`]}`}>
                            {entry.statusLabel}
                          </span>
                          <span className={styles.timelineToggle} aria-hidden="true">
                            <Icon name="chevron-right" size={15} />
                          </span>
                        </div>
                      </summary>

                      <div className={styles.timelineBody}>
                        {entry.kind === 'record' && entry.record && (
                          <>
                            <h3 className={styles.sectionHeading}>Resumen</h3>
                            <p className={styles.sectionText}>{entry.record.summary}</p>
                            {entry.recordDetails && entry.recordDetails.length > 0 && (
                              <div className={styles.typedRecordDetails}>
                                <RecordDetailsView
                                  sections={entry.recordDetails}
                                  headingLevel={3}
                                  variant="compact"
                                />
                              </div>
                            )}
                            <RecordAttachmentsGallery
                              recordType={entry.record.recordType}
                              attachments={entry.record.attachments ?? []}
                              headingLevel={3}
                              variant="compact"
                            />
                            {entry.record.notes &&
                              !recordDetailsIncludeValue(entry.recordDetails ?? [], entry.record.notes) && (
                              <>
                                <h3 className={styles.sectionHeading}>Notas</h3>
                                <p className={styles.sectionText}>{entry.record.notes}</p>
                              </>
                            )}
                          </>
                        )}

                        {entry.kind === 'document' && parsed && parsed.isStructured && (
                          <>
                            {parsed.sections.map((section, index) => (
                              <div key={index}>
                                <h3 className={styles.sectionHeading}>{section.title}</h3>
                                <p className={styles.sectionText}>
                                  {section.content.trim() || '—'}
                                </p>
                              </div>
                            ))}
                          </>
                        )}

                        {entry.kind === 'document' && parsed && !parsed.isStructured && (
                          <p className={styles.sectionText}>{text}</p>
                        )}

                        {entry.kind === 'document' && !text && (
                          <p className={styles.emptyHint}>
                            Documento aún sin texto OCR — pendiente de procesamiento.
                          </p>
                        )}

                        {entry.href && (
                          <Link href={entry.href} className={styles.timelineLink}>
                            Abrir {entry.kind === 'document' ? 'en corrección' : 'registro'}
                            <Icon name="arrow-right" size={14} />
                          </Link>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {/* ─── Tab: Documentos ─── */}
      {activeTab === 'documentos' && (
        <section
          id="patient-panel-documentos"
          className={styles.panel}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby="patient-tab-documentos"
        >
          <div className={styles.docsToolbar}>
            <label className={styles.selectAll}>
              <input
                type="checkbox"
                checked={selectedDocs.size === overview.documents.length && overview.documents.length > 0}
                onChange={toggleSelectAll}
                aria-label="Seleccionar todos los documentos"
              />
              Seleccionar todos
            </label>
            <div className={styles.docsToolbarActions}>
              <button
                className={styles.btn}
                type="button"
                onClick={exportSelected}
                disabled={selectedDocs.size === 0 || isExporting}
              >
                <Icon name="export" size={15} />
                Exportar seleccionados ({selectedDocs.size})
              </button>
              {can(permissions, 'records.read') && can(permissions, 'documents.read') && (
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  type="button"
                  onClick={() => void exportFullHistory()}
                  disabled={isExporting}
                >
                  <Icon name="download" size={15} />
                  {isExporting ? 'Generando PDF…' : 'Exportar historia completa'}
                </button>
              )}
            </div>
          </div>

          {overview.isLoading ? (
            <Spinner label="Cargando documentos…" />
          ) : overview.documents.length === 0 ? (
            <p className={styles.emptyHint}>
              Sin documentos digitalizados.{' '}
              {can(permissions, 'documents.upload') && (
                <Link href={`/patients/${id}/documents`}>Subir el primero</Link>
              )}
            </p>
          ) : (
            <table className={styles.docsTable}>
              <caption className={styles.visuallyHidden}>Documentos digitalizados del paciente</caption>
              <thead>
                <tr>
                  <th scope="col"><span className={styles.visuallyHidden}>Selección</span></th>
                  <th scope="col">Documento</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {overview.documents.map((doc) => (
                  <tr key={doc.id}>
                    <td data-label="Seleccionar">
                      <label className={styles.checkboxTarget}>
                        <input
                          type="checkbox"
                          checked={selectedDocs.has(doc.id)}
                          onChange={() => toggleDocSelection(doc.id)}
                        />
                        <span className={styles.visuallyHidden}>Seleccionar {doc.originalName}</span>
                      </label>
                    </td>
                    <td data-label="Documento">
                      <Link href={`/patients/${id}/documents/${doc.id}`} className={styles.docLink}>
                        <Icon name="document" size={16} />
                        {doc.originalName}
                      </Link>
                    </td>
                    <td className={styles.cellMuted} data-label="Fecha">
                      <time dateTime={doc.createdAt}>{formatDate(doc.createdAt)}</time>
                    </td>
                    <td data-label="Estado">
                      <span className={`${styles.stateBadge} ${styles[`badge_${DOC_STATUS_TONE[doc.status]}`]}`}>
                        {DOC_STATUS_LABEL[doc.status]}
                      </span>
                    </td>
                    <td data-label="Acciones">
                      <button
                        className={styles.btnSmall}
                        type="button"
                        onClick={() => exportSingle(doc)}
                        disabled={isExporting}
                      >
                        <Icon name="export" size={14} />
                        Exportar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ─── Tab: Métricas ─── */}
      {activeTab === 'metricas' && (
        <div
          id="patient-panel-metricas"
          className={styles.metricsGrid}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby="patient-tab-metricas"
        >
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Evolución CER / WER por documento</h2>
            {metricsDocs.length === 0 ? (
              <p className={styles.emptyHint}>
                Sin métricas disponibles todavía. Se registran cuando los documentos se
                procesan con el motor IA v2 (TrOCR).
              </p>
            ) : (
              <MetricsChart documents={metricsDocs} />
            )}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Entidades más frecuentes</h2>
            {entityFrequency.length === 0 ? (
              <p className={styles.emptyHint}>Sin entidades clínicas detectadas todavía.</p>
            ) : (
              <ul className={styles.freqList}>
                {entityFrequency.map((item, index) => {
                  const max = entityFrequency[0].count;
                  return (
                    <li key={index} className={styles.freqItem}>
                      <span className={styles.freqValue}>{item.value}</span>
                      <span className={styles.freqBarTrack}>
                        <span
                          className={styles.freqBar}
                          style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
                        />
                      </span>
                      <span className={styles.freqCount}>{item.count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ─── Acciones del paciente ─── */}
      {/* La desactivación vive en Editar paciente → Zona de peligro,
          para evitar clics accidentales desde el perfil. */}
      <div className={styles.footerActions}>
        <button className={styles.btn} type="button" onClick={() => router.back()}>
          ‹ Volver
        </button>
        {can(permissions, 'patients.update') && patient.isActive && (
          <button
            className={styles.btn}
            type="button"
            onClick={() => router.push(`/patients/${id}/edit`)}
          >
            <Icon name="edit" size={15} />
            Editar paciente
          </button>
        )}
      </div>
    </PageShell>
  );
}

/* ─── Gráfico SVG de CER/WER ─────────────────────────────────── */

function MetricsChart({ documents }: { documents: MedicalDocument[] }) {
  const width = 560;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 34, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const points = documents.map((doc, index) => ({
    x: documents.length === 1 ? 0.5 : index / (documents.length - 1),
    cer: doc.metrics?.cer ?? null,
    wer: doc.metrics?.wer ?? null,
    label: formatDate(doc.createdAt),
  }));

  const maxValue = Math.max(
    0.1,
    ...points.flatMap((point) => [point.cer ?? 0, point.wer ?? 0]),
  );

  function toX(x: number): number {
    return padding.left + x * innerW;
  }
  function toY(value: number): number {
    return padding.top + innerH - (value / maxValue) * innerH;
  }

  function linePath(key: 'cer' | 'wer'): string {
    return points
      .filter((point) => point[key] != null)
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(point.x).toFixed(1)} ${toY(point[key] as number).toFixed(1)}`)
      .join(' ');
  }

  const gridValues = [0, maxValue / 2, maxValue];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Evolución de CER y WER por documento"
        style={{ width: '100%', height: 'auto' }}
      >
        {gridValues.map((value, index) => (
          <g key={index}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={toY(value)}
              y2={toY(value)}
              stroke="var(--gray-200)"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={toY(value) + 3}
              textAnchor="end"
              fontSize="10"
              fill="var(--gray-400)"
            >
              {(value * 100).toFixed(0)}%
            </text>
          </g>
        ))}

        <path d={linePath('cer')} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
        <path d={linePath('wer')} fill="none" stroke="var(--color-warning)" strokeWidth="2.5" />

        {points.map((point, index) => (
          <g key={index}>
            {point.cer != null && (
              <circle cx={toX(point.x)} cy={toY(point.cer)} r="3.5" fill="var(--color-primary)" />
            )}
            {point.wer != null && (
              <circle cx={toX(point.x)} cy={toY(point.wer)} r="3.5" fill="var(--color-warning)" />
            )}
            <text
              x={toX(point.x)}
              y={height - 12}
              textAnchor="middle"
              fontSize="9"
              fill="var(--gray-400)"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: 'var(--color-primary)' }} aria-hidden="true" />
          CER (error de carácter)
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: 'var(--color-warning)' }} aria-hidden="true" />
          WER (error de palabra)
        </span>
      </div>
      <details className={styles.metricDetails}>
        <summary>Ver datos del gráfico en tabla</summary>
        <div
          className={styles.metricDataWrap}
          role="region"
          aria-label="Datos CER y WER por documento"
          tabIndex={0}
        >
          <table className={styles.metricDataTable}>
            <caption className={styles.visuallyHidden}>Valores CER y WER por documento</caption>
            <thead>
              <tr>
                <th scope="col">Documento</th>
                <th scope="col">Fecha</th>
                <th scope="col">CER</th>
                <th scope="col">WER</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <th scope="row">{document.originalName}</th>
                  <td><time dateTime={document.createdAt}>{formatDate(document.createdAt)}</time></td>
                  <td>{document.metrics?.cer == null ? '—' : `${(document.metrics.cer * 100).toFixed(2)}%`}</td>
                  <td>{document.metrics?.wer == null ? '—' : `${(document.metrics.wer * 100).toFixed(2)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { can } from '@/shared/permissions/can';
import { Spinner, EmptyState, Alert, StatusBadge } from '@/shared/ui';
import type { RecordStatus, RecordType } from '../types/record';
import { useRecords } from '../hooks/use-records';
import styles from './record-list.module.css';


const TYPE_SHORT: Record<RecordType, string> = {
  CONSULTATION: 'Consulta',
  LAB_RESULT: 'Lab.',
  PRESCRIPTION: 'Receta',
  THERAPY_NOTE: 'Terapia',
  EVOLUTION: 'Evolución',
  PROCEDURE: 'Procedimiento',
  OTHER: 'Otro',
};

const STATUS_LABEL: Record<RecordStatus, string> = {
  ACTIVE: 'Activo',
  CORRECTED: 'Corregido',
  VOIDED: 'Anulado',
};

const ALL_STATUSES: RecordStatus[] = ['ACTIVE', 'CORRECTED', 'VOIDED'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

interface RecordListProps {
  patientId: string;
  permissions: string[];
}

export function RecordList({ patientId, permissions }: RecordListProps) {
  const {
    data, total, page, totalPages, statusFilter,
    isLoading, error, onPageChange, onStatusFilterChange,
  } = useRecords(patientId);

  const router = useRouter();

  return (
    <div>
      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={statusFilter ?? ''}
          onChange={(e) => onStatusFilterChange((e.target.value as RecordStatus) || undefined)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>

        {can(permissions, 'records.create') && (
          <button
            className={styles.newBtn}
            onClick={() => router.push(`/patients/${patientId}/records/new`)}
          >
            + Registrar atención
          </button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className={styles.tableWrap}>
        {isLoading ? (
          <Spinner label="Cargando registros…" />
        ) : data.length === 0 ? (
          <EmptyState
            icon="records"
            title={statusFilter ? 'Sin registros con ese estado' : 'Sin registros manuales de atención'}
            description={
              statusFilter
                ? 'Prueba con otro filtro.'
                : 'Registra la primera atención clínica manual de este paciente.'
            }
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tipo de registro manual</th>
                <th>Resumen</th>
                <th>Fecha de atención</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/patients/${patientId}/records/${r.id}`)}
                >
                  <td>
                    <span className={styles.recordType}>{TYPE_SHORT[r.recordType]}</span>
                  </td>
                  <td>
                    <span className={styles.summary}>{r.summary}</span>
                  </td>
                  <td>{formatDate(r.attendedAt)}</td>
                  <td>
                    <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isLoading && total > 0 && (
        <div className={styles.pagination}>
          <span>
            {total} registro{total !== 1 ? 's' : ''} — página {page} de {totalPages}
          </span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
              Anterior
            </button>
            <button className={styles.pageBtn} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { can } from '@/shared/permissions/can';
import { Spinner, EmptyState, Alert } from '@/shared/ui';
import { usePatients } from '../hooks/use-patients';
import styles from './patient-list.module.css';

const SEX_LABEL: Record<string, string> = { M: 'Masc.', F: 'Fem.', OTHER: 'Otro' };
const DOC_LABEL: Record<string, string> = { DNI: 'DNI', CE: 'CE', PAS: 'PAS', OTHER: 'Otro' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

interface PatientListProps {
  permissions: string[];
}

export function PatientList({ permissions }: PatientListProps) {
  const { data, total, page, totalPages, search, isLoading, error, onSearchChange, onPageChange } =
    usePatients();
  const router = useRouter();

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar por nombre o número de documento…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar pacientes"
        />
        {can(permissions, 'patients.create') && (
          <button className={styles.newBtn} onClick={() => router.push('/patients/new')}>
            + Registrar paciente
          </button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className={styles.tableWrap}>
        {isLoading ? (
          <Spinner label="Cargando pacientes…" />
        ) : data.length === 0 ? (
          <EmptyState
            icon="patient"
            title={search ? 'Sin resultados' : 'No hay pacientes registrados'}
            description={
              search
                ? 'Ningún paciente coincide con la búsqueda. Intenta con otro nombre o documento.'
                : 'Registra el primer paciente usando el botón superior.'
            }
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Documento</th>
                <th>Fecha de nacimiento</th>
                <th>Sexo</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} onClick={() => router.push(`/patients/${p.id}`)}>
                  <td>
                    <span className={styles.patientName}>
                      {p.lastName}, {p.firstName}
                    </span>
                  </td>
                  <td>
                    <span className={styles.docBadge}>{DOC_LABEL[p.documentType]}</span>
                    {p.documentNumber}
                  </td>
                  <td>{formatDate(p.dateOfBirth)}</td>
                  <td>{SEX_LABEL[p.sex]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isLoading && total > 0 && (
        <div className={styles.pagination}>
          <span>
            {total} paciente{total !== 1 ? 's' : ''} — página {page} de {totalPages}
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

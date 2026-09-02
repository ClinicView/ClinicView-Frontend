'use client';

import { useRouter } from 'next/navigation';
import { can } from '@/shared/permissions/can';
import { Spinner, EmptyState, Alert, Icon } from '@/shared/ui';
import { usePatients } from '../hooks/use-patients';
import styles from './patient-list.module.css';

const SEX_LABEL: Record<string, string> = { M: 'Masculino', F: 'Femenino', OTHER: 'Otro' };
const DOC_LABEL: Record<string, string> = { DNI: 'DNI', CE: 'CE', PAS: 'PAS', OTHER: 'Otro' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || 'PX';
}

interface PatientListProps {
  permissions: string[];
  initialSearch?: string;
}

export function PatientList({ permissions, initialSearch }: PatientListProps) {
  const { data, total, page, totalPages, search, isLoading, error, onSearchChange, onPageChange } =
    usePatients(initialSearch ?? '');
  const router = useRouter();

  function openPatient(id: string) {
    router.push(`/patients/${id}`);
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.searchField}>
          <span className={styles.searchIcon} aria-hidden="true">
            <Icon name="search" size={17} />
          </span>
          <input
            className={styles.search}
            type="search"
            placeholder="Buscar por nombre o documento"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Buscar pacientes"
          />
        </div>

        {can(permissions, 'patients.create') && (
          <button
            type="button"
            className={styles.newBtn}
            onClick={() => router.push('/patients/new')}
          >
            <Icon name="patient" size={17} />
            Registrar paciente
          </button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className={styles.tableWrap}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <Spinner label="Cargando pacientes…" />
          </div>
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
                <th scope="col">Paciente</th>
                <th scope="col">Documento</th>
                <th scope="col">Nacimiento</th>
                <th scope="col">Sexo</th>
                <th scope="col" aria-label="Abrir ficha" />
              </tr>
            </thead>
            <tbody>
              {data.map((patient) => {
                const patientName = `${patient.lastName}, ${patient.firstName}`;
                return (
                  <tr
                    key={patient.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Abrir ficha de ${patient.firstName} ${patient.lastName}`}
                    onClick={() => openPatient(patient.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') openPatient(patient.id);
                    }}
                  >
                    <td className={styles.patientCell} data-label="Paciente">
                      <span className={styles.patientAvatar} aria-hidden="true">
                        {getInitials(patient.firstName, patient.lastName)}
                      </span>
                      <span className={styles.patientIdentity}>
                        <span className={styles.patientName}>{patientName}</span>
                        <span className={`${styles.patientStatus} ${patient.isActive ? styles.active : styles.inactive}`}>
                          <i aria-hidden="true" /> {patient.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </span>
                    </td>
                    <td data-label="Documento">
                      <span className={styles.docBadge}>{DOC_LABEL[patient.documentType]}</span>
                      <span className={styles.documentNumber}>{patient.documentNumber}</span>
                    </td>
                    <td data-label="Nacimiento">
                      <time dateTime={patient.dateOfBirth}>{formatDate(patient.dateOfBirth)}</time>
                    </td>
                    <td data-label="Sexo">{SEX_LABEL[patient.sex]}</td>
                    <td className={styles.arrowCell} aria-hidden="true">
                      <span><Icon name="chevron-right" size={15} /></span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!isLoading && total > 0 && (
        <div className={styles.pagination}>
          <span>
            {total} paciente{total !== 1 ? 's' : ''} · Página {page} de {totalPages}
          </span>
          <div className={styles.paginationBtns}>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

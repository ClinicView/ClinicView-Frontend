'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateOnly } from '@/shared/lib/date-time';
import { can } from '@/shared/permissions/can';
import { Icon } from '@/shared/ui';
import { deactivatePatient } from '../services/patients.service';
import type { Patient } from '../types/patient';
import styles from './patient-detail.module.css';

const SEX_LABEL: Record<string, string> = { M: 'Masculino', F: 'Femenino', OTHER: 'Otro' };
const DOC_LABEL: Record<string, string> = {
  DNI: 'DNI',
  CE: 'Carné de Extranjería',
  PAS: 'Pasaporte',
  OTHER: 'Otro',
};

interface PatientDetailProps {
  patient: Patient;
  permissions: string[];
}

export function PatientDetail({ patient, permissions }: PatientDetailProps) {
  const router = useRouter();
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  async function handleDeactivate() {
    setIsDeactivating(true);
    setDeactivateError(null);
    try {
      await deactivatePatient(patient.id);
      router.replace('/patients');
    } catch (err) {
      setDeactivateError(err instanceof Error ? err.message : 'Error al desactivar el paciente.');
      setIsDeactivating(false);
      setConfirmDeactivate(false);
      requestAnimationFrame(() => {
        document.getElementById('deactivate-patient')?.focus();
      });
    }
  }

  function requestDeactivate() {
    setConfirmDeactivate(true);
    requestAnimationFrame(() => {
      document.getElementById('confirm-deactivate-patient')?.focus();
    });
  }

  function cancelDeactivate() {
    setConfirmDeactivate(false);
    requestAnimationFrame(() => {
      document.getElementById('deactivate-patient')?.focus();
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.name}>
            {patient.lastName}, {patient.firstName}
            {!patient.isActive && <span className={styles.inactiveBadge}>Inactivo</span>}
          </h1>
          <p className={styles.docLine}>
            <span className={styles.docBadge}>{DOC_LABEL[patient.documentType]}</span>
            {patient.documentNumber}
          </p>
        </div>
      </div>

      <dl className={styles.grid}>
        <div className={styles.field}>
          <dt className={styles.fieldLabel}>Fecha de nacimiento</dt>
          <dd className={styles.fieldValue}>
            {formatDateOnly(patient.dateOfBirth, {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </dd>
        </div>
        <div className={styles.field}>
          <dt className={styles.fieldLabel}>Sexo</dt>
          <dd className={styles.fieldValue}>{SEX_LABEL[patient.sex]}</dd>
        </div>
        <div className={styles.field}>
          <dt className={styles.fieldLabel}>Teléfono</dt>
          <dd className={`${styles.fieldValue} ${!patient.phone ? styles.empty : ''}`}>
            {patient.phone ?? '-'}
          </dd>
        </div>
        <div className={styles.field}>
          <dt className={styles.fieldLabel}>Correo electrónico</dt>
          <dd className={`${styles.fieldValue} ${!patient.email ? styles.empty : ''}`}>
            {patient.email ?? '-'}
          </dd>
        </div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <dt className={styles.fieldLabel}>Dirección</dt>
          <dd className={`${styles.fieldValue} ${!patient.address ? styles.empty : ''}`}>
            {patient.address ?? '-'}
          </dd>
        </div>
      </dl>

      {(can(permissions, 'documents.read') || can(permissions, 'records.read')) && (
        <>
          <hr className={styles.divider} />
          <div className={styles.flowActions}>
            {can(permissions, 'documents.read') && (
              <button
                type="button"
                className={styles.primaryFlow}
                onClick={() => router.push(`/patients/${patient.id}/documents`)}
              >
                <span className={styles.flowIcon} aria-hidden="true">
                  <Icon name="scan" size={22} />
                </span>
                <span className={styles.flowEyebrow}>Flujo principal</span>
                <span className={styles.flowTitle}>Digitalizar historia clínica</span>
                <span className={styles.flowText}>
                  Sube documentos físicos, ejecuta digitalización y corrige el texto reconocido.
                </span>
              </button>
            )}

            {can(permissions, 'records.read') && (
              <button
                type="button"
                className={styles.secondaryFlow}
                onClick={() => router.push(`/patients/${patient.id}/records`)}
              >
                <span className={styles.flowIcon} aria-hidden="true">
                  <Icon name="records" size={20} />
                </span>
                <span className={styles.flowTitle}>Registro manual de atención</span>
                <span className={styles.flowText}>
                  Consulta o crea historias clínicas estructuradas ingresadas manualmente.
                </span>
              </button>
            )}
          </div>
          {can(permissions, 'documents.read') && (
            <div className={styles.helpCard}>
              <Icon name="document" size={18} />
              <span>
                Usa esta opción para subir historias clínicas escaneadas o fotografiadas, procesarlas y corregir el texto reconocido.
              </span>
            </div>
          )}
        </>
      )}

      <hr className={styles.divider} />

      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => router.back()}>
          Volver
        </button>

        {can(permissions, 'patients.update') && patient.isActive && (
          <button
            type="button"
            className={styles.btn}
            onClick={() => router.push(`/patients/${patient.id}/edit`)}
          >
            Editar paciente
          </button>
        )}

        {can(permissions, 'patients.update') && patient.isActive && !confirmDeactivate && (
          <button
            id="deactivate-patient"
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={requestDeactivate}
          >
            Desactivar
          </button>
        )}

        {confirmDeactivate && (
          <>
            <button
              id="confirm-deactivate-patient"
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => void handleDeactivate()}
              disabled={isDeactivating}
            >
              {isDeactivating ? 'Desactivando...' : 'Confirmar desactivación'}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={cancelDeactivate}
              disabled={isDeactivating}
            >
              Cancelar
            </button>
          </>
        )}
      </div>

      {deactivateError && <p className={styles.error} role="alert">{deactivateError}</p>}
    </div>
  );
}

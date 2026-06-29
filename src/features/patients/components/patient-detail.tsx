'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

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
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.name}>
            {patient.lastName}, {patient.firstName}
            {!patient.isActive && <span className={styles.inactiveBadge}>Inactivo</span>}
          </p>
          <p className={styles.docLine}>
            <span className={styles.docBadge}>{DOC_LABEL[patient.documentType]}</span>
            {patient.documentNumber}
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Fecha de nacimiento</span>
          <span className={styles.fieldValue}>{formatDate(patient.dateOfBirth)}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Sexo</span>
          <span className={styles.fieldValue}>{SEX_LABEL[patient.sex]}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Teléfono</span>
          <span className={`${styles.fieldValue} ${!patient.phone ? styles.empty : ''}`}>
            {patient.phone ?? '-'}
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Correo electrónico</span>
          <span className={`${styles.fieldValue} ${!patient.email ? styles.empty : ''}`}>
            {patient.email ?? '-'}
          </span>
        </div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.fieldLabel}>Dirección</span>
          <span className={`${styles.fieldValue} ${!patient.address ? styles.empty : ''}`}>
            {patient.address ?? '-'}
          </span>
        </div>
      </div>

      {(can(permissions, 'documents.read') || can(permissions, 'records.read')) && (
        <>
          <hr className={styles.divider} />
          <div className={styles.flowActions}>
            {can(permissions, 'documents.read') && (
              <button
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
        <button className={styles.btn} onClick={() => router.back()}>
          Volver
        </button>

        {can(permissions, 'patients.update') && patient.isActive && (
          <button
            className={styles.btn}
            onClick={() => router.push(`/patients/${patient.id}/edit`)}
          >
            Editar paciente
          </button>
        )}

        {can(permissions, 'patients.update') && patient.isActive && !confirmDeactivate && (
          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => setConfirmDeactivate(true)}
          >
            Desactivar
          </button>
        )}

        {confirmDeactivate && (
          <>
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => void handleDeactivate()}
              disabled={isDeactivating}
            >
              {isDeactivating ? 'Desactivando...' : 'Confirmar desactivación'}
            </button>
            <button
              className={styles.btn}
              onClick={() => setConfirmDeactivate(false)}
              disabled={isDeactivating}
            >
              Cancelar
            </button>
          </>
        )}
      </div>

      {deactivateError && <p className={styles.error}>{deactivateError}</p>}
    </div>
  );
}

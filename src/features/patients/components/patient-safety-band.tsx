'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPatient } from '../services/patients.service';
import { getClinicalSummary } from '../services/clinical-summary.service';
import type { Patient } from '../types/patient';
import type { ClinicalSummary } from '../types/clinical-summary';
import { ageFromDateOnly, formatDateOnly } from '@/shared/lib/date-time';
import styles from './clinical-summary.module.css';

export function PatientSafetyBand({
  patientId,
  canReadClinical,
}: {
  patientId: string;
  canReadClinical: boolean;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [summary, setSummary] = useState<ClinicalSummary | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('clinicview:patient-updated', refresh);
    return () =>
      window.removeEventListener('clinicview:patient-updated', refresh);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setPatient(null);
    setSummary(null);
    setError(false);
    void getPatient(patientId)
      .then((result) => {
        if (!cancelled) setPatient(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    if (canReadClinical)
      void getClinicalSummary(patientId)
        .then((result) => {
          if (!cancelled) setSummary(result);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    return () => {
      cancelled = true;
    };
  }, [patientId, canReadClinical, revision]);
  return (
    <aside
      className={styles.band}
      aria-label="Identificación y seguridad del paciente"
    >
      {patient ? (
        <>
          <div className={styles.identity}>
            <Link href={`/patients/${patientId}`}>
              <strong>
                {patient.lastName}, {patient.firstName}
              </strong>
            </Link>
            <span>
              {patient.documentType} {patient.documentNumber} · HC{' '}
              {patient.medicalRecordNumber || 'sin asignar'}
            </span>
            <span>
              {formatDateOnly(patient.dateOfBirth)} ·{' '}
              {ageFromDateOnly(patient.dateOfBirth) ?? '—'} años ·{' '}
              {{ M: 'Masculino', F: 'Femenino', OTHER: 'Otro' }[patient.sex]}
              {!patient.isActive && ' · INACTIVO'}
            </span>
          </div>
          {canReadClinical && (
            <div className={styles.safety}>
              <strong
                className={
                  summary?.payload.allergyStatus === 'RECORDED'
                    ? styles.warning
                    : ''
                }
              >
                {summary
                  ? summary.payload.allergyStatus === 'UNKNOWN'
                    ? 'Alergias: por verificar'
                    : summary.payload.allergyStatus === 'NONE_KNOWN'
                      ? 'Sin alergias conocidas (declarado)'
                      : `Alergias (${summary.payload.allergies.length}): ${summary.payload.allergies.slice(0, 3).map((item) => item.name).join(', ')}${summary.payload.allergies.length > 3 ? ' · Hay más; revisar la lista completa' : ''}`
                  : 'Alergias: información no disponible'}
              </strong>
              {summary && (
                <span>
                  Problemas activos:{' '}
                  {summary.payload.problemStatus === 'UNKNOWN'
                    ? 'por verificar'
                    : summary.payload.problems.filter(
                        (p) => p.status === 'ACTIVE',
                      ).length}{' '}
                  · Medicación activa:{' '}
                  {summary.payload.medicationStatus === 'UNKNOWN'
                    ? 'por verificar'
                    : summary.payload.medications.filter(
                        (m) => m.status === 'ACTIVE',
                      ).length}
                </span>
              )}
              <Link href={`/patients/${patientId}#clinical-summary`}>
                Ver información longitudinal
              </Link>
            </div>
          )}
        </>
      ) : (
        <span>
          {error
            ? 'No se pudo verificar la identidad del paciente.'
            : 'Verificando paciente…'}
        </span>
      )}
      {error && (
        <button
          type="button"
          className={styles.button}
          onClick={() => setRevision((v) => v + 1)}
        >
          Reintentar verificación
        </button>
      )}
    </aside>
  );
}

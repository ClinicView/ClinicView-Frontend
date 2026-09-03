export type {
  Patient,
  CreatePatientData,
  UpdatePatientData,
  PatientsPage,
  DocumentType,
  Sex,
  ClinicalHistoryExport,
  ClinicalHistoryExportDocument,
  ClinicalHistoryExportRecord,
  PatientRegistrationDraft,
  PatientRegistrationDraftPayload,
  SavePatientRegistrationDraftData,
} from './types/patient';
export {
  listPatients,
  getPatient,
  getClinicalHistoryExport,
  createPatient,
  updatePatient,
  deactivatePatient,
  activatePatient,
  getPatientStats,
  getCurrentPatientRegistrationDraft,
  saveCurrentPatientRegistrationDraft,
  deleteCurrentPatientRegistrationDraft,
} from './services/patients.service';
export type { PatientStats } from './services/patients.service';
export { usePatients } from './hooks/use-patients';
export { usePatient } from './hooks/use-patient';
export { PatientList } from './components/patient-list';
export { PatientForm } from './components/patient-form';
export { PatientDetail } from './components/patient-detail';
export { PatientEditForm } from './components/patient-edit-form';

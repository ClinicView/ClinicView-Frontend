import type {
  DocumentType,
  PatientRegistrationDraft,
  PatientRegistrationDraftPayload,
  SavePatientRegistrationDraftData,
  Sex,
} from '../types/patient';

export interface PatientRegistrationFormState {
  documentType: string;
  documentNumber: string;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  email: string;
  address: string;
}

export interface PatientRegistrationDraftGateway {
  save: (data: SavePatientRegistrationDraftData) => Promise<PatientRegistrationDraft>;
  remove: (draftId: string, expectedVersion: number) => Promise<void>;
}

const documentTypes = new Set<DocumentType>(['DNI', 'CE', 'PAS', 'OTHER']);
const sexes = new Set<Sex>(['M', 'F', 'OTHER']);

export function emptyPatientRegistrationForm(): PatientRegistrationFormState {
  return {
    documentType: '',
    documentNumber: '',
    lastName: '',
    firstName: '',
    dateOfBirth: '',
    sex: '',
    phone: '',
    email: '',
    address: '',
  };
}

export function formFromPatientRegistrationDraft(
  payload: PatientRegistrationDraftPayload,
): PatientRegistrationFormState {
  return {
    ...emptyPatientRegistrationForm(),
    ...payload,
  };
}

export function toPatientRegistrationDraftPayload(
  form: PatientRegistrationFormState,
): PatientRegistrationDraftPayload {
  return {
    ...(documentTypes.has(form.documentType as DocumentType)
      ? { documentType: form.documentType as DocumentType }
      : {}),
    ...(form.documentNumber ? { documentNumber: form.documentNumber } : {}),
    ...(form.firstName ? { firstName: form.firstName } : {}),
    ...(form.lastName ? { lastName: form.lastName } : {}),
    ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
    ...(sexes.has(form.sex as Sex) ? { sex: form.sex as Sex } : {}),
    ...(form.phone ? { phone: form.phone } : {}),
    ...(form.email ? { email: form.email } : {}),
    ...(form.address ? { address: form.address } : {}),
  };
}

export function hasMeaningfulPatientRegistrationData(
  form: PatientRegistrationFormState,
): boolean {
  return Object.values(form).some((value) => value.trim().length > 0);
}

export function patientRegistrationFormSignature(
  form: PatientRegistrationFormState,
): string {
  return JSON.stringify(form);
}

export function getPatientDraftValidationIssue(
  form: PatientRegistrationFormState,
): string | null {
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    return 'Completa o elimina el correo electrónico para guardar el borrador.';
  }
  return null;
}

/**
 * Serializa las mutaciones CAS y conserva siempre la última identidad confirmada
 * por el servidor. No almacena el contenido del formulario fuera de memoria.
 */
export class PatientRegistrationDraftMutationQueue {
  private currentDraft: PatientRegistrationDraft | null = null;
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(private readonly gateway: PatientRegistrationDraftGateway) {}

  replace(draft: PatientRegistrationDraft | null): void {
    this.currentDraft = draft;
  }

  current(): PatientRegistrationDraft | null {
    return this.currentDraft;
  }

  save(payload: PatientRegistrationDraftPayload): Promise<PatientRegistrationDraft> {
    const operation = this.mutationTail.then(async () => {
      const current = this.currentDraft;
      const saved = await this.gateway.save({
        ...(current
          ? { expectedId: current.id, expectedVersion: current.version }
          : {}),
        payload,
      });
      this.currentDraft = saved;
      return saved;
    });

    this.mutationTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  remove(): Promise<void> {
    const operation = this.mutationTail.then(async () => {
      const current = this.currentDraft;
      if (!current) return;
      await this.gateway.remove(current.id, current.version);
      this.currentDraft = null;
    });

    this.mutationTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  idle(): Promise<void> {
    return this.mutationTail;
  }
}

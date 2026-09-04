export interface GlobalPatientSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
}

export interface GlobalDocumentSearchResult {
  id: string;
  patientId: string;
  originalName: string;
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'VALIDATED' | 'REJECTED';
  createdAt: string;
  snippet: string | null;
  patient: { id: string; firstName: string; lastName: string } | null;
}

export interface GlobalSearchResponse {
  query: string;
  patients: { data: GlobalPatientSearchResult[]; hasMore: boolean };
  documents: { data: GlobalDocumentSearchResult[]; hasMore: boolean };
}

export type ActivityType = 'UPLOADED' | 'CORRECTED' | 'VALIDATED' | 'ERROR' | 'IN_QUEUE';

export interface DashboardActivity {
  id: string;
  type: ActivityType;
  title: string;
  patientName: string | null;
  patientCode: string | null;
  patientId: string | null;
  documentId: string | null;
  occurredAt: string;
}

export interface DashboardStats {
  patientsToday: number;
  patientsTodayDeltaPct: number | null;
  documentsInQueue: number;
  readyToValidate: number;
  readyToValidateDeltaPct: number | null;
  ocrErrors: number;
  ocrErrorsDeltaPct: number | null;
  recentActivity: DashboardActivity[];
}

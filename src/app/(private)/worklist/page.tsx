import { PendingClinicalWork } from '@/features/notifications/components/pending-clinical-work';
import { PageShell } from '@/shared/components/page-shell';
import { RequirePermissions } from '@/shared/guards/require-permissions';
export default function WorklistPage() {
  return <RequirePermissions allOf={['patients.read']} anyOf={['records.confirm', 'records.create', 'documents.validate']}><PageShell><h1>Mis tareas clínicas</h1><p>Una lista operativa personal; no reemplaza la historia clínica ni la bandeja general de revisión.</p><PendingClinicalWork /></PageShell></RequirePermissions>;
}

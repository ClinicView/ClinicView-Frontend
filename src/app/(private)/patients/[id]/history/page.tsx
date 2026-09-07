import { HistoryExplorer } from '@/features/patients/components/history-explorer';
import { RequirePermissions } from '@/shared/guards/require-permissions';
export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequirePermissions allOf={['patients.read']} anyOf={['records.read', 'documents.read']}><HistoryExplorer patientId={id} /></RequirePermissions>;
}

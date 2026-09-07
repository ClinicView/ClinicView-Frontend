import { EpisodesWorkspace } from '@/features/clinical-records/components/episodes-workspace';
import { RequirePermissions } from '@/shared/guards/require-permissions';
export default async function EpisodesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequirePermissions allOf={['patients.read', 'records.read']}><EpisodesWorkspace patientId={id} /></RequirePermissions>;
}

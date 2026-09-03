import { RecordView } from './record-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export default async function RecordPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;
  return (
    <RequirePermissions allOf={['records.read']}>
      <RecordView patientId={id} recordId={recordId} />
    </RequirePermissions>
  );
}

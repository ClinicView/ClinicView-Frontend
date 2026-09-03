import { NewRecordView } from './new-record-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export default async function NewRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequirePermissions allOf={['patients.read', 'records.read', 'records.create']}>
      <NewRecordView patientId={id} />
    </RequirePermissions>
  );
}

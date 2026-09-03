import { CorrectRecordView } from './correct-record-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export default async function CorrectRecordPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;
  return (
    <RequirePermissions allOf={['records.read', 'records.correct']}>
      <CorrectRecordView patientId={id} recordId={recordId} />
    </RequirePermissions>
  );
}

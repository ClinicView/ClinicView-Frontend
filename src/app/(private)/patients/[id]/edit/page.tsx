import { EditPatientView } from './edit-patient-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequirePermissions allOf={['patients.read', 'patients.update']}>
      <EditPatientView patientId={id} />
    </RequirePermissions>
  );
}

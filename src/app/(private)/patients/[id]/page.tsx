import { PatientView } from './patient-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export const metadata = { title: 'Detalle de paciente' };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermissions allOf={['patients.read']}>
      <PatientView id={id} />
    </RequirePermissions>
  );
}

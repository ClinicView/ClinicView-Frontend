import { NewPatientView } from './new-patient-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export const metadata = { title: 'Nuevo paciente' };

export default function NewPatientPage() {
  return (
    <RequirePermissions allOf={['patients.read', 'patients.create']}>
      <NewPatientView />
    </RequirePermissions>
  );
}

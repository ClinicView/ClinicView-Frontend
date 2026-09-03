import { PatientsView } from './patients-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export const metadata = { title: 'Pacientes' };

export default function PatientsPage() {
  return (
    <RequirePermissions allOf={['patients.read']}>
      <PatientsView />
    </RequirePermissions>
  );
}

import { RequirePermissions } from '@/shared/guards/require-permissions';
import { RolesView } from './roles-view';

export default function AdminRolesPage() {
  return (
    <RequirePermissions allOf={['roles.read']}>
      <RolesView />
    </RequirePermissions>
  );
}

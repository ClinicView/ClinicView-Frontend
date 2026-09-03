import { UsersView } from './users-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export default function AdminUsersPage() {
  return (
    <RequirePermissions allOf={['users.read']}>
      <UsersView />
    </RequirePermissions>
  );
}

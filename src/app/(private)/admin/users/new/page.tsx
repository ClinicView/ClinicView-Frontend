import { NewUserView } from './new-user-view';
import { RequirePermissions } from '@/shared/guards/require-permissions';

export default function NewUserPage() {
  return (
    <RequirePermissions allOf={['users.read', 'users.create', 'roles.read']}>
      <NewUserView />
    </RequirePermissions>
  );
}

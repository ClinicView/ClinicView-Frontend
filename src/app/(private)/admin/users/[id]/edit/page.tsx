import { RequirePermissions } from '@/shared/guards/require-permissions';
import { EditUserView } from './edit-user-view';

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequirePermissions
      allOf={['users.read']}
      anyOf={['users.update', 'admin.users.manage']}
    >
      <EditUserView userId={id} />
    </RequirePermissions>
  );
}

import type { components } from '@/shared/types/api.generated';

export type AdminRole = components['schemas']['RoleResponseDto'];
export type AdminPermission = components['schemas']['PermissionResponseDto'];
type GeneratedAdminUser = components['schemas']['UserResponseDto'];
export type AdminUser = Omit<
  GeneratedAdminUser,
  'documentType' | 'documentNumber' | 'profession' | 'lastLoginAt'
> &
  Required<
    Pick<
      GeneratedAdminUser,
      'documentType' | 'documentNumber' | 'profession' | 'lastLoginAt'
    >
  >;
export type AdminUserRole = components['schemas']['UserRoleSummaryDto'];

export type CreateAdminUserData = components['schemas']['CreateUserDto'];
export type UpdateAdminUserData = components['schemas']['UpdateUserDto'];
export type CreateAdminRoleData = components['schemas']['CreateRoleDto'];
export type UpdateAdminRoleData = Omit<
  components['schemas']['UpdateRoleDto'],
  'expectedUpdatedAt'
>;

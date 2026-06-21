import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../types/enums.js';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict endpoint access to specific roles (RBAC-001).
 * @example @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 */
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, roles);

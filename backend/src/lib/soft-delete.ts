/**
 * F48 Soft Delete Helpers (DATA-003)
 * Soft deletion preferred for entities referenced by competition or financial history.
 * Entities are never physically removed — only status-deactivated.
 */

/**
 * Prisma `where` clause fragment to filter out soft-deleted records.
 * Use in all queries that should exclude deleted entities.
 *
 * @example
 * const players = await prisma.player.findMany({
 *   where: { ...notDeleted, status: 'active' },
 * });
 */
export const notDeleted = { isDeleted: false } as const;

/**
 * Prisma `data` clause fragment for soft-deleting a record.
 *
 * @example
 * await prisma.player.update({
 *   where: { id },
 *   data: { ...softDelete },
 * });
 */
export const softDelete = {
  isDeleted: true,
  updatedAt: new Date(),
} as const;

/**
 * Type helper for entities that support soft deletion.
 */
export interface SoftDeletable {
  isDeleted: boolean;
}

/**
 * Check if an entity has been soft-deleted.
 */
export function isSoftDeleted(entity: SoftDeletable): boolean {
  return entity.isDeleted;
}

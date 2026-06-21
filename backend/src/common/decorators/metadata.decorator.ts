import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks an endpoint as public (no auth required). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const AUDIT_ACTION_KEY = 'auditAction';
/** Marks an endpoint for audit logging with a specific action name. */
export const AuditAction = (action: string) =>
  SetMetadata(AUDIT_ACTION_KEY, action);

export const ELEVATED_ACTION_KEY = 'elevatedAction';
/** Marks an endpoint requiring elevated admin confirmation (SEC-009). */
export const ElevatedAction = () => SetMetadata(ELEVATED_ACTION_KEY, true);

export const FEATURE_GATE_KEY = 'featureGate';
/** Gates an endpoint behind a feature flag (ADMIN-012). */
export const FeatureGate = (flagKey: string) =>
  SetMetadata(FEATURE_GATE_KEY, flagKey);

export const IDEMPOTENT_KEY = 'idempotent';
/** Marks an endpoint as supporting idempotency keys (ARCH-006). */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

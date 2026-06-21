/**
 * F48 Realtime Event Contracts (RT-002)
 *
 * All events include: eventType, entityType, entityId, version, timestamp.
 * Clients use these to invalidate/refetch the correct query.
 * Events are NOT a second database (RT-001).
 *
 * Established in Phase 0. Coverage grows per feature phase.
 */

// ── Base Event ──

export interface BaseEvent {
  eventType: string;
  entityType: string;
  entityId: string;
  version: number;
  timestamp: string; // ISO 8601, UTC (ARCH-007)
  meta?: Record<string, unknown>;
}

// ── Phase 1: Identity Events ──

export interface OrganizerVerificationUpdated extends BaseEvent {
  eventType: 'organizer.verification.updated';
  entityType: 'organizer';
  payload: {
    previousStatus: string;
    newStatus: string;
  };
}

export interface PlayerFfBindingUpdated extends BaseEvent {
  eventType: 'player.ff_binding.updated';
  entityType: 'player';
  payload: {
    action: 'bound' | 'changed' | 'removed';
  };
}

// ── Phase 2: Tournament Events ──

export interface TournamentStatusChanged extends BaseEvent {
  eventType: 'tournament.status.changed';
  entityType: 'tournament';
  payload: {
    previousStatus: string;
    newStatus: string;
    tournamentName: string;
  };
}

export interface FundingRequestUpdated extends BaseEvent {
  eventType: 'funding.status.updated';
  entityType: 'funding_request';
  payload: {
    previousStatus: string;
    newStatus: string;
    tournamentId: string;
  };
}

// ── Phase 3: Registration Events ──

export interface RegistrationCountChanged extends BaseEvent {
  eventType: 'tournament.registration_count.changed';
  entityType: 'tournament';
  payload: {
    confirmedCount: number;
    maxRegistrations: number;
  };
}

export interface TeamInvitationUpdated extends BaseEvent {
  eventType: 'team.invitation.updated';
  entityType: 'registration';
  payload: {
    playerId: string;
    action: 'invited' | 'accepted' | 'declined' | 'removed';
  };
}

export interface CheckInStatusChanged extends BaseEvent {
  eventType: 'registration.checkin.changed';
  entityType: 'registration';
  payload: {
    isCheckedIn: boolean;
  };
}

export interface RoomCredentialsReleased extends BaseEvent {
  eventType: 'match.credentials.released';
  entityType: 'match';
  payload: {
    matchId: string;
    credentialVersion: number;
  };
}

export interface RoomCredentialsUpdated extends BaseEvent {
  eventType: 'match.credentials.updated';
  entityType: 'match';
  payload: {
    matchId: string;
    newVersion: number;
    isUrgent: boolean;
  };
}

// ── Phase 4: Result Events ──

export interface ResultPublished extends BaseEvent {
  eventType: 'match.result.published';
  entityType: 'match';
  payload: {
    matchId: string;
    resultVersion: number;
    status: string;
  };
}

export interface LeaderboardUpdated extends BaseEvent {
  eventType: 'tournament.leaderboard.updated';
  entityType: 'tournament';
  payload: {
    snapshotVersion: number;
    snapshotType: 'provisional' | 'final';
    triggerReason: string;
  };
}

// ── Phase 5: Dispute & Prize Events ──

export interface DisputeStatusChanged extends BaseEvent {
  eventType: 'dispute.status.changed';
  entityType: 'dispute';
  payload: {
    previousStatus: string;
    newStatus: string;
    tournamentId: string;
  };
}

export interface PrizePaid extends BaseEvent {
  eventType: 'prize.paid';
  entityType: 'prize_payout';
  payload: {
    tournamentId: string;
    playerId: string;
    amountPaise: string; // BigInt serialized as string
    rank: number;
  };
}

// ── Union Type ──

export type F48Event =
  | OrganizerVerificationUpdated
  | PlayerFfBindingUpdated
  | TournamentStatusChanged
  | FundingRequestUpdated
  | RegistrationCountChanged
  | TeamInvitationUpdated
  | CheckInStatusChanged
  | RoomCredentialsReleased
  | RoomCredentialsUpdated
  | ResultPublished
  | LeaderboardUpdated
  | DisputeStatusChanged
  | PrizePaid;

/** All possible event type strings */
export type F48EventType = F48Event['eventType'];

/**
 * Helper to create a base event with common fields filled.
 */
export function createBaseEvent(
  eventType: string,
  entityType: string,
  entityId: string,
  version: number,
  meta?: Record<string, unknown>,
): BaseEvent {
  return {
    eventType,
    entityType,
    entityId,
    version,
    timestamp: new Date().toISOString(),
    meta,
  };
}

/**
 * Tournament State Machine — 17 states, role-gated transitions.
 * Uses the generic StateMachine from src/lib/state-machine.ts.
 */
import { createStateMachine } from '../../lib/state-machine.js';

export type TournamentState =
  | 'draft' | 'submitted' | 'changes_required' | 'approved'
  | 'published' | 'registration_open' | 'registration_closed'
  | 'check_in' | 'live' | 'results_pending' | 'dispute_window'
  | 'results_final' | 'settlement' | 'completed'
  | 'canceled' | 'voided' | 'archived';

export type TournamentAction =
  | 'submit' | 'approve' | 'request_changes' | 'resubmit'
  | 'publish' | 'open_registration' | 'close_registration'
  | 'start_check_in' | 'go_live' | 'end_matches'
  | 'open_dispute_window' | 'finalize_results'
  | 'begin_settlement' | 'complete'
  | 'cancel' | 'void' | 'archive';

export const tournamentStateMachine = createStateMachine<TournamentState, TournamentAction>({
  transitions: {
    submit: {
      from: ['draft'],
      to: 'submitted',
      requiredRoles: ['organizer'],
    },
    approve: {
      from: ['submitted'],
      to: 'approved',
      requiredRoles: ['admin', 'super_admin'],
    },
    request_changes: {
      from: ['submitted'],
      to: 'changes_required',
      requiredRoles: ['admin', 'super_admin'],
      requiresReason: true,
    },
    resubmit: {
      from: ['changes_required'],
      to: 'submitted',
      requiredRoles: ['organizer'],
    },
    publish: {
      from: ['approved'],
      to: 'published',
      requiredRoles: ['organizer'],
    },
    open_registration: {
      from: ['published'],
      to: 'registration_open',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
    },
    close_registration: {
      from: ['registration_open'],
      to: 'registration_closed',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
    },
    start_check_in: {
      from: ['registration_closed'],
      to: 'check_in',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
    },
    go_live: {
      from: ['check_in'],
      to: 'live',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
    },
    end_matches: {
      from: ['live'],
      to: 'results_pending',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
    },
    open_dispute_window: {
      from: ['results_pending'],
      to: 'dispute_window',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
    },
    finalize_results: {
      from: ['dispute_window'],
      to: 'results_final',
      requiredRoles: ['admin', 'super_admin'],
    },
    begin_settlement: {
      from: ['results_final'],
      to: 'settlement',
      requiredRoles: ['admin', 'super_admin'],
    },
    complete: {
      from: ['settlement'],
      to: 'completed',
      requiredRoles: ['admin', 'super_admin'],
    },
    cancel: {
      from: ['draft', 'submitted', 'changes_required', 'approved', 'published',
             'registration_open', 'registration_closed'],
      to: 'canceled',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
      requiresReason: true,
    },
    void: {
      from: ['check_in', 'live', 'results_pending', 'dispute_window'],
      to: 'voided',
      requiredRoles: ['admin', 'super_admin'],
      requiresReason: true,
    },
    archive: {
      from: ['completed', 'canceled', 'voided'],
      to: 'archived',
      requiredRoles: ['admin', 'super_admin'],
    },
  },
});

/**
 * Tournament State Machine.
 * Organizers publish directly; F48 review states are not part of the product flow.
 */
import { createStateMachine } from '../../lib/state-machine.js';

export type TournamentState =
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'check_in'
  | 'live'
  | 'provisional_results'
  | 'dispute_window'
  | 'results_final'
  | 'completed'
  | 'canceled'
  | 'voided'
  | 'archived';

export type TournamentAction =
  | 'publish'
  | 'open_registration'
  | 'close_registration'
  | 'start_check_in'
  | 'go_live'
  | 'publish_provisional_results'
  | 'open_dispute_window'
  | 'finalize_results'
  | 'complete'
  | 'cancel'
  | 'void'
  | 'archive';

export const tournamentStateMachine = createStateMachine<
  TournamentState,
  TournamentAction
>({
  transitions: {
    publish: {
      from: ['draft'],
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
    publish_provisional_results: {
      from: ['live'],
      to: 'provisional_results',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
    },
    open_dispute_window: {
      from: ['provisional_results'],
      to: 'dispute_window',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
    },
    finalize_results: {
      from: ['dispute_window'],
      to: 'results_final',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
    },
    complete: {
      from: ['results_final'],
      to: 'completed',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
    },
    cancel: {
      from: ['draft', 'published', 'registration_open', 'registration_closed'],
      to: 'canceled',
      requiredRoles: ['organizer', 'admin', 'super_admin'],
      requiresReason: true,
    },
    void: {
      from: ['check_in', 'live', 'provisional_results', 'dispute_window'],
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

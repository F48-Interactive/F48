/**
 * F48 Generic Typed State Machine (LIFE-001)
 * Used for all 4 lifecycles: tournament (17), registration (11), funding (9), match (10).
 * Validates transitions with role checks and reason requirements.
 */

import type { UserRole } from '../types/enums.js';
import { ForbiddenError, BadRequestError } from './errors.js';

export interface TransitionDefinition<TState extends string> {
  /** States from which this action is allowed */
  from: TState[];
  /** Target state after transition */
  to: TState;
  /** Roles allowed to perform this action */
  requiredRoles?: UserRole[];
  /** Whether a reason string is mandatory (LIFE-002) */
  requiresReason?: boolean;
}

export interface StateMachineConfig<
  TState extends string,
  TAction extends string,
> {
  transitions: Record<TAction, TransitionDefinition<TState>>;
}

export interface TransitionContext {
  role: UserRole;
  reason?: string;
}

export class StateMachine<
  TState extends string,
  TAction extends string,
> {
  constructor(
    private readonly config: StateMachineConfig<TState, TAction>,
  ) {}

  /**
   * Check if a transition is valid without executing it.
   */
  canTransition(
    currentState: TState,
    action: TAction,
    role: UserRole,
  ): boolean {
    const transition = this.config.transitions[action];
    if (!transition) return false;
    if (!transition.from.includes(currentState)) return false;
    if (
      transition.requiredRoles &&
      !transition.requiredRoles.includes(role)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Execute a state transition. Throws if invalid.
   * @returns The new state
   */
  transition(
    currentState: TState,
    action: TAction,
    context: TransitionContext,
  ): TState {
    const transition = this.config.transitions[action];

    if (!transition) {
      throw new BadRequestError(
        'INVALID_ACTION',
        `Action '${action}' does not exist`,
        { action },
      );
    }

    if (!transition.from.includes(currentState)) {
      throw new BadRequestError(
        'INVALID_STATE_TRANSITION',
        `Cannot perform '${action}' from state '${currentState}'`,
        { currentState, action, allowedFrom: transition.from },
      );
    }

    if (
      transition.requiredRoles &&
      !transition.requiredRoles.includes(context.role)
    ) {
      throw new ForbiddenError(
        'INSUFFICIENT_ROLE',
        `Role '${context.role}' cannot perform '${action}'`,
        { action, requiredRoles: transition.requiredRoles },
      );
    }

    if (transition.requiresReason && !context.reason?.trim()) {
      throw new BadRequestError(
        'REASON_REQUIRED',
        `A reason is required for action '${action}'`,
        { action },
      );
    }

    return transition.to;
  }

  /**
   * Get all available actions for a given state and role.
   */
  getAvailableActions(currentState: TState, role: UserRole): TAction[] {
    const actions: TAction[] = [];

    for (const [action, transition] of Object.entries(this.config.transitions)) {
      const t = transition as TransitionDefinition<TState>;
      if (!t.from.includes(currentState)) continue;
      if (t.requiredRoles && !t.requiredRoles.includes(role)) continue;
      actions.push(action as TAction);
    }

    return actions;
  }

  /**
   * Get the target state for an action (without executing).
   */
  getTargetState(action: TAction): TState | undefined {
    return this.config.transitions[action]?.to;
  }
}

/**
 * Factory function to create a type-safe state machine.
 */
export function createStateMachine<
  TState extends string,
  TAction extends string,
>(config: StateMachineConfig<TState, TAction>): StateMachine<TState, TAction> {
  return new StateMachine(config);
}

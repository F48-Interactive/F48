import {
  createStateMachine,
  type StateMachineConfig,
} from '../../../src/lib/state-machine';

// Simple test state machine
type TestState = 'draft' | 'submitted' | 'approved' | 'rejected';
type TestAction = 'submit' | 'approve' | 'reject' | 'resubmit';

const testConfig: StateMachineConfig<TestState, TestAction> = {
  transitions: {
    submit: { from: ['draft'], to: 'submitted', requiredRoles: ['organizer'] },
    approve: {
      from: ['submitted'],
      to: 'approved',
      requiredRoles: ['admin', 'super_admin'],
    },
    reject: {
      from: ['submitted'],
      to: 'rejected',
      requiredRoles: ['admin', 'super_admin'],
      requiresReason: true,
    },
    resubmit: { from: ['rejected'], to: 'submitted', requiredRoles: ['organizer'] },
  },
};

describe('StateMachine', () => {
  const sm = createStateMachine(testConfig);

  describe('canTransition', () => {
    it('returns true for valid transitions', () => {
      expect(sm.canTransition('draft', 'submit', 'organizer')).toBe(true);
      expect(sm.canTransition('submitted', 'approve', 'admin')).toBe(true);
      expect(sm.canTransition('submitted', 'reject', 'super_admin')).toBe(true);
    });

    it('returns false for wrong state', () => {
      expect(sm.canTransition('approved', 'submit', 'organizer')).toBe(false);
      expect(sm.canTransition('draft', 'approve', 'admin')).toBe(false);
    });

    it('returns false for wrong role', () => {
      expect(sm.canTransition('submitted', 'approve', 'organizer')).toBe(false);
      expect(sm.canTransition('draft', 'submit', 'admin')).toBe(false);
    });

    it('returns false for non-existent action', () => {
      expect(
        sm.canTransition('draft', 'nonexistent' as TestAction, 'admin'),
      ).toBe(false);
    });
  });

  describe('transition', () => {
    it('transitions to the correct state', () => {
      const next = sm.transition('draft', 'submit', { role: 'organizer' });
      expect(next).toBe('submitted');
    });

    it('transitions through multiple states', () => {
      let state: TestState = 'draft';
      state = sm.transition(state, 'submit', { role: 'organizer' });
      expect(state).toBe('submitted');

      state = sm.transition(state, 'approve', { role: 'admin' });
      expect(state).toBe('approved');
    });

    it('throws for invalid state', () => {
      expect(() =>
        sm.transition('approved', 'submit', { role: 'organizer' }),
      ).toThrow("Cannot perform 'submit' from state 'approved'");
    });

    it('throws for wrong role', () => {
      expect(() =>
        sm.transition('submitted', 'approve', { role: 'organizer' }),
      ).toThrow("Role 'organizer' cannot perform 'approve'");
    });

    it('throws when reason is required but missing', () => {
      expect(() =>
        sm.transition('submitted', 'reject', { role: 'admin' }),
      ).toThrow("A reason is required for action 'reject'");
    });

    it('succeeds when reason is required and provided', () => {
      const next = sm.transition('submitted', 'reject', {
        role: 'admin',
        reason: 'Incomplete information',
      });
      expect(next).toBe('rejected');
    });

    it('allows resubmission after rejection', () => {
      const next = sm.transition('rejected', 'resubmit', {
        role: 'organizer',
      });
      expect(next).toBe('submitted');
    });
  });

  describe('getAvailableActions', () => {
    it('returns available actions for a state and role', () => {
      const actions = sm.getAvailableActions('submitted', 'admin');
      expect(actions).toContain('approve');
      expect(actions).toContain('reject');
      expect(actions).not.toContain('submit');
    });

    it('returns empty for terminal state', () => {
      const actions = sm.getAvailableActions('approved', 'admin');
      expect(actions).toHaveLength(0);
    });

    it('filters by role', () => {
      const actions = sm.getAvailableActions('submitted', 'organizer');
      expect(actions).toHaveLength(0); // organizer can't approve or reject
    });

    it('returns actions for draft', () => {
      const actions = sm.getAvailableActions('draft', 'organizer');
      expect(actions).toEqual(['submit']);
    });
  });

  describe('getTargetState', () => {
    it('returns the target state for an action', () => {
      expect(sm.getTargetState('submit')).toBe('submitted');
      expect(sm.getTargetState('approve')).toBe('approved');
    });

    it('returns undefined for non-existent action', () => {
      expect(
        sm.getTargetState('nonexistent' as TestAction),
      ).toBeUndefined();
    });
  });
});

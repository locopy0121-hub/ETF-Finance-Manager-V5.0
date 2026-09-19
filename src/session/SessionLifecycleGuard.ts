import type { EditingSessionState } from '../types/session';

const allowed: Readonly<Record<EditingSessionState, readonly EditingSessionState[]>> = {
  INITIALIZING: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['COMMITTING', 'CLOSED'],
  COMMITTING: ['ACTIVE', 'CLOSED', 'ERROR_LOCKED'],
  CLOSED: [],
  ERROR_LOCKED: ['CLOSED'],
};

export class SessionLifecycleGuard {
  static canTransition(from: EditingSessionState, to: EditingSessionState): boolean {
    return allowed[from].includes(to);
  }

  static assertTransition(from: EditingSessionState, to: EditingSessionState): void {
    if (!this.canTransition(from, to)) {
      throw new Error('V2_INT_SESSION_INVALID_LIFECYCLE_TRANSITION_001');
    }
  }
}

import type { SessionMutationRequest, SessionMutationResult } from '../types/session';
import { ConfigGovernanceMutationPort } from '../governance/ConfigGovernanceMutationPort';
import { EditingSessionStore } from './EditingSessionStore';

export type CallerMutationInput =
  SessionMutationRequest extends infer T
    ? T extends SessionMutationRequest
      ? Omit<T, 'sessionId' | 'draftBaseRevision'>
      : never
    : never;

export class SessionMutationPort {
  constructor(
    private sessionStore: EditingSessionStore,
    private governanceMutationPort: ConfigGovernanceMutationPort
  ) {}

  dispatchCallerMutation(sessionId: string, input: CallerMutationInput): SessionMutationResult {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) return { success: false, errorCode: 'V2_INT_SESSION_NOT_FOUND_001' };
    if (session.state !== 'ACTIVE') {
      return { success: false, errorCode: 'V2_INT_SESSION_NOT_ACTIVE_001' };
    }

    const request: SessionMutationRequest =
      input.kind === 'UPDATE_PROPERTY_VALUE'
        ? {
            ...input,
            sessionId,
            draftBaseRevision: session.draftBaseRevision,
          }
        : {
            ...input,
            sessionId,
            draftBaseRevision: session.draftBaseRevision,
          };

    const result = this.governanceMutationPort.dispatchMutation(request);
    if (result.success) this.sessionStore.updateDirty(sessionId, result.hasRealDifference);
    return result;
  }
}

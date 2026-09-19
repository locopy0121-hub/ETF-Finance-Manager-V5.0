import type { ISessionCommitWrapUpPort, SessionWrapUpCommand } from '../types/pipeline';
import { ConfigGovernanceSandboxPort } from '../governance/ConfigGovernanceSandboxPort';
import { EditingSessionStore } from './EditingSessionStore';
import { SessionLifecycleGuard } from './SessionLifecycleGuard';

export class SessionCommitWrapUpPortImpl implements ISessionCommitWrapUpPort {
  constructor(
    private sessionStore: EditingSessionStore,
    private sandboxPort: ConfigGovernanceSandboxPort
  ) {}

  finalizeSession(sessionId: string, outcome: SessionWrapUpCommand): { readonly success: boolean } {
    try {
      const session = this.sessionStore.getSession(sessionId);
      if (!session || session.state !== 'COMMITTING') return { success: false };

      if (outcome === 'RETAIN_FROZEN_DRAFT') {
        SessionLifecycleGuard.assertTransition('COMMITTING', 'ACTIVE');
        this.sessionStore.updateState(sessionId, 'ACTIVE');
        return { success: true };
      }

      if (outcome === 'SUCCESS_EXIT') {
        SessionLifecycleGuard.assertTransition('COMMITTING', 'CLOSED');
        this.sandboxPort.clearDraftSandbox(sessionId);
        this.sessionStore.updateState(sessionId, 'CLOSED');
        this.sessionStore.removeSession(sessionId);
        return { success: true };
      }

      const prepared = this.sandboxPort.prepareContinueSandboxReplacement(sessionId);
      if (!prepared.success) return { success: false };

      const previous = this.sessionStore.getSession(sessionId);
      if (!previous) {
        this.sandboxPort.discardContinueSandboxReplacement(prepared.output.replacementId);
        return { success: false };
      }

      try {
        this.sessionStore.replaceBaselineAfterCommit(
          sessionId,
          prepared.output.draftBaseRevision,
          prepared.output.sandboxToken
        );
      } catch {
        this.sandboxPort.discardContinueSandboxReplacement(prepared.output.replacementId);
        return { success: false };
      }

      if (!this.sandboxPort.commitContinueSandboxReplacement(prepared.output.replacementId)) {
        this.sessionStore.restoreSessionEntitySnapshot(previous);
        this.sandboxPort.discardContinueSandboxReplacement(prepared.output.replacementId);
        return { success: false };
      }

      SessionLifecycleGuard.assertTransition('COMMITTING', 'ACTIVE');
      this.sessionStore.updateState(sessionId, 'ACTIVE');
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}

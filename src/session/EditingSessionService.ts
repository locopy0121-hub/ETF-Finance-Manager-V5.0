import type { SessionMutationResult } from '../types/session';
import type { CommitWrapUpIntent, ICommitPipelineExecutor } from '../pipeline/CommitPipelineExecutor';
import { ConfigGovernanceSandboxPort } from '../governance/ConfigGovernanceSandboxPort';
import { EditingSessionStore } from './EditingSessionStore';
import { SessionLifecycleGuard } from './SessionLifecycleGuard';
import { SessionMutationPort, type CallerMutationInput } from './SessionMutationPort';
import { SessionCommitOrchestrator, type SessionCommitResult } from './SessionCommitOrchestrator';

export class EditingSessionService {
  private commitOrchestrator: SessionCommitOrchestrator;

  constructor(
    private sessionStore: EditingSessionStore,
    private sandboxPort: ConfigGovernanceSandboxPort,
    private mutationPort: SessionMutationPort,
    commitPipelineExecutor: ICommitPipelineExecutor
  ) {
    this.commitOrchestrator = new SessionCommitOrchestrator(
      sessionStore,
      commitPipelineExecutor
    );
  }

  startSession(sessionId: string, userId: string) {
    const initialized = this.sandboxPort.initializeDraftSandbox(sessionId);
    const entity = this.sessionStore.createSession(
      sessionId,
      userId,
      initialized.draftBaseRevision,
      initialized.sandboxToken
    );
    SessionLifecycleGuard.assertTransition(entity.state, 'ACTIVE');
    this.sessionStore.updateState(sessionId, 'ACTIVE');
    return initialized;
  }

  mutate(sessionId: string, input: CallerMutationInput): SessionMutationResult {
    return this.mutationPort.dispatchCallerMutation(sessionId, input);
  }

  commit(
    sessionId: string,
    intent: 'CONTINUE' | 'EXIT' = 'CONTINUE'
  ): SessionCommitResult {
    const pipelineIntent: CommitWrapUpIntent =
      intent === 'EXIT' ? 'SUCCESS_EXIT' : 'SUCCESS_CONTINUE';
    return this.commitOrchestrator.executeCommit(sessionId, pipelineIntent);
  }

  discardSession(sessionId: string): void {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) return;
    SessionLifecycleGuard.assertTransition(session.state, 'CLOSED');
    this.sandboxPort.clearDraftSandbox(sessionId);
    this.sessionStore.updateState(sessionId, 'CLOSED');
    this.sessionStore.removeSession(sessionId);
  }
}

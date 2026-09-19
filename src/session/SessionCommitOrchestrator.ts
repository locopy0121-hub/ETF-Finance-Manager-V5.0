import type { PipelineExecutionResult } from '../types/pipeline';
import type { CommitWrapUpIntent, ICommitPipelineExecutor } from '../pipeline/CommitPipelineExecutor';
import { EditingSessionStore } from './EditingSessionStore';
import { SessionLifecycleGuard } from './SessionLifecycleGuard';

export type SessionCommitResult =
  | { readonly accepted: true; readonly pipelineResult: PipelineExecutionResult }
  | { readonly accepted: false; readonly errorCode: string };

export class SessionCommitOrchestrator {
  constructor(
    private sessionStore: EditingSessionStore,
    private commitPipelineExecutor: ICommitPipelineExecutor
  ) {}

  executeCommit(
    sessionId: string,
    intent: CommitWrapUpIntent = 'SUCCESS_CONTINUE'
  ): SessionCommitResult {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) return { accepted: false, errorCode: 'V2_INT_SESSION_NOT_FOUND_001' };
    if (!SessionLifecycleGuard.canTransition(session.state, 'COMMITTING')) {
      return {
        accepted: false,
        errorCode: 'V2_INT_SESSION_INVALID_LIFECYCLE_TRANSITION_001',
      };
    }

    this.sessionStore.updateState(sessionId, 'COMMITTING');
    const pipelineResult = this.commitPipelineExecutor.executePipeline(sessionId, intent);

    if (
      pipelineResult.transactionOutcome === 'RECOVERY_FAILED' ||
      (
        pipelineResult.transactionOutcome === 'COMMITTED' &&
        pipelineResult.wrapUpOutcome === 'WRAP_UP_FAILED'
      )
    ) {
      const current = this.sessionStore.getSession(sessionId);
      if (current?.state === 'COMMITTING') {
        SessionLifecycleGuard.assertTransition('COMMITTING', 'ERROR_LOCKED');
        this.sessionStore.updateState(sessionId, 'ERROR_LOCKED');
      }
    }

    const after = this.sessionStore.getSession(sessionId);
    if (after?.state === 'COMMITTING') {
      SessionLifecycleGuard.assertTransition('COMMITTING', 'ERROR_LOCKED');
      this.sessionStore.updateState(sessionId, 'ERROR_LOCKED');
    }

    return { accepted: true, pipelineResult };
  }
}

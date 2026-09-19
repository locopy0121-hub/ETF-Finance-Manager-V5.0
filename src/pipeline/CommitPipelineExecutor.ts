import type {
  ISessionCommitWrapUpPort,
  PipelineExecutionResult,
} from '../types/pipeline';
import type { IDiagnosticObservationPort } from '../types/diagnostic';
import type { ISafetySnapshotDisposerPort } from '../governance/ProductionConfigStore';
import { CommitValidationCoordinator } from './CommitValidationCoordinator';
import { ProductionTransactionCoordinator } from './ProductionTransactionCoordinator';

export type CommitWrapUpIntent = 'SUCCESS_CONTINUE' | 'SUCCESS_EXIT';

export interface ICommitPipelineExecutor {
  executePipeline(sessionId: string, intent: CommitWrapUpIntent): PipelineExecutionResult;
}

export class CommitPipelineExecutor implements ICommitPipelineExecutor {
  constructor(
    private validationCoordinator: CommitValidationCoordinator,
    private transactionCoordinator: ProductionTransactionCoordinator,
    private sessionWrapUpPort: ISessionCommitWrapUpPort,
    private safetySnapshotDisposer: ISafetySnapshotDisposerPort,
    private diagnosticPort: IDiagnosticObservationPort
  ) {}

  executePipeline(
    sessionId: string,
    intent: CommitWrapUpIntent = 'SUCCESS_CONTINUE'
  ): PipelineExecutionResult {
    try {
      const validation = this.validationCoordinator.validateAndFreeze(sessionId);
      if (!validation.success) {
        this.sessionWrapUpPort.finalizeSession(sessionId, 'RETAIN_FROZEN_DRAFT');
        return validation.result;
      }

      const transaction = this.transactionCoordinator.executeTransaction(validation.frozenSnapshot);
      if (!transaction.success) {
        if (transaction.outcome === 'RECOVERY_FAILED') {
          return {
            transactionOutcome: 'RECOVERY_FAILED',
            errorContext: { errorCode: transaction.errorCode },
          };
        }

        this.sessionWrapUpPort.finalizeSession(sessionId, 'RETAIN_FROZEN_DRAFT');
        return {
          transactionOutcome: transaction.outcome,
          errorContext: { errorCode: transaction.errorCode },
          wrapUpOutcome: 'RETAIN_FROZEN_DRAFT',
        };
      }

      const dispose = this.safetySnapshotDisposer.dispose(transaction.safetySnapshotId);
      if (!dispose.success) {
        this.diagnosticPort.recordEvent({
          groupId: `group_${sessionId}_${Date.now()}`,
          errorCode: 'V2_COM_SNAPSHOT_DISPOSE_FAILED_001',
          severity: 'LEVEL_1_WARNING',
          lifecycleStage: 'POST_COMMIT_CLEANUP',
          ruleViolated: 'SAFETY_SNAPSHOT_DISPOSE_WARNING',
          actionTaken: 'LOG_WARNING_CONTINUE',
          finalSystemState: 'PRODUCTION_COMMITTED',
          domain: 'COM',
          displayTier: 'GLOBAL',
          associatedSessionId: sessionId,
          userMessageKey: 'MSG_CLEANUP_WARNING',
        });
      }

      const command = intent === 'SUCCESS_EXIT' ? 'SUCCESS_EXIT' : 'SUCCESS_CONTINUE';
      const wrapUp = this.sessionWrapUpPort.finalizeSession(sessionId, command);
      if (!wrapUp.success) {
        return {
          transactionOutcome: 'COMMITTED',
          newProductionRevision: transaction.newRevision,
          wrapUpOutcome: 'WRAP_UP_FAILED',
        };
      }

      return {
        transactionOutcome: 'COMMITTED',
        newProductionRevision: transaction.newRevision,
        wrapUpOutcome: intent === 'SUCCESS_EXIT' ? 'EXITED' : 'CONTINUED',
      };
    } finally {
      this.validationCoordinator.releaseCommitGate(sessionId);
    }
  }
}

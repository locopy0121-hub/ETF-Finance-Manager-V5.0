import type { FrozenDraftSnapshot, PipelineValidationResult } from '../types/pipeline';
import type { IProductionConfigReadPort } from '../governance/ProductionConfigStore';
import type { IDiagnosticObservationPort } from '../types/diagnostic';
import type { IGovernanceCommitPreparationPort } from '../governance/GovernanceCommitPreparationPort';
import { computeCanonicalFingerprint } from '../governance/CanonicalFingerprint';

export type MigrationResult =
  | { readonly success: true; readonly migratedSnapshot: FrozenDraftSnapshot }
  | { readonly success: false; readonly errorCode: string };

export interface IMigrationCoordinatorPort {
  needsMigration(snapshot: FrozenDraftSnapshot): boolean;
  migrate(snapshot: FrozenDraftSnapshot): MigrationResult;
}

export interface ICommitGuardValidator {
  validate(snapshot: FrozenDraftSnapshot):
    | { readonly success: true }
    | { readonly success: false; readonly errorCode: string };
}

export class CommitValidationCoordinator {
  constructor(
    private governancePrepPort: IGovernanceCommitPreparationPort,
    private productionReadPort: IProductionConfigReadPort,
    private diagnosticPort: IDiagnosticObservationPort,
    private migrationPort: IMigrationCoordinatorPort,
    private structuralValidator: ICommitGuardValidator,
    private semanticValidator: ICommitGuardValidator,
    private capabilityValidator: ICommitGuardValidator,
    private financialCoreValidator: ICommitGuardValidator,
    private dependencyMutexValidator: ICommitGuardValidator
  ) {}

  releaseCommitGate(sessionId: string): void {
    this.governancePrepPort.releaseDuplicateSubmitGate(sessionId);
  }

  validateAndFreeze(sessionId: string):
    | { readonly success: true; readonly frozenSnapshot: FrozenDraftSnapshot }
    | { readonly success: false; readonly result: PipelineValidationResult } {
    const duplicate = this.governancePrepPort.checkDuplicateSubmitGate(sessionId);
    if (duplicate.isDuplicate) {
      return this.handleValidationError('V2_COM_DUPLICATE_SUBMIT_001', sessionId);
    }

    const freeze = this.governancePrepPort.freezeDraftForCommit(sessionId);
    if (!freeze.success) return this.handleValidationError(freeze.errorCode, sessionId);
    let snapshot = freeze.snapshot;

    const runGuards = (target: FrozenDraftSnapshot):
      | { readonly success: true }
      | { readonly success: false; readonly errorCode: string } => {
      const baseline = this.governancePrepPort.getSessionBaselineSnapshot(sessionId);
      if (!baseline) return { success: false, errorCode: 'V2_COM_BASELINE_NOT_FOUND_001' };

      if (
        computeCanonicalFingerprint(target.frozenTree) ===
        computeCanonicalFingerprint(baseline)
      ) {
        return { success: false, errorCode: 'V2_COM_NO_CHANGES_DETECTED_001' };
      }

      for (const validator of [
        this.structuralValidator,
        this.semanticValidator,
        this.capabilityValidator,
        this.financialCoreValidator,
        this.dependencyMutexValidator,
      ]) {
        const result = validator.validate(target);
        if (!result.success) return result;
      }
      return { success: true };
    };

    const initial = runGuards(snapshot);
    if (!initial.success) return this.handleValidationError(initial.errorCode, sessionId);

    if (this.migrationPort.needsMigration(snapshot)) {
      const migrated = this.migrationPort.migrate(snapshot);
      if (!migrated.success) return this.handleValidationError(migrated.errorCode, sessionId);
      snapshot = migrated.migratedSnapshot;
      const revalidated = runGuards(snapshot);
      if (!revalidated.success) {
        return this.handleValidationError(revalidated.errorCode, sessionId);
      }
    }

    const production = this.productionReadPort.getProductionEnvelope();
    if (snapshot.draftBaseRevision !== production.productionRevision) {
      return this.handleValidationError('V2_COM_VERSION_CONFLICT_001', sessionId);
    }

    return { success: true, frozenSnapshot: snapshot };
  }

  private handleValidationError(
    errorCode: string,
    sessionId: string
  ): { readonly success: false; readonly result: PipelineValidationResult } {
    const diag = this.diagnosticPort.recordEvent({
      groupId: `group_${sessionId}_${Date.now()}`,
      errorCode,
      severity: 'LEVEL_2_BLOCKING',
      lifecycleStage: 'COMMIT_VALIDATION',
      ruleViolated: 'COMMIT_PIPELINE_VALIDATION_FAILURE',
      actionTaken: 'REJECT_COMMIT',
      finalSystemState: 'DRAFT_FROZEN_UNCHANGED',
      domain: 'COM',
      displayTier: 'GLOBAL',
      associatedSessionId: sessionId,
      userMessageKey: 'MSG_COMMIT_REJECTED',
    });

    return {
      success: false,
      result: {
        transactionOutcome: 'BLOCKED',
        errorContext: {
          errorCode,
          ...(diag.success ? { diagnosticEventId: diag.event.eventId } : {}),
        },
        wrapUpOutcome: 'RETAIN_FROZEN_DRAFT',
      },
    };
  }
}

import type { FrozenDraftSnapshot, ICommitPipelineDedicatedPort } from '../types/pipeline';
import type { ExecutionRecoveryPlan } from '../types/diagnostic';

export interface IRecoveryExecutor {
  executePlan(plan: ExecutionRecoveryPlan): { readonly success: boolean };
}

export interface IEffectiveReresolvePort {
  resolveProduction(newRevision: number):
    | { readonly success: true; readonly effectiveContext: unknown }
    | { readonly success: false; readonly errorCode: string };
}

export interface IRuntimeActivationPort {
  activate(newRevision: number, effectiveContext: unknown): { readonly success: boolean };
}

export interface IInteractionAuthorizationSyncPort {
  sync(effectiveContext: unknown): { readonly success: boolean };
}

export interface ICommitRecordWriterPort {
  writeRecord(snapshot: FrozenDraftSnapshot, newRevision: number): { readonly success: boolean };
}

export class ProductionTransactionCoordinator {
  constructor(
    private dedicatedPort: ICommitPipelineDedicatedPort,
    private recoveryExecutor: IRecoveryExecutor,
    private effectiveReresolvePort: IEffectiveReresolvePort,
    private runtimeActivationPort: IRuntimeActivationPort,
    private interactionAuthPort: IInteractionAuthorizationSyncPort,
    private recordWriterPort: ICommitRecordWriterPort
  ) {}

  executeTransaction(frozenSnapshot: FrozenDraftSnapshot):
    | { readonly success: true; readonly newRevision: number; readonly safetySnapshotId: string }
    | { readonly success: false; readonly outcome: 'BLOCKED' | 'ROLLED_BACK' | 'RECOVERY_FAILED'; readonly errorCode: string } {
    const safety = this.dedicatedPort.createSafetySnapshot();
    if (!safety.success) {
      return {
        success: false,
        outcome: 'BLOCKED',
        errorCode: 'V2_COM_SAFETY_SNAPSHOT_FAILED_001',
      };
    }

    const replace = this.dedicatedPort.atomicReplaceProduction(
      frozenSnapshot,
      frozenSnapshot.draftBaseRevision
    );
    if (!replace.success) {
      return this.triggerLevel3Rollback(
        safety.safetySnapshotId,
        frozenSnapshot.draftBaseRevision,
        replace.errorCode
      );
    }

    const resolve = this.effectiveReresolvePort.resolveProduction(replace.newProductionRevision);
    if (!resolve.success) {
      return this.triggerLevel3Rollback(
        safety.safetySnapshotId,
        frozenSnapshot.draftBaseRevision,
        resolve.errorCode
      );
    }

    if (!this.runtimeActivationPort.activate(replace.newProductionRevision, resolve.effectiveContext).success) {
      return this.triggerLevel3Rollback(
        safety.safetySnapshotId,
        frozenSnapshot.draftBaseRevision,
        'V2_COM_RUNTIME_ACTIVATION_FAILED_001'
      );
    }

    if (!this.interactionAuthPort.sync(resolve.effectiveContext).success) {
      return this.triggerLevel3Rollback(
        safety.safetySnapshotId,
        frozenSnapshot.draftBaseRevision,
        'V2_COM_INTERACTION_AUTH_SYNC_FAILED_001'
      );
    }

    if (!this.recordWriterPort.writeRecord(frozenSnapshot, replace.newProductionRevision).success) {
      return this.triggerLevel3Rollback(
        safety.safetySnapshotId,
        frozenSnapshot.draftBaseRevision,
        'V2_COM_COMMIT_RECORD_WRITE_FAILED_001'
      );
    }

    return {
      success: true,
      newRevision: replace.newProductionRevision,
      safetySnapshotId: safety.safetySnapshotId,
    };
  }

  private triggerLevel3Rollback(
    safetySnapshotId: string,
    targetOldRevision: number,
    errorCode: string
  ):
    | { readonly success: false; readonly outcome: 'ROLLED_BACK'; readonly errorCode: string }
    | { readonly success: false; readonly outcome: 'RECOVERY_FAILED'; readonly errorCode: string } {
    const plan: ExecutionRecoveryPlan = {
      level: 'LEVEL_3_TRANSACTION_ROLLBACK',
      incidentId: `inc_${crypto.randomUUID()}`,
      safetySnapshotId,
      targetOldRevision,
    };
    const recovery = this.recoveryExecutor.executePlan(plan);
    if (!recovery.success) {
      return {
        success: false,
        outcome: 'RECOVERY_FAILED',
        errorCode: 'V2_REC_RESTORE_FATAL_001',
      };
    }
    return { success: false, outcome: 'ROLLED_BACK', errorCode };
  }
}

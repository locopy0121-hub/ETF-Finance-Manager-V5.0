import type { ConfigurationTree } from './editor';

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T :
  T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

export interface FrozenDraftSnapshot {
  readonly sessionId: string;
  readonly draftBaseRevision: number;
  readonly schemaVersion: string;
  readonly frozenTree: DeepReadonly<ConfigurationTree>;
  readonly snapshotId: string;
}

export type PipelineExecutionResult =
  | {
      readonly transactionOutcome: 'COMMITTED';
      readonly newProductionRevision: number;
      readonly wrapUpOutcome: 'CONTINUED' | 'EXITED' | 'WRAP_UP_FAILED';
    }
  | {
      readonly transactionOutcome: 'BLOCKED' | 'ROLLED_BACK';
      readonly errorContext: {
        readonly errorCode: string;
        readonly diagnosticEventId?: string;
      };
      readonly wrapUpOutcome: 'RETAIN_FROZEN_DRAFT';
    }
  | {
      readonly transactionOutcome: 'RECOVERY_FAILED';
      readonly errorContext: { readonly errorCode: string };
    };

export interface PipelineValidationResult {
  readonly transactionOutcome: 'BLOCKED';
  readonly errorContext: {
    readonly errorCode: string;
    readonly diagnosticEventId?: string;
  };
  readonly wrapUpOutcome: 'RETAIN_FROZEN_DRAFT';
}

export type SessionWrapUpCommand =
  | 'SUCCESS_CONTINUE'
  | 'SUCCESS_EXIT'
  | 'RETAIN_FROZEN_DRAFT';

export interface ISessionCommitWrapUpPort {
  finalizeSession(
    sessionId: string,
    outcome: SessionWrapUpCommand
  ): { readonly success: boolean };
}

export interface ICommitPipelineDedicatedPort {
  verifyProductionVersionConflict(baseRevision: number): {
    readonly hasConflict: boolean;
    readonly currentProductionRevision: number;
  };
  createSafetySnapshot():
    | { readonly success: true; readonly safetySnapshotId: string }
    | { readonly success: false; readonly errorCode: string };
  atomicReplaceProduction(
    snapshot: FrozenDraftSnapshot,
    expectedOldRevision: number
  ):
    | { readonly success: true; readonly newProductionRevision: number }
    | { readonly success: false; readonly errorCode: string };
}

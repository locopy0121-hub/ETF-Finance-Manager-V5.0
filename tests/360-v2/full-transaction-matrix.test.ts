import { beforeEach, describe, expect, it } from 'vitest';
import { FailureInjectionController } from './harness/FailureInjectionController';
import {
  FakeDedicatedProductionAccess,
  FakeDiagnosticPort,
  FakeProductionStore,
  FakeRecoveryExecutor,
} from './harness/FakePortsAndOwners';
import { CommitValidationCoordinator } from '../../src/pipeline/CommitValidationCoordinator';
import { ProductionTransactionCoordinator } from '../../src/pipeline/ProductionTransactionCoordinator';
import { CommitPipelineExecutor } from '../../src/pipeline/CommitPipelineExecutor';
import { EditingSessionStore } from '../../src/session/EditingSessionStore';
import { SessionCommitWrapUpPortImpl } from '../../src/session/SessionCommitWrapUpPortImpl';
import { EditingSessionService } from '../../src/session/EditingSessionService';
import { SessionMutationPort } from '../../src/session/SessionMutationPort';
import { ConfigGovernanceMutationPort } from '../../src/governance/ConfigGovernanceMutationPort';
import { DraftSandboxStore } from '../../src/governance/DraftSandboxStore';
import { ConfigGovernanceSandboxPort } from '../../src/governance/ConfigGovernanceSandboxPort';
import {
  GovernanceCommitPreparationPort,
  type IGovernanceCommitPreparationPort,
} from '../../src/governance/GovernanceCommitPreparationPort';
import type { IRegistryContractProvider } from '../../src/governance/FiveLayerConfigResolver';
import type {
  DeepReadonly,
  FrozenDraftSnapshot,
  ISessionCommitWrapUpPort,
} from '../../src/types/pipeline';
import type { ConfigurationTree } from '../../src/types/editor';
import type { SessionCommitResult } from '../../src/session/SessionCommitOrchestrator';

describe('360 Editor V2 - Full Transaction Matrix & Failure Injection Tests (CI Hard-Gate)', () => {
  let injector: FailureInjectionController;
  let store: FakeProductionStore;
  let dedication: FakeDedicatedProductionAccess;
  let recoveryExecutor: FakeRecoveryExecutor;
  let diagnosticPort: FakeDiagnosticPort;
  let sessionStore: EditingSessionStore;
  let draftStore: DraftSandboxStore;
  let sandboxPort: ConfigGovernanceSandboxPort;
  let sessionService: EditingSessionService;
  let baselineTree: DeepReadonly<ConfigurationTree>;
  let modifiedDraftTree: ConfigurationTree;

  const expectValidationBlockedInvariant = (
    result: SessionCommitResult,
    expectedRevision: number,
    expectedTree: DeepReadonly<ConfigurationTree>,
    sessionId: string
  ): void => {
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.pipelineResult.transactionOutcome).toBe('BLOCKED');
    if (result.pipelineResult.transactionOutcome === 'BLOCKED') {
      expect(result.pipelineResult.wrapUpOutcome).toBe('RETAIN_FROZEN_DRAFT');
    }
    expect(store.getProductionEnvelope().productionRevision).toBe(expectedRevision);
    expect(store.getProductionEnvelope().tree).toEqual(expectedTree);
    expect(dedication.rollbackCallCount).toBe(0);
    expect(dedication.safetySnapshots.size).toBe(0);
    expect(sessionStore.getSession(sessionId)?.state).toBe('ACTIVE');
    expect(draftStore.getReadonlyDraftSnapshot(sessionId)).toEqual(modifiedDraftTree);
    expect(
      diagnosticPort.recordedEvents.some(
        (event) => event.severity === 'LEVEL_2_BLOCKING'
      )
    ).toBe(true);
  };

  const expectPreTransactionBlockedInvariant = (
    result: SessionCommitResult,
    sessionId: string
  ): void => {
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.pipelineResult.transactionOutcome).toBe('BLOCKED');
    expect(store.getProductionEnvelope().productionRevision).toBe(10);
    expect(store.getProductionEnvelope().tree).toEqual(baselineTree);
    expect(dedication.rollbackCallCount).toBe(0);
    expect(dedication.safetySnapshots.size).toBe(0);
    expect(sessionStore.getSession(sessionId)?.state).toBe('ACTIVE');
    expect(draftStore.getReadonlyDraftSnapshot(sessionId)).toEqual(modifiedDraftTree);
  };

  const expectRolledBackInvariant = (
    result: SessionCommitResult,
    sessionId: string
  ): void => {
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.pipelineResult.transactionOutcome).toBe('ROLLED_BACK');
    if (result.pipelineResult.transactionOutcome === 'ROLLED_BACK') {
      expect(result.pipelineResult.wrapUpOutcome).toBe('RETAIN_FROZEN_DRAFT');
    }
    expect(dedication.rollbackCallCount).toBe(1);
    expect(store.getProductionEnvelope().productionRevision).toBe(10);
    expect(store.getProductionEnvelope().tree).toEqual(baselineTree);
    expect(sessionStore.getSession(sessionId)?.state).toBe('ACTIVE');
    expect(dedication.safetySnapshots.size).toBe(0);
    expect(draftStore.getReadonlyDraftSnapshot(sessionId)).toEqual(modifiedDraftTree);
    expect(recoveryExecutor.lastPlan?.level).toBe('LEVEL_3_TRANSACTION_ROLLBACK');
    if (recoveryExecutor.lastPlan?.level === 'LEVEL_3_TRANSACTION_ROLLBACK') {
      expect(recoveryExecutor.lastPlan.targetOldRevision).toBe(10);
    }
  };

  const expectCommittedInvariant = (
    result: SessionCommitResult,
    expectedSnapshotCount = 0
  ): void => {
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.pipelineResult.transactionOutcome).toBe('COMMITTED');
    expect(dedication.rollbackCallCount).toBe(0);
    expect(store.getProductionEnvelope().productionRevision).toBe(11);
    expect(store.getProductionEnvelope().tree).toEqual(modifiedDraftTree);
    expect(dedication.safetySnapshots.size).toBe(expectedSnapshotCount);
  };

  beforeEach(() => {
    injector = new FailureInjectionController();
    store = new FakeProductionStore();
    dedication = new FakeDedicatedProductionAccess(store, injector);
    recoveryExecutor = new FakeRecoveryExecutor(dedication);
    diagnosticPort = new FakeDiagnosticPort();
    sessionStore = new EditingSessionStore();
    draftStore = new DraftSandboxStore();

    baselineTree = store.getProductionEnvelope().tree;
    modifiedDraftTree = structuredClone(baselineTree) as ConfigurationTree;
    const mutable = modifiedDraftTree as unknown as {
      surfaces: Record<string, ConfigurationTree['surfaces'][string]>;
    };
    mutable.surfaces = {
      ...modifiedDraftTree.surfaces,
      surf_1: {
        ...modifiedDraftTree.surfaces.surf_1,
        governanceIntent: 'READ_ONLY',
      },
    };

    const registry: IRegistryContractProvider = {
      getCapabilityPermission: () => 'EDITABLE',
      getPropertyPermission: () => 'EDITABLE',
      getRequiredEnvironmentFacts: () => [],
    };

    sandboxPort = new ConfigGovernanceSandboxPort(store, draftStore, registry);
    const realPrep = new GovernanceCommitPreparationPort(draftStore);
    const prepPort: IGovernanceCommitPreparationPort = {
      checkDuplicateSubmitGate: (sessionId) =>
        injector.failStep1Duplicate
          ? { isDuplicate: true }
          : realPrep.checkDuplicateSubmitGate(sessionId),
      releaseDuplicateSubmitGate: (sessionId) =>
        realPrep.releaseDuplicateSubmitGate(sessionId),
      freezeDraftForCommit: (sessionId) =>
        realPrep.freezeDraftForCommit(sessionId),
      getSessionBaselineSnapshot: (sessionId) =>
        realPrep.getSessionBaselineSnapshot(sessionId),
    };

    let migrationCompleted = false;
    const migrationPort = {
      needsMigration: () => injector.requireMigration,
      migrate: (snapshot: FrozenDraftSnapshot) => {
        if (injector.failMigration) {
          return {
            success: false as const,
            errorCode: 'V2_COM_MIGRATION_FAILED_001',
          };
        }
        migrationCompleted = true;
        return { success: true as const, migratedSnapshot: snapshot };
      },
    };

    const makeGuard = (fail: () => boolean, errorCode: string) => ({
      validate: () =>
        fail()
          ? { success: false as const, errorCode }
          : { success: true as const },
    });

    const structuralValidator = {
      validate: () => {
        if (injector.failStep4Structural) {
          return {
            success: false as const,
            errorCode: 'V2_COM_STRUCTURAL_FAILED_001',
          };
        }
        if (migrationCompleted && injector.failMigrationRevalidation) {
          return {
            success: false as const,
            errorCode: 'V2_COM_MIGRATION_REVALIDATION_FAILED_001',
          };
        }
        return { success: true as const };
      },
    };

    const validation = new CommitValidationCoordinator(
      prepPort,
      store,
      diagnosticPort,
      migrationPort,
      structuralValidator,
      makeGuard(() => injector.failStep5Semantic, 'V2_COM_SEMANTIC_FAILED_001'),
      makeGuard(() => injector.failStep6Capability, 'V2_COM_CAPABILITY_FAILED_001'),
      makeGuard(
        () => injector.failStep7FinancialBoundary,
        'V2_COM_FINANCIAL_FAILED_001'
      ),
      makeGuard(
        () => injector.failStep8DependencyMutex,
        'V2_COM_DEPENDENCY_FAILED_001'
      )
    );

    const transaction = new ProductionTransactionCoordinator(
      dedication.pipelinePort,
      recoveryExecutor,
      {
        resolveProduction: () =>
          injector.failStep13Reresolve
            ? {
                success: false as const,
                errorCode: 'V2_COM_EFFECTIVE_RESOLVE_FAILED_001',
              }
            : {
                success: true as const,
                effectiveContext: { mode: 'RUNTIME' },
              },
      },
      {
        activate: () => ({ success: !injector.failStep14RuntimeActivation }),
      },
      {
        sync: () => ({ success: !injector.failStep15InteractionSync }),
      },
      {
        writeRecord: () => ({ success: !injector.failStep16CommitRecord }),
      }
    );

    const realWrapUp = new SessionCommitWrapUpPortImpl(sessionStore, sandboxPort);
    const wrapUpPort: ISessionCommitWrapUpPort = {
      finalizeSession: (sessionId, outcome) => {
        if (injector.failRetain && outcome === 'RETAIN_FROZEN_DRAFT') {
          return { success: false };
        }
        if (injector.failStep17Continue && outcome === 'SUCCESS_CONTINUE') {
          return { success: false };
        }
        if (injector.failStep17Exit && outcome === 'SUCCESS_EXIT') {
          return { success: false };
        }
        return realWrapUp.finalizeSession(sessionId, outcome);
      },
    };

    const pipeline = new CommitPipelineExecutor(
      validation,
      transaction,
      wrapUpPort,
      dedication.disposerPort,
      diagnosticPort
    );

    const governanceMutation = new ConfigGovernanceMutationPort(
      draftStore,
      registry,
      diagnosticPort
    );
    const sessionMutation = new SessionMutationPort(
      sessionStore,
      governanceMutation
    );
    sessionService = new EditingSessionService(
      sessionStore,
      sandboxPort,
      sessionMutation,
      pipeline
    );
  });

  const setupSessionWithMutation = (sessionId: string): void => {
    sessionService.startSession(sessionId, `user_${sessionId}`);
    const mutation = sessionService.mutate(sessionId, {
      kind: 'SET_GOVERNANCE_INTENT',
      targetPath: 'surfaces.surf_1',
      governanceIntent: 'READ_ONLY',
    });
    expect(mutation.success).toBe(true);
    expect(draftStore.getReadonlyDraftSnapshot(sessionId)).toEqual(modifiedDraftTree);
  };

  it('1.1 Step 1 duplicate submit -> BLOCKED', () => {
    setupSessionWithMutation('s1');
    injector.failStep1Duplicate = true;
    expectValidationBlockedInvariant(
      sessionService.commit('s1', 'CONTINUE'),
      10,
      baselineTree,
      's1'
    );
  });

  it('1.2 Step 10 revision conflict -> BLOCKED', () => {
    setupSessionWithMutation('s10');
    store.internalAtomicReplace(modifiedDraftTree);
    expectValidationBlockedInvariant(
      sessionService.commit('s10', 'CONTINUE'),
      11,
      modifiedDraftTree,
      's10'
    );
  });

  it('1.3 Step 9 migration revalidation failure -> BLOCKED', () => {
    setupSessionWithMutation('s9');
    injector.requireMigration = true;
    injector.failMigrationRevalidation = true;
    const result = sessionService.commit('s9', 'CONTINUE');
    expectValidationBlockedInvariant(result, 10, baselineTree, 's9');
    if (result.accepted && result.pipelineResult.transactionOutcome === 'BLOCKED') {
      expect(result.pipelineResult.errorContext.errorCode).toBe(
        'V2_COM_MIGRATION_REVALIDATION_FAILED_001'
      );
    }
  });

  for (const [name, flag] of [
    ['Step 4 structural', 'failStep4Structural'],
    ['Step 5 semantic', 'failStep5Semantic'],
    ['Step 6 capability', 'failStep6Capability'],
    ['Step 7 financial boundary', 'failStep7FinancialBoundary'],
    ['Step 8 dependency/mutex', 'failStep8DependencyMutex'],
  ] as const) {
    it(`${name} guard failure -> BLOCKED`, () => {
      setupSessionWithMutation(name);
      injector[flag] = true;
      expectValidationBlockedInvariant(
        sessionService.commit(name, 'CONTINUE'),
        10,
        baselineTree,
        name
      );
    });
  }

  it('2.1 Step 11 safety snapshot failure -> BLOCKED without rollback', () => {
    setupSessionWithMutation('s11');
    injector.failStep11SafetySnapshot = true;
    expectPreTransactionBlockedInvariant(
      sessionService.commit('s11', 'CONTINUE'),
      's11'
    );
  });

  it('2.2 Step 12 atomic replace failure -> Level 3 rollback', () => {
    setupSessionWithMutation('s12');
    injector.failStep12AtomicReplace = true;
    expectRolledBackInvariant(sessionService.commit('s12', 'CONTINUE'), 's12');
  });

  for (const [name, flag] of [
    ['2.3a Step 13 re-resolve', 'failStep13Reresolve'],
    ['2.3b Step 14 activation', 'failStep14RuntimeActivation'],
    ['2.3c Step 15 authorization', 'failStep15InteractionSync'],
    ['2.3d Step 16 commit record', 'failStep16CommitRecord'],
  ] as const) {
    it(`${name} failure -> Level 3 rollback`, () => {
      setupSessionWithMutation(name);
      injector[flag] = true;
      expectRolledBackInvariant(
        sessionService.commit(name, 'CONTINUE'),
        name
      );
    });
  }

  it('2.4 recovery fatal after Production replacement -> RECOVERY_FAILED', () => {
    setupSessionWithMutation('fatal');
    injector.failStep13Reresolve = true;
    injector.failLevel3Recovery = true;
    const result = sessionService.commit('fatal', 'CONTINUE');
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.pipelineResult.transactionOutcome).toBe('RECOVERY_FAILED');
    expect(dedication.rollbackCallCount).toBe(1);
    expect(store.getProductionEnvelope().productionRevision).toBe(11);
    expect(store.getProductionEnvelope().tree).toEqual(modifiedDraftTree);
    expect(sessionStore.getSession('fatal')?.state).toBe('ERROR_LOCKED');
    expect(dedication.safetySnapshots.size).toBe(1);
  });

  it('3.1 safety snapshot is delete-on-consume', () => {
    const snapshot = dedication.pipelinePort.createSafetySnapshot();
    expect(snapshot.success).toBe(true);
    if (!snapshot.success) return;
    expect(
      dedication.restorePort.restoreProduction(snapshot.safetySnapshotId, 10).success
    ).toBe(true);
    expect(
      dedication.restorePort.restoreProduction(snapshot.safetySnapshotId, 10).success
    ).toBe(false);
  });

  it('3.2 dispose warning does not reverse committed Production', () => {
    setupSessionWithMutation('dispose');
    injector.failSnapshotDispose = true;
    const result = sessionService.commit('dispose', 'CONTINUE');
    expectCommittedInvariant(result, 1);
    const event = diagnosticPort.recordedEvents.find(
      (item) => item.errorCode === 'V2_COM_SNAPSHOT_DISPOSE_FAILED_001'
    );
    expect(event).toBeDefined();
    expect(event?.severity).toBe('LEVEL_1_WARNING');
    expect(event?.finalSystemState).toBe('PRODUCTION_COMMITTED');
  });

  it('4.1 SUCCESS_CONTINUE -> ACTIVE with clean new baseline', () => {
    setupSessionWithMutation('continue');
    const result = sessionService.commit('continue', 'CONTINUE');
    expectCommittedInvariant(result);
    if (result.accepted && result.pipelineResult.transactionOutcome === 'COMMITTED') {
      expect(result.pipelineResult.wrapUpOutcome).toBe('CONTINUED');
    }
    expect(sessionStore.getSession('continue')?.state).toBe('ACTIVE');
    expect(sessionStore.getSession('continue')?.isDirty).toBe(false);
    expect(draftStore.getReadonlyDraftSnapshot('continue')).toEqual(modifiedDraftTree);
  });

  it('4.2 SUCCESS_EXIT -> CLOSED and removed', () => {
    setupSessionWithMutation('exit');
    const result = sessionService.commit('exit', 'EXIT');
    expectCommittedInvariant(result);
    if (result.accepted && result.pipelineResult.transactionOutcome === 'COMMITTED') {
      expect(result.pipelineResult.wrapUpOutcome).toBe('EXITED');
    }
    expect(sessionStore.getSession('exit')).toBeNull();
    expect(draftStore.getReadonlyDraftSnapshot('exit')).toBeNull();
  });

  it('4.3 WRAP_UP_FAILED never reverses committed Production', () => {
    setupSessionWithMutation('never-reverse');
    injector.failStep17Continue = true;
    const result = sessionService.commit('never-reverse', 'CONTINUE');
    expectCommittedInvariant(result);
    if (result.accepted && result.pipelineResult.transactionOutcome === 'COMMITTED') {
      expect(result.pipelineResult.wrapUpOutcome).toBe('WRAP_UP_FAILED');
    }
    expect(dedication.rollbackCallCount).toBe(0);
    expect(store.getProductionEnvelope().productionRevision).toBe(11);
    expect(store.getProductionEnvelope().tree).toEqual(modifiedDraftTree);
    expect(sessionStore.getSession('never-reverse')?.state).toBe('ERROR_LOCKED');
  });

  it('4.4 RETAIN failure converges to ERROR_LOCKED', () => {
    setupSessionWithMutation('retain-fail');
    injector.failStep1Duplicate = true;
    injector.failRetain = true;
    const result = sessionService.commit('retain-fail', 'CONTINUE');
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.pipelineResult.transactionOutcome).toBe('BLOCKED');
    }
    expect(store.getProductionEnvelope().productionRevision).toBe(10);
    expect(dedication.rollbackCallCount).toBe(0);
    expect(sessionStore.getSession('retain-fail')?.state).toBe('ERROR_LOCKED');
  });
});

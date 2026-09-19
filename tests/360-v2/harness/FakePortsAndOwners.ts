import type { FailureInjectionController } from './FailureInjectionController';
import type {
  DiagnosticEvent,
  DiagnosticRecordOutput,
  ExecutionRecoveryPlan,
  IDiagnosticObservationPort,
} from '../../../src/types/diagnostic';
import type {
  DeepReadonly,
  FrozenDraftSnapshot,
  ICommitPipelineDedicatedPort,
} from '../../../src/types/pipeline';
import type { ConfigurationTree } from '../../../src/types/editor';
import type {
  IProductionConfigReadPort,
  IProductionRestorePort,
  ISafetySnapshotDisposerPort,
} from '../../../src/governance/ProductionConfigStore';
import type { IRecoveryExecutor } from '../../../src/pipeline/ProductionTransactionCoordinator';

const cloneTree = (
  tree: DeepReadonly<ConfigurationTree> | ConfigurationTree
): ConfigurationTree => structuredClone(tree) as ConfigurationTree;

export class FakeProductionStore implements IProductionConfigReadPort {
  private revision = 10;
  private tree: ConfigurationTree = {
    schemaVersion: '2.0',
    global: {
      governanceIntent: 'ENABLED',
      capabilities: {},
    },
    surfaces: {
      surf_1: {
        surfaceId: 'surf_1',
        governanceIntent: 'ENABLED',
        modules: {
          mod_1: {
            moduleId: 'mod_1',
            moduleType: 'CUSTOM',
            governanceIntent: 'ENABLED',
            capabilities: {},
          },
        },
      },
    },
  };

  getProductionEnvelope() {
    return {
      productionRevision: this.revision,
      tree: cloneTree(this.tree) as DeepReadonly<ConfigurationTree>,
    };
  }

  internalAtomicReplace(newTree: DeepReadonly<ConfigurationTree> | ConfigurationTree): number {
    this.revision += 1;
    this.tree = cloneTree(newTree);
    return this.revision;
  }

  internalRestoreExact(tree: ConfigurationTree, targetRevision: number): void {
    this.revision = targetRevision;
    this.tree = cloneTree(tree);
  }
}

export class FakeDedicatedProductionAccess {
  readonly safetySnapshots = new Map<
    string,
    { readonly revision: number; readonly tree: ConfigurationTree }
  >();
  rollbackCallCount = 0;

  constructor(
    private store: FakeProductionStore,
    private injector: FailureInjectionController
  ) {}

  readonly pipelinePort: ICommitPipelineDedicatedPort = {
    verifyProductionVersionConflict: (baseRevision) => {
      const current = this.store.getProductionEnvelope().productionRevision;
      return {
        hasConflict: baseRevision !== current,
        currentProductionRevision: current,
      };
    },
    createSafetySnapshot: () => {
      if (this.injector.failStep11SafetySnapshot) {
        return {
          success: false,
          errorCode: 'V2_COM_SAFETY_SNAPSHOT_FAILED_001',
        };
      }
      const env = this.store.getProductionEnvelope();
      const safetySnapshotId = `safety_${crypto.randomUUID()}`;
      this.safetySnapshots.set(safetySnapshotId, {
        revision: env.productionRevision,
        tree: cloneTree(env.tree),
      });
      return { success: true, safetySnapshotId };
    },
    atomicReplaceProduction: (
      snapshot: FrozenDraftSnapshot,
      expectedOldRevision: number
    ) => {
      if (this.injector.failStep12AtomicReplace) {
        return {
          success: false,
          errorCode: 'V2_COM_ATOMIC_REPLACE_FAILED_001',
        };
      }
      const current = this.store.getProductionEnvelope().productionRevision;
      if (current !== expectedOldRevision) {
        return {
          success: false,
          errorCode: 'V2_COM_VERSION_CONFLICT_001',
        };
      }
      return {
        success: true,
        newProductionRevision: this.store.internalAtomicReplace(snapshot.frozenTree),
      };
    },
  };

  readonly restorePort: IProductionRestorePort = {
    restoreProduction: (snapshotId, targetOldRevision) => {
      this.rollbackCallCount += 1;
      if (this.injector.failLevel3Recovery) return { success: false };
      const snapshot = this.safetySnapshots.get(snapshotId);
      if (!snapshot || snapshot.revision !== targetOldRevision) {
        return { success: false };
      }
      this.store.internalRestoreExact(snapshot.tree, targetOldRevision);
      this.safetySnapshots.delete(snapshotId);
      return { success: true };
    },
  };

  readonly disposerPort: ISafetySnapshotDisposerPort = {
    dispose: (snapshotId) => {
      if (this.injector.failSnapshotDispose) return { success: false };
      return { success: this.safetySnapshots.delete(snapshotId) };
    },
  };
}

export class FakeRecoveryExecutor implements IRecoveryExecutor {
  lastPlan: ExecutionRecoveryPlan | null = null;

  constructor(private access: FakeDedicatedProductionAccess) {}

  executePlan(plan: ExecutionRecoveryPlan): { readonly success: boolean } {
    this.lastPlan = plan;
    if (plan.level !== 'LEVEL_3_TRANSACTION_ROLLBACK') {
      return { success: false };
    }
    return this.access.restorePort.restoreProduction(
      plan.safetySnapshotId,
      plan.targetOldRevision
    );
  }
}

export class FakeDiagnosticPort implements IDiagnosticObservationPort {
  readonly recordedEvents: DiagnosticEvent[] = [];

  recordEvent(
    event: Omit<DiagnosticEvent, 'eventId' | 'timestamp'>
  ): DiagnosticRecordOutput {
    const fullEvent: DiagnosticEvent = {
      eventId: `diag_${crypto.randomUUID()}`,
      timestamp: Date.now(),
      ...event,
    };
    this.recordedEvents.push(fullEvent);
    return { success: true, event: fullEvent };
  }
}

import type { ConfigurationTree } from '../types/editor';
import type { DeepReadonly, FrozenDraftSnapshot, ICommitPipelineDedicatedPort } from '../types/pipeline';

const cloneTree = (tree: DeepReadonly<ConfigurationTree>): ConfigurationTree =>
  structuredClone(tree) as ConfigurationTree;

export interface IProductionConfigReadPort {
  getProductionEnvelope(): {
    readonly productionRevision: number;
    readonly tree: DeepReadonly<ConfigurationTree>;
  };
}

export interface IProductionRestorePort {
  restoreProduction(snapshotId: string, targetOldRevision: number): { readonly success: boolean };
}

export interface ISafetySnapshotDisposerPort {
  dispose(snapshotId: string): { readonly success: boolean };
}

class ProductionConfigStore implements IProductionConfigReadPort {
  private revision = 1;
  private tree: ConfigurationTree;

  constructor(initialTree: ConfigurationTree) {
    this.tree = structuredClone(initialTree);
  }

  getProductionEnvelope() {
    return {
      productionRevision: this.revision,
      tree: cloneTree(this.tree) as DeepReadonly<ConfigurationTree>,
    };
  }

  replace(tree: DeepReadonly<ConfigurationTree>): number {
    this.revision += 1;
    this.tree = cloneTree(tree);
    return this.revision;
  }

  restoreExact(tree: ConfigurationTree, revision: number): void {
    this.tree = structuredClone(tree);
    this.revision = revision;
  }
}

export interface DedicatedProductionAccess {
  readonly readPort: IProductionConfigReadPort;
  readonly pipelinePort: ICommitPipelineDedicatedPort;
  readonly restorePort: IProductionRestorePort;
  readonly disposerPort: ISafetySnapshotDisposerPort;
}

export const createDedicatedProductionAccess = (
  initialTree: ConfigurationTree
): DedicatedProductionAccess => {
  const store = new ProductionConfigStore(initialTree);
  const snapshots = new Map<string, { revision: number; tree: ConfigurationTree }>();

  const pipelinePort: ICommitPipelineDedicatedPort = {
    verifyProductionVersionConflict(baseRevision) {
      const current = store.getProductionEnvelope().productionRevision;
      return {
        hasConflict: current !== baseRevision,
        currentProductionRevision: current,
      };
    },
    createSafetySnapshot() {
      const env = store.getProductionEnvelope();
      const id = `safety_${crypto.randomUUID()}`;
      snapshots.set(id, {
        revision: env.productionRevision,
        tree: cloneTree(env.tree),
      });
      return { success: true, safetySnapshotId: id };
    },
    atomicReplaceProduction(snapshot: FrozenDraftSnapshot, expectedOldRevision: number) {
      const env = store.getProductionEnvelope();
      if (env.productionRevision !== expectedOldRevision) {
        return {
          success: false,
          errorCode: 'V2_COM_VERSION_CONFLICT_001',
        };
      }
      const newProductionRevision = store.replace(snapshot.frozenTree);
      return { success: true, newProductionRevision };
    },
  };

  const restorePort: IProductionRestorePort = {
    restoreProduction(snapshotId, targetOldRevision) {
      const snapshot = snapshots.get(snapshotId);
      if (!snapshot || snapshot.revision !== targetOldRevision) return { success: false };
      store.restoreExact(snapshot.tree, targetOldRevision);
      snapshots.delete(snapshotId);
      return { success: true };
    },
  };

  const disposerPort: ISafetySnapshotDisposerPort = {
    dispose(snapshotId) {
      return { success: snapshots.delete(snapshotId) };
    },
  };

  return { readPort: store, pipelinePort, restorePort, disposerPort };
};

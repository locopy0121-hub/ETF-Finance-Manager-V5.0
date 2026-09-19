import type { ConfigurationTree } from '../types/editor';
import type { DeepReadonly } from '../types/pipeline';

interface Sandbox {
  readonly sessionId: string;
  readonly sandboxToken: string;
  readonly baselineTree: ConfigurationTree;
  readonly draftBaseRevision: number;
  tree: ConfigurationTree;
}

interface PreparedReplacement {
  readonly replacementId: string;
  readonly sessionId: string;
  readonly draftBaseRevision: number;
  readonly sandboxToken: string;
  readonly tree: ConfigurationTree;
}

const cloneTree = (tree: DeepReadonly<ConfigurationTree> | ConfigurationTree): ConfigurationTree =>
  structuredClone(tree) as ConfigurationTree;

export class DraftSandboxStore {
  private sandboxes = new Map<string, Sandbox>();
  private replacements = new Map<string, PreparedReplacement>();

  initializeDraft(
    sessionId: string,
    draftBaseRevision: number,
    productionTree: DeepReadonly<ConfigurationTree>
  ): {
    readonly draftBaseRevision: number;
    readonly sandboxToken: string;
  } {
    const sandboxToken = `sandbox_${crypto.randomUUID()}`;
    const tree = cloneTree(productionTree);
    this.sandboxes.set(sessionId, {
      sessionId,
      sandboxToken,
      draftBaseRevision,
      baselineTree: cloneTree(productionTree),
      tree,
    });
    return { draftBaseRevision, sandboxToken };
  }

  getReadonlyDraftSnapshot(sessionId: string): DeepReadonly<ConfigurationTree> | null {
    const sandbox = this.sandboxes.get(sessionId);
    return sandbox ? cloneTree(sandbox.tree) as DeepReadonly<ConfigurationTree> : null;
  }

  getSessionBaselineSnapshot(sessionId: string): DeepReadonly<ConfigurationTree> | null {
    const sandbox = this.sandboxes.get(sessionId);
    return sandbox ? cloneTree(sandbox.baselineTree) as DeepReadonly<ConfigurationTree> : null;
  }

  getDraftBaseRevision(sessionId: string): number | null {
    return this.sandboxes.get(sessionId)?.draftBaseRevision ?? null;
  }

  getSandboxToken(sessionId: string): string | null {
    return this.sandboxes.get(sessionId)?.sandboxToken ?? null;
  }

  applyTransactionalMutation<T>(
    sessionId: string,
    mutation: (workingTree: ConfigurationTree) => {
      readonly success: boolean;
      readonly result: T;
    }
  ): { readonly success: boolean; readonly result?: T } {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return { success: false };
    const working = cloneTree(sandbox.tree);
    const result = mutation(working);
    if (!result.success) return { success: false, result: result.result };
    sandbox.tree = working;
    return { success: true, result: result.result };
  }

  freezeDraftForCommit(sessionId: string):
    | {
        readonly success: true;
        readonly snapshot: {
          readonly schemaVersion: string;
          readonly frozenTree: DeepReadonly<ConfigurationTree>;
          readonly snapshotId: string;
        };
      }
    | { readonly success: false; readonly errorCode: string } {
    const sandbox = this.sandboxes.get(sessionId);
    if (!sandbox) return { success: false, errorCode: 'V2_COM_DRAFT_NOT_FOUND_001' };
    return {
      success: true,
      snapshot: {
        schemaVersion: sandbox.tree.schemaVersion,
        frozenTree: cloneTree(sandbox.tree) as DeepReadonly<ConfigurationTree>,
        snapshotId: `frozen_${crypto.randomUUID()}`,
      },
    };
  }

  prepareSandboxReplacement(
    sessionId: string,
    draftBaseRevision: number,
    productionTree: DeepReadonly<ConfigurationTree>
  ): {
    readonly success: true;
    readonly output: {
      readonly replacementId: string;
      readonly draftBaseRevision: number;
      readonly sandboxToken: string;
    };
  } | { readonly success: false } {
    if (!this.sandboxes.has(sessionId)) return { success: false };
    const replacementId = `replacement_${crypto.randomUUID()}`;
    const sandboxToken = `sandbox_${crypto.randomUUID()}`;
    this.replacements.set(replacementId, {
      replacementId,
      sessionId,
      draftBaseRevision,
      sandboxToken,
      tree: cloneTree(productionTree),
    });
    return {
      success: true,
      output: { replacementId, draftBaseRevision, sandboxToken },
    };
  }

  commitSandboxReplacement(replacementId: string): boolean {
    const candidate = this.replacements.get(replacementId);
    if (!candidate) return false;
    this.sandboxes.set(candidate.sessionId, {
      sessionId: candidate.sessionId,
      sandboxToken: candidate.sandboxToken,
      draftBaseRevision: candidate.draftBaseRevision,
      baselineTree: cloneTree(candidate.tree),
      tree: cloneTree(candidate.tree),
    });
    this.replacements.delete(replacementId);
    return true;
  }

  discardPreparedReplacement(replacementId: string): void {
    this.replacements.delete(replacementId);
  }

  clearDraft(sessionId: string): void {
    this.sandboxes.delete(sessionId);
    for (const [id, candidate] of this.replacements) {
      if (candidate.sessionId === sessionId) this.replacements.delete(id);
    }
  }
}

import type { DeepReadonly, FrozenDraftSnapshot } from '../types/pipeline';
import type { ConfigurationTree } from '../types/editor';
import { DraftSandboxStore } from './DraftSandboxStore';

export interface IGovernanceCommitPreparationPort {
  checkDuplicateSubmitGate(sessionId: string): { readonly isDuplicate: boolean };
  releaseDuplicateSubmitGate(sessionId: string): void;
  freezeDraftForCommit(sessionId: string):
    | { readonly success: true; readonly snapshot: FrozenDraftSnapshot }
    | { readonly success: false; readonly errorCode: string };
  getSessionBaselineSnapshot(sessionId: string): DeepReadonly<ConfigurationTree> | null;
}

export class GovernanceCommitPreparationPort implements IGovernanceCommitPreparationPort {
  private activeCommitSessions = new Set<string>();

  constructor(private draftStore: DraftSandboxStore) {}

  checkDuplicateSubmitGate(sessionId: string): { readonly isDuplicate: boolean } {
    if (this.activeCommitSessions.has(sessionId)) return { isDuplicate: true };
    this.activeCommitSessions.add(sessionId);
    return { isDuplicate: false };
  }

  releaseDuplicateSubmitGate(sessionId: string): void {
    this.activeCommitSessions.delete(sessionId);
  }

  freezeDraftForCommit(sessionId: string):
    | { readonly success: true; readonly snapshot: FrozenDraftSnapshot }
    | { readonly success: false; readonly errorCode: string } {
    const freeze = this.draftStore.freezeDraftForCommit(sessionId);
    if (!freeze.success) return freeze;
    const draftBaseRevision = this.draftStore.getDraftBaseRevision(sessionId);
    if (draftBaseRevision === null) {
      return { success: false, errorCode: 'V2_COM_BASELINE_NOT_FOUND_001' };
    }
    return {
      success: true,
      snapshot: {
        sessionId,
        draftBaseRevision,
        schemaVersion: freeze.snapshot.schemaVersion,
        frozenTree: freeze.snapshot.frozenTree,
        snapshotId: freeze.snapshot.snapshotId,
      },
    };
  }

  getSessionBaselineSnapshot(sessionId: string): DeepReadonly<ConfigurationTree> | null {
    return this.draftStore.getSessionBaselineSnapshot(sessionId);
  }
}

import type { IDiagnosticObservationPort } from '../types/diagnostic';
import type { SessionMutationRequest, SessionMutationResult } from '../types/session';
import type { IRegistryContractProvider } from './FiveLayerConfigResolver';
import { computeCanonicalFingerprint } from './CanonicalFingerprint';
import { DraftSandboxStore } from './DraftSandboxStore';

const splitPath = (path: string): readonly string[] =>
  path.split('.').map((part) => part.trim()).filter(Boolean);

export class ConfigGovernanceMutationPort {
  constructor(
    private draftStore: DraftSandboxStore,
    private registryProvider: IRegistryContractProvider,
    private diagnosticPort: IDiagnosticObservationPort
  ) {
    void this.registryProvider;
    void this.diagnosticPort;
  }

  dispatchMutation(request: SessionMutationRequest): SessionMutationResult {
    const currentBase = this.draftStore.getDraftBaseRevision(request.sessionId);
    if (currentBase === null) {
      return { success: false, errorCode: 'V2_CFG_DRAFT_NOT_FOUND_001' };
    }
    if (currentBase !== request.draftBaseRevision) {
      return { success: false, errorCode: 'V2_CFG_STALE_DRAFT_REVISION_001' };
    }

    const before = this.draftStore.getReadonlyDraftSnapshot(request.sessionId);
    if (!before) return { success: false, errorCode: 'V2_CFG_DRAFT_NOT_FOUND_001' };

    const mutationId = `mut_${crypto.randomUUID()}`;
    const result = this.draftStore.applyTransactionalMutation(
      request.sessionId,
      (workingTree) => {
        const path = splitPath(request.targetPath);
        if (request.kind === 'SET_GOVERNANCE_INTENT') {
          if (
            path.length === 2 &&
            path[0] === 'surfaces' &&
            workingTree.surfaces[path[1]]
          ) {
            const current = workingTree.surfaces[path[1]];
            workingTree.surfaces = {
              ...workingTree.surfaces,
              [path[1]]: { ...current, governanceIntent: request.governanceIntent },
            };
            return { success: true, result: undefined };
          }
          return { success: false, result: undefined };
        }
        return { success: false, result: undefined };
      }
    );

    if (!result.success) {
      return { success: false, errorCode: 'V2_CFG_INVALID_TARGET_001' };
    }

    const after = this.draftStore.getReadonlyDraftSnapshot(request.sessionId);
    const hasRealDifference =
      after !== null &&
      computeCanonicalFingerprint(before) !== computeCanonicalFingerprint(after);

    return { success: true, mutationId, hasRealDifference };
  }
}

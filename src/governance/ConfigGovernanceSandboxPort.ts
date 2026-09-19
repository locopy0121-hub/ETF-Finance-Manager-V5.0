import type { IRegistryContractProvider } from './FiveLayerConfigResolver';
import type { IProductionConfigReadPort } from './ProductionConfigStore';
import { DraftSandboxStore } from './DraftSandboxStore';

export class ConfigGovernanceSandboxPort {
  constructor(
    private productionReadPort: IProductionConfigReadPort,
    private draftStore: DraftSandboxStore,
    private registryProvider: IRegistryContractProvider
  ) {
    void this.registryProvider;
  }

  initializeDraftSandbox(sessionId: string) {
    const env = this.productionReadPort.getProductionEnvelope();
    return this.draftStore.initializeDraft(
      sessionId,
      env.productionRevision,
      env.tree
    );
  }

  getSessionBaselineSnapshot(sessionId: string) {
    return this.draftStore.getSessionBaselineSnapshot(sessionId);
  }

  prepareContinueSandboxReplacement(sessionId: string) {
    const env = this.productionReadPort.getProductionEnvelope();
    return this.draftStore.prepareSandboxReplacement(
      sessionId,
      env.productionRevision,
      env.tree
    );
  }

  commitContinueSandboxReplacement(replacementId: string): boolean {
    return this.draftStore.commitSandboxReplacement(replacementId);
  }

  discardContinueSandboxReplacement(replacementId: string): void {
    this.draftStore.discardPreparedReplacement(replacementId);
  }

  clearDraftSandbox(sessionId: string): void {
    this.draftStore.clearDraft(sessionId);
  }
}

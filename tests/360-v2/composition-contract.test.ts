import { describe, expect, it } from 'vitest';
import type { ConfigurationTree } from '../../src/types/editor';
import type { IRegistryContractProvider } from '../../src/governance/FiveLayerConfigResolver';
import { createDedicatedProductionAccess } from '../../src/governance/ProductionConfigStore';
import { DraftSandboxStore } from '../../src/governance/DraftSandboxStore';
import { ConfigGovernanceSandboxPort } from '../../src/governance/ConfigGovernanceSandboxPort';
import { ConfigGovernanceMutationPort } from '../../src/governance/ConfigGovernanceMutationPort';
import { GovernanceCommitPreparationPort } from '../../src/governance/GovernanceCommitPreparationPort';
import { EditingSessionStore } from '../../src/session/EditingSessionStore';
import { SessionMutationPort } from '../../src/session/SessionMutationPort';
import { SessionCommitWrapUpPortImpl } from '../../src/session/SessionCommitWrapUpPortImpl';
import { EditingSessionService } from '../../src/session/EditingSessionService';
import { CommitValidationCoordinator } from '../../src/pipeline/CommitValidationCoordinator';
import { ProductionTransactionCoordinator } from '../../src/pipeline/ProductionTransactionCoordinator';
import { CommitPipelineExecutor } from '../../src/pipeline/CommitPipelineExecutor';
import { FakeDiagnosticPort } from './harness/FakePortsAndOwners';

describe('360 Editor V2 composition contract', () => {
  it('assembles A/B/C with strict public ports and zero any', () => {
    const initialTree: ConfigurationTree = {
      schemaVersion: '2.0',
      global: { governanceIntent: 'ENABLED', capabilities: {} },
      surfaces: {},
    };
    const production = createDedicatedProductionAccess(initialTree);
    const draftStore = new DraftSandboxStore();
    const registry: IRegistryContractProvider = {
      getCapabilityPermission: () => 'EDITABLE',
      getPropertyPermission: () => 'EDITABLE',
      getRequiredEnvironmentFacts: () => [],
    };
    const diagnostic = new FakeDiagnosticPort();
    const sandbox = new ConfigGovernanceSandboxPort(
      production.readPort,
      draftStore,
      registry
    );
    const mutation = new ConfigGovernanceMutationPort(
      draftStore,
      registry,
      diagnostic
    );
    const sessionStore = new EditingSessionStore();
    const sessionMutation = new SessionMutationPort(sessionStore, mutation);
    const prep = new GovernanceCommitPreparationPort(draftStore);
    const pass = { validate: () => ({ success: true as const }) };
    const validation = new CommitValidationCoordinator(
      prep,
      production.readPort,
      diagnostic,
      {
        needsMigration: () => false,
        migrate: (snapshot) => ({
          success: true as const,
          migratedSnapshot: snapshot,
        }),
      },
      pass,
      pass,
      pass,
      pass,
      pass
    );
    const transaction = new ProductionTransactionCoordinator(
      production.pipelinePort,
      {
        executePlan: (plan) =>
          plan.level === 'LEVEL_3_TRANSACTION_ROLLBACK'
            ? production.restorePort.restoreProduction(
                plan.safetySnapshotId,
                plan.targetOldRevision
              )
            : { success: false },
      },
      {
        resolveProduction: () => ({
          success: true as const,
          effectiveContext: {},
        }),
      },
      { activate: () => ({ success: true }) },
      { sync: () => ({ success: true }) },
      { writeRecord: () => ({ success: true }) }
    );
    const wrapUp = new SessionCommitWrapUpPortImpl(sessionStore, sandbox);
    const pipeline = new CommitPipelineExecutor(
      validation,
      transaction,
      wrapUp,
      production.disposerPort,
      diagnostic
    );
    const service = new EditingSessionService(
      sessionStore,
      sandbox,
      sessionMutation,
      pipeline
    );
    expect(service).toBeDefined();
  });
});

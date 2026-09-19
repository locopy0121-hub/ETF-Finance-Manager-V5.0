export type GovernanceIntent = 'ENABLED' | 'DISABLED' | 'READ_ONLY';

export type ConfigValue =
  | null
  | boolean
  | number
  | string
  | bigint
  | readonly ConfigValue[]
  | { readonly [key: string]: ConfigValue };

export interface PersistedPropertyNode {
  readonly propertyKey: string;
  readonly value: ConfigValue;
  readonly governanceIntent: GovernanceIntent;
}

export interface PersistedCapabilityNode {
  readonly capabilityId: string;
  readonly version: number;
  readonly governanceIntent: GovernanceIntent;
  readonly properties: Readonly<Record<string, PersistedPropertyNode>>;
}

export interface PersistedModuleNode {
  readonly moduleId: string;
  readonly moduleType: string;
  readonly governanceIntent: GovernanceIntent;
  readonly capabilities: Readonly<Record<string, PersistedCapabilityNode>>;
}

export interface PersistedSurfaceNode {
  readonly surfaceId: string;
  readonly governanceIntent: GovernanceIntent;
  readonly modules: Readonly<Record<string, PersistedModuleNode>>;
}

export interface PersistedGlobalNode {
  readonly governanceIntent: GovernanceIntent;
  readonly capabilities: Readonly<Record<string, PersistedCapabilityNode>>;
}

export interface ConfigurationTree {
  readonly schemaVersion: string;
  readonly global: PersistedGlobalNode;
  readonly surfaces: Readonly<Record<string, PersistedSurfaceNode>>;
}

export type RegistryPermission = 'EDITABLE' | 'READ_ONLY' | 'SYSTEM_LOCKED';

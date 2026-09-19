import type { RegistryPermission } from '../types/editor';

export interface IRegistryContractProvider {
  getCapabilityPermission(capabilityId: string): RegistryPermission;
  getPropertyPermission(capabilityId: string, propertyKey: string): RegistryPermission;
  getRequiredEnvironmentFacts(capabilityId: string): readonly string[];
}

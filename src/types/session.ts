import type { ConfigValue, GovernanceIntent } from './editor';

export type EditingSessionState =
  | 'INITIALIZING'
  | 'ACTIVE'
  | 'COMMITTING'
  | 'CLOSED'
  | 'ERROR_LOCKED';

export type SessionMutationRequest =
  | {
      readonly kind: 'UPDATE_PROPERTY_VALUE';
      readonly sessionId: string;
      readonly draftBaseRevision: number;
      readonly targetPath: string;
      readonly value: ConfigValue;
    }
  | {
      readonly kind: 'SET_GOVERNANCE_INTENT';
      readonly sessionId: string;
      readonly draftBaseRevision: number;
      readonly targetPath: string;
      readonly governanceIntent: GovernanceIntent;
    };

export type SessionMutationResult =
  | {
      readonly success: true;
      readonly mutationId: string;
      readonly hasRealDifference: boolean;
    }
  | {
      readonly success: false;
      readonly errorCode: string;
      readonly diagnosticEventId?: string;
    };

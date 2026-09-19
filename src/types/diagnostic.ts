export type DiagnosticSeverity =
  | 'LEVEL_1_WARNING'
  | 'LEVEL_2_BLOCKING'
  | 'LEVEL_3_ROLLBACK'
  | 'LEVEL_4_SAFE_MODE';

export interface DiagnosticEvent {
  readonly eventId: string;
  readonly groupId: string;
  readonly errorCode: string;
  readonly severity: DiagnosticSeverity;
  readonly lifecycleStage: string;
  readonly ruleViolated: string;
  readonly actionTaken: string;
  readonly timestamp: number;
  readonly finalSystemState: string;
  readonly domain: string;
  readonly displayTier: string;
  readonly associatedSessionId?: string;
  readonly userMessageKey?: string;
}

export type DiagnosticRecordOutput =
  | { readonly success: true; readonly event: DiagnosticEvent }
  | { readonly success: false };

export interface IDiagnosticObservationPort {
  recordEvent(event: Omit<DiagnosticEvent, 'eventId' | 'timestamp'>): DiagnosticRecordOutput;
}

export type ExecutionRecoveryPlan =
  | {
      readonly level: 'LEVEL_3_TRANSACTION_ROLLBACK';
      readonly incidentId: string;
      readonly safetySnapshotId: string;
      readonly targetOldRevision: number;
    }
  | {
      readonly level: 'LEVEL_4_SYSTEM_SAFE_MODE';
      readonly incidentId: string;
      readonly safeMode: 'READ_ONLY_SAFE_MODE' | 'SAFE_DEGRADED_MODE';
    };

import type { EditingSessionState } from '../types/session';

export interface EditingSessionEntity {
  readonly sessionId: string;
  readonly userId: string;
  readonly draftBaseRevision: number;
  readonly sandboxToken: string;
  readonly state: EditingSessionState;
  readonly isDirty: boolean;
  readonly createdAt: number;
  readonly lastActiveAt: number;
}

export class EditingSessionStore {
  private sessions = new Map<string, EditingSessionEntity>();

  createSession(
    sessionId: string,
    userId: string,
    draftBaseRevision: number,
    sandboxToken: string
  ): EditingSessionEntity {
    const now = Date.now();
    const entity: EditingSessionEntity = {
      sessionId,
      userId,
      draftBaseRevision,
      sandboxToken,
      state: 'INITIALIZING',
      isDirty: false,
      createdAt: now,
      lastActiveAt: now,
    };
    this.sessions.set(sessionId, entity);
    return { ...entity };
  }

  getSession(sessionId: string): EditingSessionEntity | null {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  updateState(sessionId: string, state: EditingSessionState): void {
    const current = this.sessions.get(sessionId);
    if (!current) return;
    this.sessions.set(sessionId, {
      ...current,
      state,
      lastActiveAt: Date.now(),
    });
  }

  updateDirty(sessionId: string, isDirty: boolean): void {
    const current = this.sessions.get(sessionId);
    if (!current) return;
    this.sessions.set(sessionId, {
      ...current,
      isDirty,
      lastActiveAt: Date.now(),
    });
  }

  replaceBaselineAfterCommit(
    sessionId: string,
    draftBaseRevision: number,
    sandboxToken: string
  ): void {
    const current = this.sessions.get(sessionId);
    if (!current) throw new Error('V2_INT_SESSION_NOT_FOUND_001');
    this.sessions.set(sessionId, {
      ...current,
      draftBaseRevision,
      sandboxToken,
      isDirty: false,
      lastActiveAt: Date.now(),
    });
  }

  restoreSessionEntitySnapshot(snapshot: EditingSessionEntity): void {
    this.sessions.set(snapshot.sessionId, { ...snapshot });
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

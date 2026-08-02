export type DraftSyncOperationType = "saveDraft";

export type DraftSyncOperation = {
  id: string;
  type: DraftSyncOperationType;
  createdAt: string;
};

export type DraftRemoteConflict = {
  detectedAt: string;
  remoteUpdatedAt: string;
  lastSyncedRemoteAt: string | null;
};

export function createDraftSyncOperation(type: DraftSyncOperationType, createdAt = new Date().toISOString()): DraftSyncOperation {
  return {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    createdAt
  };
}

export function enqueueDraftSyncOperation(
  operations: DraftSyncOperation[],
  operation: DraftSyncOperation,
  maxOperations = 20
): DraftSyncOperation[] {
  const next = [...operations, operation];
  if (next.length <= maxOperations) {
    return next;
  }
  return next.slice(next.length - maxOperations);
}

export function clearDraftSyncOperations(): DraftSyncOperation[] {
  return [];
}

export function hasPendingDraftSyncOperations(operations: DraftSyncOperation[]): boolean {
  return operations.length > 0;
}

export function shouldCreateDraftConflict(input: {
  remoteUpdatedAt: string | null;
  lastSyncedRemoteAt: string | null;
  pendingOperationsCount: number;
}): boolean {
  if (input.pendingOperationsCount === 0 || !input.remoteUpdatedAt) {
    return false;
  }
  if (!input.lastSyncedRemoteAt) {
    return true;
  }

  const remoteTimestamp = Date.parse(input.remoteUpdatedAt);
  const localTimestamp = Date.parse(input.lastSyncedRemoteAt);
  if (!Number.isFinite(remoteTimestamp) || !Number.isFinite(localTimestamp)) {
    return false;
  }
  return remoteTimestamp > localTimestamp;
}

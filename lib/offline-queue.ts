import {
  SupportedLocale,
  SafetySeverity,
  scrubPii,
  evaluateSafetyPreCheck,
} from './adaptive-router';

export type OfflineQueueStatus =
  | 'QUEUED_OFFLINE'
  | 'SYNCING'
  | 'FLUSHED_TO_CLOUD';

export interface OfflineForensicQueueItem {
  id: string;
  createdAtIso: string;
  flushedAtIso?: string;
  locale: SupportedLocale;
  faultCode: string;
  severity: SafetySeverity;
  extractedTempC: number | null;
  extractedIsolationKOhm: number | null;
  sanitizedPayload: string;
  redactionCount: number;
  requestedModel: string;
  status: OfflineQueueStatus;
  auditSummary?: string;
}

const STORAGE_KEY = 'qnx_sentinel_offline_escalation_queue_v2';
const IDB_NAME = 'qnx_sentinel_offline_db';
const IDB_STORE = 'offline_forensic_queue';

function writeQueueToIndexedDb(items: OfflineForensicQueueItem[]): void {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => db.close();
    };
  } catch {
    // Fallback to localStorage only
  }
}

export function getOfflineQueue(): OfflineForensicQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineForensicQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items: OfflineForensicQueueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    writeQueueToIndexedDb(items);
  } catch {
    // Ignore storage quota errors in private browsing mode
  }
}

/**
 * Enqueues a PII-scrubbed Cloud Forensics audit payload into `localStorage` + `IndexedDB`
 * with status `QUEUED_OFFLINE` when the operator is offline (`ONLY_ON_DEVICE` routing mode).
 */
export function enqueueOfflineForensicsRequest(params: {
  rawInput: string;
  locale: SupportedLocale;
  requestedModel?: string;
}): OfflineForensicQueueItem {
  const pii = scrubPii(params.rawInput);
  const safety = evaluateSafetyPreCheck(pii.sanitizedText);

  const newItem: OfflineForensicQueueItem = {
    id: `offline_${safety.faultCode.toLowerCase()}_${Date.now().toString(36)}`,
    createdAtIso: new Date().toISOString(),
    locale: params.locale,
    faultCode: safety.faultCode,
    severity: safety.severity,
    extractedTempC: safety.extractedTempC,
    extractedIsolationKOhm: safety.extractedIsolationKOhm,
    sanitizedPayload: pii.sanitizedText,
    redactionCount: pii.redactionCount,
    requestedModel: params.requestedModel || 'gemini-2.5-flash',
    status: 'QUEUED_OFFLINE',
  };

  const current = getOfflineQueue();
  const updated = [newItem, ...current].slice(0, 15);
  saveOfflineQueue(updated);
  return newItem;
}

/**
 * Flushes all `QUEUED_OFFLINE` items by invoking the provided `firebase/ai` cloud audit callback
 * when connectivity is restored.
 */
export async function flushOfflineForensicsQueue(
  executeCloudAuditForItem: (
    item: OfflineForensicQueueItem
  ) => Promise<{ summary: string }>
): Promise<{
  flushedCount: number;
  updatedQueue: OfflineForensicQueueItem[];
}> {
  const current = getOfflineQueue();
  const pending = current.filter((i) => i.status === 'QUEUED_OFFLINE');
  if (pending.length === 0) {
    return { flushedCount: 0, updatedQueue: current };
  }

  let flushedCount = 0;
  const updatedQueue: OfflineForensicQueueItem[] = [];

  for (const item of current) {
    if (item.status !== 'QUEUED_OFFLINE') {
      updatedQueue.push(item);
      continue;
    }
    try {
      const res = await executeCloudAuditForItem(item);
      flushedCount++;
      updatedQueue.push({
        ...item,
        status: 'FLUSHED_TO_CLOUD',
        flushedAtIso: new Date().toISOString(),
        auditSummary: res.summary,
      });
    } catch {
      updatedQueue.push(item);
    }
  }

  saveOfflineQueue(updatedQueue);
  return { flushedCount, updatedQueue };
}

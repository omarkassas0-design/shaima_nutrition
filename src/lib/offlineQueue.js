/**
 * Offline mutation queue — stores pending create/update/delete operations
 * in localStorage so they survive page reloads while offline.
 *
 * When the connection returns, syncQueue() replays each operation against
 * the authenticated Worker API. Successful items are removed; failed items are retried
 * on the next sync attempt (up to MAX_RETRIES).
 *
 * IMPORTANT: This never pretends a save reached the server. Callers must
 * show "Saved locally — waiting for connection" toasts when enqueueing.
 */

const QUEUE_KEY = 'auradental_offline_queue';
const MAX_RETRIES = 3;

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  // Notify listeners (same-tab)
  window.dispatchEvent(new CustomEvent('offline-queue-changed'));
}

/**
 * Enqueue a pending operation.
 * @param {object} op — { entity, operation: 'create'|'update'|'delete', id?, data? }
 * @returns the queued item (with temp id + timestamp)
 */
export function enqueue(op) {
  const queue = getQueue();
  const item = {
    id: crypto.randomUUID(),
    entity: op.entity,
    operation: op.operation,
    recordId: op.id || null,
    data: op.data || null,
    status: 'pending',
    attempts: 0,
    created_at: new Date().toISOString(),
  };
  queue.push(item);
  saveQueue(queue);
  return item;
}

export function removeFromQueue(itemId) {
  const queue = getQueue().filter((i) => i.id !== itemId);
  saveQueue(queue);
}

function markItem(itemId, updates) {
  const queue = getQueue().map((i) =>
    i.id === itemId ? { ...i, ...updates } : i
  );
  saveQueue(queue);
}

export function getPendingCount() {
  return getQueue().filter((i) => i.status === 'pending' || i.status === 'failed').length;
}

export function getFailedCount() {
  return getQueue().filter((i) => i.status === 'failed').length;
}

/**
 * Process the queue: replay each pending/failed item against the SDK.
 * Returns { synced, failed, conflicts }.
 */
export async function syncQueue(apiClient, queryClient) {
  const queue = getQueue();
  const todo = queue.filter((i) => i.status === 'pending' || i.status === 'failed');
  if (todo.length === 0) return { synced: 0, failed: 0, conflicts: 0 };

  let synced = 0, failed = 0, conflicts = 0;

  for (const item of todo) {
    if (item.attempts >= MAX_RETRIES && item.status === 'failed') {
      continue; // leave permanently failed items for the user to discard
    }

    markItem(item.id, { status: 'syncing' });

    try {
      const entity = apiClient.entities[item.entity];
      if (!entity) throw new Error(`Unknown entity: ${item.entity}`);

      if (item.operation === 'create') {
         
        const { _tempId, ...createData } = item.data || {};
        await entity.create(createData);
      } else if (item.operation === 'update') {
        // Conflict check: fetch server record, compare updated_date
        if (item.recordId) {
          try {
            const server = await entity.get(item.recordId);
            if (server?.updated_date && item.data?.updated_date) {
              if (new Date(server.updated_date) > new Date(item.data.updated_date)) {
                // Server is newer — skip this stale update
                conflicts++;
                markItem(item.id, { status: 'conflict', error: 'Server has newer data' });
                continue;
              }
            }
          } catch (_) {
            // Record may have been deleted server-side — skip
          }
        }
        const updateData = { ...item.data };
        delete updateData.id;
        delete updateData.updated_date;
        delete updateData.created_date;
        await entity.update(item.recordId, updateData);
      } else if (item.operation === 'delete') {
        await entity.delete(item.recordId);
      }

      removeFromQueue(item.id);
      synced++;
    } catch (e) {
      failed++;
      markItem(item.id, {
        status: 'failed',
        error: e?.message || 'Sync failed',
        attempts: (item.attempts || 0) + 1,
      });
    }
  }

  if (synced > 0 && queryClient) {
    queryClient.invalidateQueries();
  }

  return { synced, failed, conflicts };
}

export function clearFailedItems() {
  const queue = getQueue().filter((i) => i.status !== 'failed' && i.status !== 'conflict');
  saveQueue(queue);
}

export function clearAll() {
  saveQueue([]);
}

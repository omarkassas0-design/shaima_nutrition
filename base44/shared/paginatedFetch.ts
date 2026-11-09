/**
 * Fetches ALL records for an entity+query using skip-based pagination.
 *
 * No hard limit — accumulates across batches until the collection is
 * exhausted. Use this instead of filter(query, sort, N) when N is an
 * arbitrary cap that could silently truncate results and produce
 * inaccurate aggregations.
 *
 * For bounded queries (e.g. today's appointments) this is still safe:
 * it fetches one batch and stops when the batch is smaller than the
 * page size.
 *
 * A safety valve of 10,000 iterations (10M records at batchSize 1000)
 * prevents infinite loops on pathological data.
 *
 * Returns the full array of records. If a batch fetch fails, returns
 * whatever was accumulated so far — callers handle empty/partial
 * results gracefully (they never throw on partial data).
 */
export async function fetchAllRecords(
  svc: any,
  entityName: string,
  query: Record<string, any>,
  sort: string | null = null,
  batchSize: number = 1000
): Promise<any[]> {
  const allRecords: any[] = [];
  let skip = 0;
  let hasMore = true;
  const MAX_ITERATIONS = 10000;

  let iterations = 0;
  while (hasMore && iterations < MAX_ITERATIONS) {
    let batch: any[];
    try {
      batch = await svc.entities[entityName].filter(query, sort, batchSize, skip);
    } catch (_e) {
      break;
    }

    if (!Array.isArray(batch)) break;

    allRecords.push(...batch);

    if (batch.length < batchSize) {
      hasMore = false;
    } else {
      skip += batchSize;
    }
    iterations++;
  }

  return allRecords;
}
/**
 * Bounded concurrency executor that processes an array of items with a fixed limit
 * of in-flight promises while preserving the original item ordering in the result array.
 */
export async function asyncPool<T, R>(
  limit: number,
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!items || items.length === 0) {
    return [];
  }

  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex], currentIndex);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < effectiveLimit; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

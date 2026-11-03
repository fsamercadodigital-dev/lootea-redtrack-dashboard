import { CACHE_TTL_MS } from "./config";

/** Sem linha de hoje o RedTrack ainda pode estar atrasado. Não segurar isso por 10 minutos. */
export const SHORT_CACHE_TTL_MS = 60_000;
export const RATE_LIMIT_BACKOFF_MS = 2_500;

export type CachedRows = {
  expires: number;
  fetchedAt: string;
  rows: { date?: unknown }[];
};

export function rowsHaveToday(rows: { date?: unknown }[], today: string): boolean {
  return rows.some((row) => row?.date === today);
}

export function ttlForRows(rows: { date?: unknown }[], today: string): number {
  return rowsHaveToday(rows, today) ? CACHE_TTL_MS : SHORT_CACHE_TTL_MS;
}

export function isRateLimited(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  return (error as { status: unknown }).status === 429;
}

export type LoadOutcome<T> = {
  rows: T;
  stale: boolean;
  fetchedAt: string;
};

/**
 * Usa o cache em memória enquanto estiver fresco. Se a busca falhar, devolve a última
 * resposta boa mesmo depois do prazo. 429 tenta de novo uma vez antes disso.
 */
export async function loadCachedReport<T extends { date?: unknown }[]>(options: {
  cache: Map<string, CachedRows>;
  key: string;
  today: string;
  refresh: boolean;
  now: number;
  fetchRows: () => Promise<T>;
  sleep?: (ms: number) => Promise<void>;
}): Promise<LoadOutcome<T>> {
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const existing = options.cache.get(options.key);
  if (!options.refresh && existing && existing.expires > options.now) {
    return { rows: existing.rows as T, stale: false, fetchedAt: existing.fetchedAt };
  }

  try {
    let rows: T;
    try {
      rows = await options.fetchRows();
    } catch (error) {
      if (!isRateLimited(error)) throw error;
      await sleep(RATE_LIMIT_BACKOFF_MS);
      rows = await options.fetchRows();
    }
    const fetchedAt = new Date(options.now).toISOString();
    options.cache.set(options.key, {
      rows,
      fetchedAt,
      expires: options.now + ttlForRows(rows, options.today),
    });
    return { rows, stale: false, fetchedAt };
  } catch (error) {
    if (existing) {
      return { rows: existing.rows as T, stale: true, fetchedAt: existing.fetchedAt };
    }
    throw error;
  }
}

/** No máximo `limit` tarefas ao mesmo tempo, na ordem dada. */
export async function runPool<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

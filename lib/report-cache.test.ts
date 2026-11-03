import assert from "node:assert/strict";
import test from "node:test";
import { CACHE_TTL_MS } from "./config";
import {
  RATE_LIMIT_BACKOFF_MS,
  SHORT_CACHE_TTL_MS,
  isRateLimited,
  loadCachedReport,
  rowsHaveToday,
  ttlForRows,
  type CachedRows,
} from "./report-cache";

const TODAY = "2026-11-03";

test("sem linha de hoje o cache dura um minuto, com hoje dura dez", () => {
  const yesterday = [{ date: "2026-11-02" }];
  const today = [{ date: "2026-11-02" }, { date: TODAY }];
  assert.equal(rowsHaveToday(yesterday, TODAY), false);
  assert.equal(rowsHaveToday(today, TODAY), true);
  assert.equal(ttlForRows(yesterday, TODAY), SHORT_CACHE_TTL_MS);
  assert.equal(ttlForRows([], TODAY), SHORT_CACHE_TTL_MS);
  assert.equal(ttlForRows(today, TODAY), CACHE_TTL_MS);
  assert.equal(SHORT_CACHE_TTL_MS, 60_000);
});

test("depois do minuto a falta de hoje busca de novo", async () => {
  const cache = new Map<string, CachedRows>();
  let calls = 0;
  const now = Date.parse("2026-11-03T11:49:00Z");
  const fetchRows = async () => {
    calls += 1;
    return [{ date: "2026-11-02" }];
  };

  const first = await loadCachedReport({
    cache,
    key: "all:from:to",
    today: TODAY,
    refresh: false,
    now,
    fetchRows,
  });
  assert.equal(first.stale, false);
  assert.equal(calls, 1);
  assert.equal(cache.get("all:from:to")?.expires, now + SHORT_CACHE_TTL_MS);

  const cached = await loadCachedReport({
    cache,
    key: "all:from:to",
    today: TODAY,
    refresh: false,
    now: now + 30_000,
    fetchRows,
  });
  assert.equal(calls, 1);
  assert.equal(cached.rows[0]?.date, "2026-11-02");

  await loadCachedReport({
    cache,
    key: "all:from:to",
    today: TODAY,
    refresh: false,
    now: now + SHORT_CACHE_TTL_MS + 1,
    fetchRows,
  });
  assert.equal(calls, 2);
});

test("se o RedTrack falha, devolve a última resposta boa mesmo vencida", async () => {
  const cache = new Map<string, CachedRows>();
  const now = Date.parse("2026-11-03T11:40:00Z");
  await loadCachedReport({
    cache,
    key: "erick:from:to",
    today: TODAY,
    refresh: false,
    now,
    fetchRows: async () => [{ date: TODAY, cost: 74.1 }],
  });

  let calls = 0;
  const sleeps: number[] = [];
  const fallback = await loadCachedReport<{ date: string; cost?: number }[]>({
    cache,
    key: "erick:from:to",
    today: TODAY,
    refresh: true,
    now: now + CACHE_TTL_MS + 5_000,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    fetchRows: async () => {
      calls += 1;
      const error = new Error("ocupado");
      Object.assign(error, { status: 429 });
      throw error;
    },
  });

  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [RATE_LIMIT_BACKOFF_MS]);
  assert.equal(fallback.stale, true);
  assert.equal(fallback.fetchedAt, new Date(now).toISOString());
  assert.equal(fallback.rows[0]?.date, TODAY);
  assert.equal(isRateLimited(Object.assign(new Error("x"), { status: 429 })), true);

  await assert.rejects(
    loadCachedReport({
      cache: new Map(),
      key: "vazio",
      today: TODAY,
      refresh: false,
      now,
      fetchRows: async () => {
        throw Object.assign(new Error("falha"), { status: 500 });
      },
    }),
  );
});

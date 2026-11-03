import "server-only";

import { campaignIdFor } from "./campaigns";
import { CACHE_TTL_MS, LOOKBACK_DAYS, PAGE_SIZE, type BuyerId } from "./config";
import { addDays, mexicoToday, periodRange, type PeriodId } from "./dates";
import { groupRows, mergeBuyerBreakdown, type RawRow } from "./metrics";
import { readReportRows } from "./report-body";
import { buildReportUrl } from "./report-url";
import type { ReportPayload } from "./types";

export class ReportError extends Error {
  stage: string;
  status: number;

  constructor(stage: string, status: number, message: string) {
    super(message);
    this.name = "ReportError";
    this.stage = stage;
    this.status = status;
  }
}

type ReportCacheEntry = { expires: number; rows: RawRow[] };

const REPORT_CACHE_KEY = "__looteaReportRows";

function reportCache(): Map<string, ReportCacheEntry> {
  const host = globalThis as typeof globalThis & { [REPORT_CACHE_KEY]?: Map<string, ReportCacheEntry> };
  if (!host[REPORT_CACHE_KEY]) host[REPORT_CACHE_KEY] = new Map();
  return host[REPORT_CACHE_KEY];
}

async function fetchPage(
  apiKey: string,
  from: string,
  to: string,
  page: number,
  campaignId: string | null,
  refresh: boolean,
): Promise<RawRow[]> {
  const url = buildReportUrl({ apiKey, from, to, page, campaignId });
  let response: Response;
  try {
    const signal = AbortSignal.timeout(30_000);
    response = refresh
      ? await fetch(url, { cache: "no-store", signal })
      : await fetch(url, { next: { revalidate: 600 }, signal });
  } catch {
    throw new ReportError("consulta RedTrack", 504, "Não foi possível conectar ao RedTrack.");
  }

  if (!response.ok) {
    throw new ReportError(
      "consulta RedTrack",
      response.status,
      "O RedTrack não respondeu com sucesso.",
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ReportError("leitura da resposta", 502, "A resposta do RedTrack não pôde ser lida.");
  }

  const rows = readReportRows(body);
  if (!rows) {
    throw new ReportError(
      "leitura da resposta",
      502,
      "A resposta do RedTrack veio em um formato inesperado.",
    );
  }

  return rows;
}

async function fetchAllPages(
  apiKey: string,
  from: string,
  to: string,
  campaignId: string | null,
  refresh: boolean,
): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const items = await fetchPage(apiKey, from, to, page, campaignId, refresh);
    rows.push(...items);
    // Página cheia: ainda pode haver a próxima. Menos que `per` encerra.
    if (items.length < PAGE_SIZE) return rows;
  }
  throw new ReportError(
    "paginação",
    502,
    "O relatório passou do limite de páginas. Tente de novo em alguns minutos.",
  );
}

/**
 * Um relatório largo de 30 dias por comprador, reaproveitado por cerca de 10 minutos.
 * A chave da API não entra no cache em memória nem em mensagens de erro.
 */
async function loadRows(
  apiKey: string,
  buyerId: BuyerId,
  from: string,
  to: string,
  refresh: boolean,
): Promise<RawRow[]> {
  const cacheKey = `${buyerId}:${from}:${to}`;
  const cache = reportCache();
  if (!refresh) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.rows;
  }
  const rows = await fetchAllPages(apiKey, from, to, campaignIdFor(buyerId), refresh);
  cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, rows });
  return rows;
}

export async function getReport(
  buyerId: BuyerId,
  period: PeriodId,
  refresh: boolean,
  custom?: { from: string; to: string },
): Promise<ReportPayload> {
  const apiKey = process.env.REDTRACK_API_KEY;
  if (!apiKey) {
    throw new ReportError(
      "configuração",
      503,
      "Defina REDTRACK_API_KEY no servidor para carregar os dados.",
    );
  }

  const today = mexicoToday();
  const range = periodRange(today, period, custom);
  const lookbackFrom = addDays(today, -(LOOKBACK_DAYS - 1));
  const from = range.from < lookbackFrom ? range.from : lookbackFrom;
  const creatives =
    buyerId === "all"
      ? await (async () => {
          const [allRows, felipe, erick, daniel] = await Promise.all([
            loadRows(apiKey, "all", from, today, refresh),
            loadRows(apiKey, "felipe", from, today, refresh),
            loadRows(apiKey, "erick", from, today, refresh),
            loadRows(apiKey, "daniel", from, today, refresh),
          ]);
          return mergeBuyerBreakdown(allRows, [
            { buyer: "felipe", rows: felipe },
            { buyer: "erick", rows: erick },
            { buyer: "daniel", rows: daniel },
          ]);
        })()
      : groupRows(await loadRows(apiKey, buyerId, from, today, refresh));

  return {
    ok: true,
    fetchedAt: new Date().toISOString(),
    today,
    from,
    to: today,
    periodFrom: range.from,
    periodTo: range.to,
    buyer: buyerId,
    cohortMode: "proxy",
    creatives,
    cohorts: {},
  };
}

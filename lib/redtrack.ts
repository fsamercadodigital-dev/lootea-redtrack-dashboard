import "server-only";

import { campaignIdFor } from "./campaigns";
import { LOOKBACK_DAYS, PAGE_SIZE, type BuyerId } from "./config";
import { addDays, mexicoToday, periodRange, type PeriodId } from "./dates";
import { groupRows, mergeBuyerBreakdown, type RawRow } from "./metrics";
import { loadCachedReport, runPool, type CachedRows } from "./report-cache";
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

const REPORT_CACHE_KEY = "__looteaReportRows";

function reportCache(): Map<string, CachedRows> {
  const host = globalThis as typeof globalThis & { [REPORT_CACHE_KEY]?: Map<string, CachedRows> };
  if (!host[REPORT_CACHE_KEY]) host[REPORT_CACHE_KEY] = new Map();
  return host[REPORT_CACHE_KEY];
}

async function fetchPage(
  apiKey: string,
  from: string,
  to: string,
  page: number,
  campaignId: string | null,
): Promise<RawRow[]> {
  const url = buildReportUrl({ apiKey, from, to, page, campaignId });
  let response: Response;
  try {
    const signal = AbortSignal.timeout(30_000);
    response = await fetch(url, { cache: "no-store", signal });
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
): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const items = await fetchPage(apiKey, from, to, page, campaignId);
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
 * Um relatório largo de 30 dias por comprador. Fica 10 minutos se já tiver o dia de hoje,
 * e só 1 minuto se o RedTrack ainda não devolveu hoje. A chave da API não entra no cache.
 */
async function loadRows(
  apiKey: string,
  buyerId: BuyerId,
  from: string,
  today: string,
  refresh: boolean,
): Promise<{ rows: RawRow[]; stale: boolean; fetchedAt: string }> {
  return loadCachedReport({
    cache: reportCache(),
    key: `${buyerId}:${from}:${today}`,
    today,
    refresh,
    now: Date.now(),
    fetchRows: () => fetchAllPages(apiKey, from, today, campaignIdFor(buyerId)),
  });
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
  const buyers: BuyerId[] = buyerId === "all" ? ["all", "felipe", "erick", "daniel"] : [buyerId];
  const loaded = await runPool(buyers, buyerId === "all" ? 2 : 1, (buyer) =>
    loadRows(apiKey, buyer, from, today, refresh),
  );
  const stale = loaded.some((item) => item.stale);
  const fetchedAt = stale
    ? loaded
        .filter((item) => item.stale)
        .map((item) => item.fetchedAt)
        .sort()[0] ?? new Date().toISOString()
    : new Date().toISOString();
  const byBuyer = new Map(buyers.map((buyer, index) => [buyer, loaded[index]?.rows ?? []]));
  const creatives =
    buyerId === "all"
      ? mergeBuyerBreakdown(byBuyer.get("all") ?? [], [
          { buyer: "felipe", rows: byBuyer.get("felipe") ?? [] },
          { buyer: "erick", rows: byBuyer.get("erick") ?? [] },
          { buyer: "daniel", rows: byBuyer.get("daniel") ?? [] },
        ])
      : groupRows(byBuyer.get(buyerId) ?? []);

  return {
    ok: true,
    fetchedAt,
    stale,
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

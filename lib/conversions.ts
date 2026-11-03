import "server-only";

import { toConvEvents, type ConvEvent } from "./cohort";
import { CONVERSION_PAGE_CAP, CONVERSION_PAGE_SIZE, TIME_ZONE } from "./config";
import { mexicoToday } from "./dates";
import { readItemList } from "./report-body";

function eventDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && !raw.includes("T") && !raw.endsWith("Z")) {
    return raw.slice(0, 10);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return mexicoToday(parsed);
}

async function fetchPage(apiKey: string, from: string, to: string, page: number): Promise<unknown[]> {
  const url = new URL("https://api.redtrack.io/conversions");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("date_from", from);
  url.searchParams.set("date_to", to);
  url.searchParams.set("timezone", TIME_ZONE);
  url.searchParams.set("per", String(CONVERSION_PAGE_SIZE));
  url.searchParams.set("page", String(page));

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error("conexao");
  }

  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  }

  if (!response.ok) throw new Error("status");

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("json");
  }

  const items = readItemList(body);
  if (!items) throw new Error("formato");
  return items;
}

/**
 * Log de conversões da janela. Null se o log não servir para a coorte.
 * Não filtra por source: depósito orgânico também entra na receita do usuário.
 */
export type ConversionLoad = {
  events: ConvEvent[];
  types: string[];
  rows: number;
  ftdFlags: number;
  ftdEvents: number;
  ftdWithUser: number;
  ftdWithAd: number;
  ftdExternal: number;
  ftdClick: number;
  depositWithUser: number;
  depositWithAd: number;
};

function flagCount(value: unknown): boolean {
  return value === true || (typeof value === "number" && value > 0) || value === "1";
}

export async function loadConversionEvents(apiKey: string, from: string, to: string): Promise<ConversionLoad | null> {
  const events: ConvEvent[] = [];
  const types = new Set<string>();
  let rows = 0;
  let ftdFlags = 0;
  let ftdExternal = 0;
  let ftdClick = 0;
  try {
    for (let page = 1; page <= CONVERSION_PAGE_CAP; page += 1) {
      const items = await fetchPage(apiKey, from, to, page);
      for (const item of items) {
        rows += 1;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          if (record.type != null) types.add(String(record.type).slice(0, 40));
          if (flagCount(record.type4)) ftdFlags += 1;
          const label = String(record.type ?? "").toLowerCase();
          if (label === "ftd" || label === "type4") {
            if (String(record.external_id ?? "").trim()) ftdExternal += 1;
            if (String(record.clickid ?? "").trim()) ftdClick += 1;
          }
        }
        events.push(...toConvEvents(item, eventDate));
      }
      if (items.length < CONVERSION_PAGE_SIZE) break;
    }
  } catch {
    return null;
  }
  if (rows === 0) return null;
  const ftdEvents = events.filter((event) => event.kind === "ftd");
  const deposits = events.filter((event) => event.kind === "deposit");
  return {
    events,
    types: Array.from(types).sort(),
    rows,
    ftdFlags,
    ftdEvents: ftdEvents.length,
    ftdWithUser: ftdEvents.filter((event) => event.userId).length,
    ftdWithAd: ftdEvents.filter((event) => event.adId).length,
    ftdExternal,
    ftdClick,
    depositWithUser: deposits.filter((event) => event.userId).length,
    depositWithAd: deposits.filter((event) => event.adId).length,
  };
}

import "server-only";

import { cohortIsUsable, toConvEvent, type ConvEvent } from "./cohort";
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
export async function loadConversionEvents(apiKey: string, from: string, to: string): Promise<ConvEvent[] | null> {
  const events: ConvEvent[] = [];
  try {
    for (let page = 1; page <= CONVERSION_PAGE_CAP; page += 1) {
      const items = await fetchPage(apiKey, from, to, page);
      for (const item of items) {
        const event = toConvEvent(item, eventDate);
        if (event) events.push(event);
      }
      if (items.length < CONVERSION_PAGE_SIZE) {
        return cohortIsUsable(events) ? events : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

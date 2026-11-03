import type { RawRow } from "./metrics";

/**
 * Sem `total`, o /report/v2 devolve um array. Com `total=true`, devolve { items }.
 * Os dois formatos são aceitos.
 */
export function readReportRows(body: unknown): RawRow[] | null {
  if (Array.isArray(body)) return body as RawRow[];
  if (body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: RawRow[] }).items;
  }
  return null;
}

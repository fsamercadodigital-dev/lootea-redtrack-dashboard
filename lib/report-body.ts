import type { RawRow } from "./metrics";

/** Array puro ou { items }. O /report/v2 e o /conversions usam os dois. */
export function readItemList(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: unknown[] }).items;
  }
  return null;
}

export function readReportRows(body: unknown): RawRow[] | null {
  const items = readItemList(body);
  return items as RawRow[] | null;
}

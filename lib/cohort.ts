export type ConvKind = "ftd" | "deposit" | "redeposit" | "other";

export type ConvEvent = {
  userId: string;
  kind: ConvKind;
  payout: number;
  date: string;
  adId: string;
};

export type AdCohortStats = {
  revenue: number;
  rpr: number | null;
  topCustomerShare: number | null;
  legacyShare: number | null;
};

type FirstFtd = { adId: string; date: string };

function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Uma linha do log vira um evento. Sem tipo reconhecido, devolve null. */
export function toConvEvent(row: unknown, dateOf: (raw: string) => string | null): ConvEvent | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const kind = kindOf(record);
  if (kind === "other") return null;
  const date = dateOf(text(record.created_at) || text(record.conv_time) || text(record.track_time));
  if (!date) return null;
  const adId = text(record.rt_ad_id) || text(record.sub1);
  return {
    userId: text(record.external_id),
    kind,
    payout: num(record.payout),
    date,
    adId,
  };
}

export function kindOf(record: Record<string, unknown>): ConvKind {
  const type = text(record.type).toLowerCase().replace(/\s+/g, "");
  if (type === "type4" || type === "ftd") return "ftd";
  if (type === "type2" || type === "deposit") return "deposit";
  if (type === "type7" || type === "redeposit") return "redeposit";
  if (record.type4 === 1) return "ftd";
  if (record.type7 === 1) return "redeposit";
  if (record.type2 === 1) return "deposit";
  return "other";
}

export function cohortIsUsable(events: ConvEvent[]): boolean {
  return events.some((event) => event.userId !== "" && event.kind !== "other");
}

function inPeriod(date: string, period: { from: string; to: string }): boolean {
  return date >= period.from && date <= period.to;
}

/**
 * Cada usuário fica no anúncio do primeiro FTD.
 * A receita da coorte soma os depósitos dele no período, em qualquer anúncio.
 */
export function buildCohorts(
  events: ConvEvent[],
  ads: { adId: string; d1: string | null }[],
  period: { from: string; to: string },
): Map<string, AdCohortStats> {
  const firstFtd = new Map<string, FirstFtd>();
  const depositCount = new Map<string, number>();
  const hasRedepositEvent = new Set<string>();

  for (const event of events) {
    if (!event.userId) continue;
    if (event.kind === "ftd" && event.adId) {
      const current = firstFtd.get(event.userId);
      if (!current || event.date < current.date) {
        firstFtd.set(event.userId, { adId: event.adId, date: event.date });
      }
    }
    if (event.kind === "deposit") {
      depositCount.set(event.userId, (depositCount.get(event.userId) ?? 0) + 1);
    }
    if (event.kind === "redeposit") hasRedepositEvent.add(event.userId);
  }

  const redepositUsers = new Set<string>(hasRedepositEvent);
  for (const [userId, count] of depositCount) {
    if (count >= 2) redepositUsers.add(userId);
  }

  const periodRevenue = new Map<string, number>();
  for (const event of events) {
    if (!event.userId || event.kind !== "deposit" || !inPeriod(event.date, period)) continue;
    periodRevenue.set(event.userId, (periodRevenue.get(event.userId) ?? 0) + event.payout);
  }

  const result = new Map<string, AdCohortStats>();

  for (const ad of ads) {
    const users = Array.from(firstFtd.entries()).filter(
      ([, first]) => first.adId === ad.adId && inPeriod(first.date, period),
    );
    let revenue = 0;
    let top = 0;
    let withRedeposit = 0;
    for (const [userId] of users) {
      const userRevenue = periodRevenue.get(userId) ?? 0;
      revenue += userRevenue;
      if (userRevenue > top) top = userRevenue;
      if (redepositUsers.has(userId)) withRedeposit += 1;
    }

    let legacyNumer = 0;
    let legacyDenom = 0;
    for (const event of events) {
      if (event.kind !== "deposit" || event.adId !== ad.adId || !inPeriod(event.date, period)) continue;
      legacyDenom += event.payout;
      if (!event.userId) continue;
      const first = firstFtd.get(event.userId);
      if (!first) continue;
      const otherAd = first.adId !== ad.adId;
      const beforeD1 = ad.d1 != null && first.date < ad.d1;
      if (otherAd || beforeD1) legacyNumer += event.payout;
    }

    result.set(ad.adId, {
      revenue,
      rpr: users.length > 0 ? withRedeposit / users.length : null,
      topCustomerShare: revenue > 0 ? top / revenue : null,
      legacyShare: legacyDenom > 0 ? legacyNumer / legacyDenom : null,
    });
  }

  return result;
}

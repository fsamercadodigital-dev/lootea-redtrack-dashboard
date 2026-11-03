import { buyerForCampaign, GESTOR_LABEL, GESTOR_ORDER, type GestorId } from "./campaigns";
import type { AdCohortStats } from "./cohort";
import type { Thresholds } from "./config";
import { addDays, daysBetween, periodRange, type PeriodId } from "./dates";
import { decide, type Decision, type RuleId } from "./decision";
import { normalizeAdName } from "./normalize";
import { hasFullTracking } from "./tracking";
import type { CohortMode, CreativeSeries, DailyPoint } from "./types";

export type RawRow = {
  rt_ad_id?: unknown;
  rt_ad?: unknown;
  rt_adgroup?: unknown;
  date?: unknown;
  clicks?: unknown;
  impressions?: unknown;
  cost?: unknown;
  convtype2?: unknown;
  revenuetype2?: unknown;
  convtype3?: unknown;
  convtype4?: unknown;
  revenuetype4?: unknown;
  convtype7?: unknown;
  campaign_id?: unknown;
  rt_campaign_id?: unknown;
  buyer?: GestorId;
};

export type EarlyDay = {
  date: string;
  spend: number;
  depositRevenue: number;
  /** Null quando o dia não teve gasto. */
  roas: number | null;
};

export type CreativeRow = {
  adId: string;
  name: string;
  adset: string;
  rawNames: string[];
  tracked: boolean;
  day: number | null;
  spend: number;
  signups: number;
  deposits: number;
  ftds: number;
  cpaFtd: number | null;
  adRoas: number | null;
  cohortRevenue: number;
  cohortRoas: number | null;
  rpr: number | null;
  topCustomerShare: number | null;
  legacyShare: number | null;
  redeposits: number;
  aov: number | null;
  cps: number | null;
  clicks: number;
  impressions: number;
  depositRevenue: number;
  ftdRevenue: number;
  cpaDeposit: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
  /** Dia de lançamento: primeiro dia com gasto. A idade conta esse dia como dia 1. */
  launchDate: string | null;
  /** ROAS dos quatro primeiros dias de vida. Null se esse dia ainda não chegou. */
  earlyDays: [EarlyDay | null, EarlyDay | null, EarlyDay | null, EarlyDay | null];
  decision: Decision;
  gestorId?: GestorId;
  gestorLabel?: string;
  /** Só na visão Todos os gestores. Cada linha é aquele gestor, com o D1 dele. */
  gestorRows?: CreativeRow[];
};

export type Summary = {
  spend: number;
  depositRevenue: number;
  roas: number | null;
  ftds: number;
  cpaFtd: number | null;
  escalar: number;
  manter: number;
  descartar: number;
  semVeredito: number;
};

/** CPM só existe com impressões. Zero impressões não vira infinito nem 0. */
export function cpm(cost: number, impressions: number): number | null {
  if (!(impressions > 0)) return null;
  return (cost / impressions) * 1000;
}

/** CTR só existe com impressões. Zero impressões não vira 0%. */
export function ctr(clicks: number, impressions: number): number | null {
  if (!(impressions > 0)) return null;
  return clicks / impressions;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

/** Receita ÷ custo. Custo zero com receita vira infinito. Os dois zero ficam sem número. */
export function roas(revenue: number, cost: number): number | null {
  if (cost > 0) return revenue / cost;
  if (revenue > 0) return Number.POSITIVE_INFINITY;
  return null;
}

/** Numerador ÷ denominador. Denominador zero não vira infinito (CPA, AOV, CPS). */
export function perUnit(numerator: number, denominator: number): number | null {
  if (denominator > 0) return numerator / denominator;
  return null;
}

function emptyDay(date: string): DailyPoint {
  return {
    date,
    clicks: 0,
    impressions: 0,
    cost: 0,
    deposits: 0,
    depositRevenue: 0,
    signups: 0,
    ftds: 0,
    ftdRevenue: 0,
    redeposits: 0,
  };
}

function addToDay(day: DailyPoint, row: RawRow) {
  day.clicks += num(row.clicks);
  day.impressions += num(row.impressions);
  day.cost += num(row.cost);
  day.deposits += num(row.convtype2);
  day.depositRevenue += num(row.revenuetype2);
  day.signups += num(row.convtype3);
  day.ftds += num(row.convtype4);
  day.ftdRevenue += num(row.revenuetype4);
  day.redeposits += num(row.convtype7);
}

/**
 * Soma pelo nome normalizado do criativo. O mesmo nome em outro anúncio ou com outra
 * capitalização entra na mesma linha. O id mostrado é o do dia mais recente.
 */
function gestorOf(row: RawRow): GestorId | null {
  if (row.buyer === "felipe" || row.buyer === "erick" || row.buyer === "daniel" || row.buyer === "other") {
    return row.buyer;
  }
  const campaignId = text(row.campaign_id) || text(row.rt_campaign_id);
  if (!campaignId) return null;
  return buyerForCampaign(campaignId);
}

export function groupRows(rows: RawRow[]): CreativeSeries[] {
  const byName = new Map<
    string,
    {
      adId: string;
      adIdDate: string;
      rawNames: Set<string>;
      adset: string;
      adsetDate: string;
      days: Map<string, DailyPoint>;
      buyers: Map<GestorId, { adset: string; adsetDate: string; days: Map<string, DailyPoint> }>;
    }
  >();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const date = text(row.date);
    if (!DATE_PATTERN.test(date)) continue;
    const adId = text(row.rt_ad_id);
    const rawName = text(row.rt_ad);
    const key = normalizeAdName(rawName);

    let creative = byName.get(key);
    if (!creative) {
      creative = {
        adId: "",
        adIdDate: "",
        rawNames: new Set(),
        adset: "",
        adsetDate: "",
        days: new Map(),
        buyers: new Map(),
      };
      byName.set(key, creative);
    }

    if (rawName) creative.rawNames.add(rawName);
    if (adId && (!creative.adIdDate || date >= creative.adIdDate)) {
      creative.adId = adId;
      creative.adIdDate = date;
    }
    const adset = text(row.rt_adgroup);
    if (adset && (!creative.adsetDate || date > creative.adsetDate)) {
      creative.adset = adset;
      creative.adsetDate = date;
    }

    const day = creative.days.get(date) ?? emptyDay(date);
    addToDay(day, row);
    creative.days.set(date, day);

    const gestor = gestorOf(row);
    if (gestor) {
      let bucket = creative.buyers.get(gestor);
      if (!bucket) {
        bucket = { adset: "", adsetDate: "", days: new Map() };
        creative.buyers.set(gestor, bucket);
      }
      if (adset && (!bucket.adsetDate || date > bucket.adsetDate)) {
        bucket.adset = adset;
        bucket.adsetDate = date;
      }
      const buyerDay = bucket.days.get(date) ?? emptyDay(date);
      addToDay(buyerDay, row);
      bucket.days.set(date, buyerDay);
    }
  }

  return Array.from(byName, ([name, creative]) => ({
    adId: creative.adId || name,
    name,
    rawNames: Array.from(creative.rawNames).sort((a, b) => a.localeCompare(b)),
    adset: creative.adset,
    days: Array.from(creative.days.values()).sort((a, b) => a.date.localeCompare(b.date)),
    buyers: GESTOR_ORDER.flatMap((buyer) => {
      const bucket = creative.buyers.get(buyer);
      if (!bucket) return [];
      return [{
        buyer,
        adset: bucket.adset,
        days: Array.from(bucket.days.values()).sort((a, b) => a.date.localeCompare(b.date)),
      }];
    }),
  }));
}

const DAY_METRICS = [
  "clicks",
  "impressions",
  "cost",
  "deposits",
  "depositRevenue",
  "signups",
  "ftds",
  "ftdRevenue",
  "redeposits",
] as const;

function addPoint(target: DailyPoint, source: DailyPoint) {
  for (const key of DAY_METRICS) target[key] += source[key];
}

function subtractPoint(parent: DailyPoint, taken: DailyPoint | undefined): DailyPoint {
  const left = emptyDay(parent.date);
  for (const key of DAY_METRICS) left[key] = parent[key] - (taken?.[key] ?? 0);
  return left;
}

function hasSignal(day: DailyPoint): boolean {
  return DAY_METRICS.some((key) => Math.abs(day[key]) > 0.0001);
}

/** Junta o relatório geral com o de cada gestor. O que sobra fica em Sem gestor. */
export function mergeBuyerBreakdown(
  allRows: RawRow[],
  parts: { buyer: GestorId; rows: RawRow[] }[],
): CreativeSeries[] {
  const parents = groupRows(allRows);
  const knownByName = new Map<string, NonNullable<CreativeSeries["buyers"]>>();
  for (const part of parts) {
    if (part.buyer === "other") continue;
    for (const series of groupRows(part.rows.map((row) => ({ ...row, buyer: part.buyer })))) {
      const list = knownByName.get(series.name) ?? [];
      if (series.days.length > 0) list.push({ buyer: part.buyer, adset: series.adset, days: series.days });
      knownByName.set(series.name, list);
    }
  }

  return parents.map((parent) => {
    const known = knownByName.get(parent.name) ?? [];
    const taken = new Map<string, DailyPoint>();
    for (const slice of known) {
      for (const day of slice.days) {
        const acc = taken.get(day.date) ?? emptyDay(day.date);
        addPoint(acc, day);
        taken.set(day.date, acc);
      }
    }
    const otherDays = parent.days.map((day) => subtractPoint(day, taken.get(day.date))).filter(hasSignal);
    const buyers = [
      ...GESTOR_ORDER.filter((buyer) => buyer !== "other").flatMap((buyer) => known.filter((slice) => slice.buyer === buyer)),
      ...(otherDays.length ? [{ buyer: "other" as const, adset: "", days: otherDays }] : []),
    ];
    return { ...parent, buyers };
  });
}

function sumBy(days: DailyPoint[], pick: (day: DailyPoint) => number): number {
  return days.reduce((total, day) => total + pick(day), 0);
}

function proxyCohort(ftds: number, redeposits: number, depositRevenue: number): AdCohortStats {
  return {
    revenue: depositRevenue,
    rpr: ftds > 0 ? (redeposits > 0 ? 1 : 0) : null,
    topCustomerShare: null,
    legacyShare: null,
  };
}

export function buildCreativeRows(
  creatives: CreativeSeries[],
  period: { from: string; to: string },
  today: string,
  thresholds: Thresholds,
  cohorts: Map<string, AdCohortStats> | null = null,
): CreativeRow[] {
  const drafts: Omit<CreativeRow, "decision">[] = [];

  for (const creative of creatives) {
    const inPeriod = creative.days.filter((day) => day.date >= period.from && day.date <= period.to);
    if (inPeriod.length === 0) continue;

    const spend = sumBy(inPeriod, (day) => day.cost);
    const ftds = sumBy(inPeriod, (day) => day.ftds);
    const redeposits = sumBy(inPeriod, (day) => day.redeposits);
    const clicks = sumBy(inPeriod, (day) => day.clicks);
    const impressions = sumBy(inPeriod, (day) => day.impressions);
    const signups = sumBy(inPeriod, (day) => day.signups);
    const deposits = sumBy(inPeriod, (day) => day.deposits);
    const depositRevenue = sumBy(inPeriod, (day) => day.depositRevenue);
    const ftdRevenue = sumBy(inPeriod, (day) => day.ftdRevenue);
    const firstSpend = creative.days.find((day) => day.cost > 0) ?? null;
    const dayNumber = firstSpend ? daysBetween(firstSpend.date, today) + 1 : null;
    const earlyDays = [0, 1, 2, 3].map((offset) => {
      if (!firstSpend) return null;
      const date = addDays(firstSpend.date, offset);
      if (date > today) return null;
      const point = creative.days.find((day) => day.date === date);
      const spend = point?.cost ?? 0;
      const revenue = point?.depositRevenue ?? 0;
      return {
        date,
        spend,
        depositRevenue: revenue,
        roas: spend > 0 ? revenue / spend : null,
      };
    }) as CreativeRow["earlyDays"];
    const stats = cohorts
      ? (cohorts.get(creative.adId) ?? {
          revenue: 0,
          rpr: null,
          topCustomerShare: null,
          legacyShare: null,
        })
      : proxyCohort(ftds, redeposits, depositRevenue);

    drafts.push({
      adId: creative.adId,
      name: creative.name,
      adset: creative.adset,
      rawNames: creative.rawNames,
      tracked: thresholds.requireAdsetTag ? hasFullTracking(creative.adset) : dayNumber != null,
      day: dayNumber,
      spend,
      signups,
      deposits,
      ftds,
      cpaFtd: perUnit(spend, ftds),
      adRoas: roas(depositRevenue, spend),
      cohortRevenue: stats.revenue,
      cohortRoas: roas(stats.revenue, spend),
      rpr: stats.rpr,
      topCustomerShare: stats.topCustomerShare,
      legacyShare: stats.legacyShare,
      redeposits,
      aov: perUnit(depositRevenue, deposits),
      cps: perUnit(spend, signups),
      clicks,
      impressions,
      depositRevenue,
      ftdRevenue,
      cpaDeposit: perUnit(spend, deposits),
      cpc: perUnit(spend, clicks),
      cpm: cpm(spend, impressions),
      ctr: ctr(clicks, impressions),
      launchDate: firstSpend?.date ?? null,
      earlyDays,
    });
  }

  const tracked = drafts.filter((row) => row.tracked);
  const trackedSpend = tracked.reduce((total, row) => total + row.spend, 0);
  const trackedFtds = tracked.reduce((total, row) => total + row.ftds, 0);
  const trackedRevenue = tracked.reduce((total, row) => total + row.cohortRevenue, 0);
  const accountAvgCpa = perUnit(trackedSpend, trackedFtds);
  const avgCohortRoas = roas(trackedRevenue, trackedSpend);
  const scaleBar = avgCohortRoas == null ? null : avgCohortRoas * thresholds.scaleBarMultiple;

  const rows = drafts.map((row) => ({
    ...row,
    decision: decide(
      {
        tracked: row.tracked,
        day: row.day,
        spend: row.spend,
        signups: row.signups,
        deposits: row.deposits,
        ftds: row.ftds,
        redeposits: row.redeposits,
        cpaFtd: row.cpaFtd,
        adRoas: row.adRoas,
        cohortRoas: row.cohortRoas,
        rpr: row.rpr,
        topCustomerShare: row.topCustomerShare,
        legacyShare: row.legacyShare,
        accountAvgCpa,
        scaleBar,
      },
      thresholds,
      cohorts ? "full" : "proxy",
    ),
  }));

  if (!creatives.some((creative) => creative.buyers && creative.buyers.length > 0)) return rows;

  const nested = new Map<string, CreativeRow[]>();
  for (const gestor of GESTOR_ORDER) {
    const subset: CreativeSeries[] = [];
    for (const creative of creatives) {
      const slice = creative.buyers?.find((item) => item.buyer === gestor);
      if (!slice || slice.days.length === 0) continue;
      subset.push({
        adId: creative.adId,
        name: creative.name,
        rawNames: creative.rawNames,
        adset: slice.adset || creative.adset,
        days: slice.days,
      });
    }
    if (subset.length === 0) continue;
    for (const row of buildCreativeRows(subset, period, today, thresholds, cohorts)) {
      const list = nested.get(row.name) ?? [];
      list.push({ ...row, gestorId: gestor, gestorLabel: GESTOR_LABEL[gestor] });
      nested.set(row.name, list);
    }
  }

  return rows.map((row) => ({ ...row, gestorRows: nested.get(row.name) ?? [] }));
}

export function rowsForPeriod(
  creatives: CreativeSeries[],
  today: string,
  period: PeriodId,
  thresholds: Thresholds,
): CreativeRow[] {
  return buildCreativeRows(creatives, periodRange(today, period), today, thresholds);
}

export type CriteriaLive = {
  cohortMode: CohortMode;
  avgRoas: number | null;
  scaleBar: number | null;
  avgCpa: number | null;
  cpaLimit: number | null;
  counts: { escalar: number; manter: number; descartar: number };
  rules: Partial<Record<RuleId, number>>;
};

/** Mesma média que a decisão usa, para o drawer não mostrar um número diferente do veredito. */
export function criteriaLive(rows: CreativeRow[], thresholds: Thresholds, cohortMode: CohortMode): CriteriaLive {
  const tracked = rows.filter((row) => row.tracked);
  const spend = tracked.reduce((total, row) => total + row.spend, 0);
  const ftds = tracked.reduce((total, row) => total + row.ftds, 0);
  const revenue = tracked.reduce((total, row) => total + row.cohortRevenue, 0);
  const avgCpa = perUnit(spend, ftds);
  const avgRoas = roas(revenue, spend);
  const rules: Partial<Record<RuleId, number>> = {};
  for (const row of rows) {
    rules[row.decision.rule] = (rules[row.decision.rule] ?? 0) + 1;
  }
  return {
    cohortMode,
    avgRoas,
    scaleBar: avgRoas == null ? null : avgRoas * thresholds.scaleBarMultiple,
    avgCpa,
    cpaLimit: avgCpa == null ? null : avgCpa * thresholds.cpaMultiple,
    counts: {
      escalar: rows.filter((row) => row.decision.verdict === "escalar").length,
      manter: rows.filter((row) => row.decision.verdict === "manter").length,
      descartar: rows.filter((row) => row.decision.verdict === "descartar").length,
    },
    rules,
  };
}

export function summarize(rows: CreativeRow[]): Summary {
  const spend = rows.reduce((total, row) => total + row.spend, 0);
  const depositRevenue = rows.reduce((total, row) => total + row.depositRevenue, 0);
  const ftds = rows.reduce((total, row) => total + row.ftds, 0);
  return {
    spend,
    depositRevenue,
    roas: roas(depositRevenue, spend),
    ftds,
    cpaFtd: perUnit(spend, ftds),
    escalar: rows.filter((row) => row.decision.verdict === "escalar").length,
    manter: rows.filter((row) => row.decision.verdict === "manter").length,
    descartar: rows.filter((row) => row.decision.verdict === "descartar").length,
    semVeredito: rows.filter((row) => row.decision.verdict === "sem-veredito").length,
  };
}

import type { AdCohortStats } from "./cohort";
import type { Thresholds } from "./config";
import { daysBetween, periodRange, type PeriodId } from "./dates";
import { decide, type Decision } from "./decision";
import { hasFullTracking } from "./tracking";
import type { CreativeSeries, DailyPoint } from "./types";

export type RawRow = {
  rt_ad_id?: unknown;
  rt_ad?: unknown;
  rt_adgroup?: unknown;
  date?: unknown;
  clicks?: unknown;
  cost?: unknown;
  convtype2?: unknown;
  revenuetype2?: unknown;
  convtype3?: unknown;
  convtype4?: unknown;
  convtype7?: unknown;
};

export type CreativeRow = {
  adId: string;
  name: string;
  adset: string;
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
  depositRevenue: number;
  decision: Decision;
};

export type Summary = {
  spend: number;
  ftds: number;
  cpaFtd: number | null;
  cohortRoas: number | null;
  scaleBar: number | null;
  escalar: number;
  manter: number;
  descartar: number;
  semVeredito: number;
};

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
    cost: 0,
    deposits: 0,
    depositRevenue: 0,
    signups: 0,
    ftds: 0,
    redeposits: 0,
  };
}

function addToDay(day: DailyPoint, row: RawRow) {
  day.clicks += num(row.clicks);
  day.cost += num(row.cost);
  day.deposits += num(row.convtype2);
  day.depositRevenue += num(row.revenuetype2);
  day.signups += num(row.convtype3);
  day.ftds += num(row.convtype4);
  day.redeposits += num(row.convtype7);
}

/**
 * Soma por rt_ad_id. Linhas repetidas no mesmo dia (conjunto renomeado) entram na soma.
 * O nome exibido é o rt_ad mais recente que não está vazio.
 */
export function groupRows(rows: RawRow[]): CreativeSeries[] {
  const byAd = new Map<
    string,
    { name: string; nameDate: string; adset: string; adsetDate: string; days: Map<string, DailyPoint> }
  >();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const adId = text(row.rt_ad_id);
    const date = text(row.date);
    if (!adId || !DATE_PATTERN.test(date)) continue;

    let creative = byAd.get(adId);
    if (!creative) {
      creative = { name: adId, nameDate: "", adset: "", adsetDate: "", days: new Map() };
      byAd.set(adId, creative);
    }

    const label = text(row.rt_ad);
    if (label && (!creative.nameDate || date > creative.nameDate)) {
      creative.name = label;
      creative.nameDate = date;
    }
    const adset = text(row.rt_adgroup);
    if (adset && (!creative.adsetDate || date > creative.adsetDate)) {
      creative.adset = adset;
      creative.adsetDate = date;
    }

    const day = creative.days.get(date) ?? emptyDay(date);
    addToDay(day, row);
    creative.days.set(date, day);
  }

  return Array.from(byAd, ([adId, creative]) => ({
    adId,
    name: creative.name,
    adset: creative.adset,
    days: Array.from(creative.days.values()).sort((a, b) => a.date.localeCompare(b.date)),
  }));
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
    const signups = sumBy(inPeriod, (day) => day.signups);
    const deposits = sumBy(inPeriod, (day) => day.deposits);
    const depositRevenue = sumBy(inPeriod, (day) => day.depositRevenue);
    const firstSpend = creative.days.find((day) => day.cost > 0) ?? null;
    const dayNumber = firstSpend ? daysBetween(firstSpend.date, today) : null;
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
      tracked: hasFullTracking(creative.adset),
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
      depositRevenue,
    });
  }

  const tracked = drafts.filter((row) => row.tracked);
  const trackedSpend = tracked.reduce((total, row) => total + row.spend, 0);
  const trackedFtds = tracked.reduce((total, row) => total + row.ftds, 0);
  const trackedRevenue = tracked.reduce((total, row) => total + row.cohortRevenue, 0);
  const accountAvgCpa = perUnit(trackedSpend, trackedFtds);
  const avgCohortRoas = roas(trackedRevenue, trackedSpend);
  const scaleBar = avgCohortRoas == null ? null : avgCohortRoas * thresholds.scaleBarMultiple;

  return drafts.map((row) => ({
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
    ),
  }));
}

export function rowsForPeriod(
  creatives: CreativeSeries[],
  today: string,
  period: PeriodId,
  thresholds: Thresholds,
): CreativeRow[] {
  return buildCreativeRows(creatives, periodRange(today, period), today, thresholds);
}

export function summarize(rows: CreativeRow[], thresholds: Thresholds): Summary {
  const tracked = rows.filter((row) => row.tracked);
  const spend = tracked.reduce((total, row) => total + row.spend, 0);
  const ftds = tracked.reduce((total, row) => total + row.ftds, 0);
  const revenue = tracked.reduce((total, row) => total + row.cohortRevenue, 0);
  const cohortRoas = roas(revenue, spend);
  return {
    spend,
    ftds,
    cpaFtd: perUnit(spend, ftds),
    cohortRoas,
    scaleBar: cohortRoas == null ? null : cohortRoas * thresholds.scaleBarMultiple,
    escalar: rows.filter((row) => row.decision.verdict === "escalar").length,
    manter: rows.filter((row) => row.decision.verdict === "manter").length,
    descartar: rows.filter((row) => row.decision.verdict === "descartar").length,
    semVeredito: rows.filter((row) => row.decision.verdict === "sem-veredito").length,
  };
}

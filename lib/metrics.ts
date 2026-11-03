import { daysBetween, addDays, periodRange, type PeriodId } from "./dates";
import { decide, type Decision } from "./decision";
import type { Thresholds } from "./config";
import type { CreativeSeries, DailyPoint } from "./types";

export type RawRow = {
  rt_ad_id?: unknown;
  rt_ad?: unknown;
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
  day: number | null;
  spend: number;
  ftds: number;
  cpaFtd: number | null;
  roas: number | null;
  roasD1: number | null;
  roasThroughD4: number | null;
  redeposits: number;
  aov: number | null;
  cps: number | null;
  signups: number;
  clicks: number;
  depositRevenue: number;
  maxDailySpend: number;
  scaleRoas: number | null;
  decision: Decision;
};

export type Summary = {
  spend: number;
  ftds: number;
  cpaFtd: number | null;
  roas: number | null;
  depositRevenue: number;
  escalar: number;
  manter: number;
  descartar: number;
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
    { name: string; nameDate: string; days: Map<string, DailyPoint> }
  >();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const adId = text(row.rt_ad_id);
    const date = text(row.date);
    if (!adId || !DATE_PATTERN.test(date)) continue;

    let creative = byAd.get(adId);
    if (!creative) {
      creative = { name: adId, nameDate: "", days: new Map() };
      byAd.set(adId, creative);
    }

    const label = text(row.rt_ad);
    if (label && (!creative.nameDate || date > creative.nameDate)) {
      creative.name = label;
      creative.nameDate = date;
    }

    const day = creative.days.get(date) ?? emptyDay(date);
    addToDay(day, row);
    creative.days.set(date, day);
  }

  return Array.from(byAd, ([adId, creative]) => ({
    adId,
    name: creative.name,
    days: Array.from(creative.days.values()).sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

function sumBy(days: DailyPoint[], pick: (day: DailyPoint) => number): number {
  return days.reduce((total, day) => total + pick(day), 0);
}

/** ROAS só dos dias cujo gasto do dia atingiu o limite. Sem esses dias, null. */
export function roasOnHighSpendDays(days: DailyPoint[], threshold: number): number | null {
  const hot = days.filter((day) => day.cost >= threshold);
  if (hot.length === 0) return null;
  return roas(sumBy(hot, (day) => day.depositRevenue), sumBy(hot, (day) => day.cost));
}

export function buildCreativeRows(
  creatives: CreativeSeries[],
  period: { from: string; to: string },
  today: string,
  thresholds: Thresholds,
): CreativeRow[] {
  const rows: CreativeRow[] = [];

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

    const first = creative.days.find((day) => day.cost > 0 || day.clicks > 0) ?? null;
    let dayNumber: number | null = null;
    let roasD1: number | null = null;
    let roasThroughD4: number | null = null;

    if (first) {
      dayNumber = daysBetween(first.date, today) + 1;
      roasD1 = roas(first.depositRevenue, first.cost);
      const throughDay4 = addDays(first.date, 3);
      const cohort = creative.days.filter(
        (day) => day.date >= first.date && day.date <= throughDay4,
      );
      roasThroughD4 = roas(
        sumBy(cohort, (day) => day.depositRevenue),
        sumBy(cohort, (day) => day.cost),
      );
    }

    const maxDailySpend = creative.days.reduce((max, day) => Math.max(max, day.cost), 0);
    const scaleRoas =
      thresholds.scaleSpendThreshold == null
        ? null
        : roasOnHighSpendDays(creative.days, thresholds.scaleSpendThreshold);

    const decision = decide(
      {
        spend,
        ftds,
        redeposits,
        cpaFtd: perUnit(spend, ftds),
        roasD1,
        roasThroughD4,
        aov: perUnit(depositRevenue, deposits),
        cps: perUnit(spend, signups),
        day: dayNumber,
        scaleRoas,
      },
      thresholds,
    );

    rows.push({
      adId: creative.adId,
      name: creative.name,
      day: dayNumber,
      spend,
      ftds,
      cpaFtd: perUnit(spend, ftds),
      roas: roas(depositRevenue, spend),
      roasD1,
      roasThroughD4,
      redeposits,
      aov: perUnit(depositRevenue, deposits),
      cps: perUnit(spend, signups),
      signups,
      clicks,
      depositRevenue,
      maxDailySpend,
      scaleRoas,
      decision,
    });
  }

  return rows;
}

export function rowsForPeriod(
  creatives: CreativeSeries[],
  today: string,
  period: PeriodId,
  thresholds: Thresholds,
): CreativeRow[] {
  return buildCreativeRows(creatives, periodRange(today, period), today, thresholds);
}

export function summarize(rows: CreativeRow[]): Summary {
  const spend = rows.reduce((total, row) => total + row.spend, 0);
  const ftds = rows.reduce((total, row) => total + row.ftds, 0);
  const depositRevenue = rows.reduce((total, row) => total + row.depositRevenue, 0);
  return {
    spend,
    ftds,
    cpaFtd: perUnit(spend, ftds),
    roas: roas(depositRevenue, spend),
    depositRevenue,
    escalar: rows.filter((row) => row.decision.verdict === "escalar").length,
    manter: rows.filter((row) => row.decision.verdict === "manter").length,
    descartar: rows.filter((row) => row.decision.verdict === "descartar").length,
  };
}

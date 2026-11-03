import assert from "node:assert/strict";
import test from "node:test";
import { campaignIdFor } from "./campaigns";
import { DEFAULT_THRESHOLDS, sanitizeThresholds } from "./config";
import { addDays, mexicoToday, periodRange } from "./dates";
import { buildCreativeRows, groupRows, summarize, type RawRow } from "./metrics";
import { buildReportUrl, REPORT_FIELDS } from "./report-url";

test("soma o mesmo anúncio no mesmo dia e fica com o nome mais recente", () => {
  const rows: RawRow[] = [
    {
      rt_ad_id: "120",
      rt_ad: "Nome antigo",
      date: "2026-10-27",
      clicks: 0,
      cost: 0,
      convtype2: 1,
      revenuetype2: 5,
      convtype3: 0,
      convtype4: 0,
      convtype7: 1,
    },
    {
      rt_ad_id: "120",
      rt_ad: "Velho",
      date: "2026-10-28",
      clicks: 10,
      cost: 40,
      convtype2: 4,
      revenuetype2: 20,
      convtype3: 8,
      convtype4: 2,
      convtype7: 1,
    },
    {
      rt_ad_id: "120",
      rt_ad: "Velho",
      date: "2026-10-28",
      clicks: 2,
      cost: 10,
      convtype2: 1,
      revenuetype2: 10,
      convtype3: 1,
      convtype4: 1,
      convtype7: 0,
    },
    {
      rt_ad_id: "120",
      rt_ad: "Novo",
      date: "2026-10-29",
      clicks: 0,
      cost: 0,
      convtype2: 2,
      revenuetype2: 30,
      convtype3: 0,
      convtype4: 0,
      convtype7: 2,
    },
    {
      rt_ad_id: "120",
      rt_ad: "",
      date: "2026-10-30",
      clicks: 5,
      cost: 0,
      convtype2: 0,
      revenuetype2: 0,
      convtype3: 0,
      convtype4: 0,
      convtype7: 0,
    },
    {
      rt_ad_id: "999",
      rt_ad: "Novo",
      date: "2026-10-29",
      clicks: 3,
      cost: 12,
      convtype2: 1,
      revenuetype2: 12,
      convtype3: 2,
      convtype4: 1,
      convtype7: 0,
    },
  ];

  const grouped = groupRows(rows);
  assert.equal(grouped.length, 2);

  const ad = grouped.find((item) => item.adId === "120");
  assert.ok(ad);
  assert.equal(ad.name, "Novo");
  const day28 = ad.days.find((day) => day.date === "2026-10-28");
  assert.ok(day28);
  assert.equal(day28.cost, 50);
  assert.equal(day28.clicks, 12);
  assert.equal(day28.ftds, 3);
  assert.equal(day28.depositRevenue, 30);
  assert.equal(day28.signups, 9);

  const built = buildCreativeRows(
    grouped,
    { from: "2026-10-28", to: "2026-10-28" },
    "2026-10-31",
    DEFAULT_THRESHOLDS,
  );
  const row = built.find((item) => item.adId === "120");
  assert.ok(row);
  assert.equal(row.day, 4);
  assert.equal(row.spend, 50);
  assert.equal(row.ftds, 3);
  assert.equal(row.roasD1, 0.6);
  assert.equal(row.roasThroughD4, 1.2);
  assert.equal(row.maxDailySpend, 50);
  assert.equal(row.decision.verdict, "descartar");
  assert.equal(row.decision.motivo, "CPA FTD acima do limite");

  const other = built.find((item) => item.adId === "999");
  assert.equal(other, undefined);
});

test("o período não mistura dias de fora, e a idade usa o histórico", () => {
  const grouped = groupRows([
    {
      rt_ad_id: "1",
      rt_ad: "A",
      date: "2026-10-28",
      clicks: 10,
      cost: 20,
      revenuetype2: 10,
      convtype2: 1,
      convtype4: 1,
      convtype7: 0,
      convtype3: 2,
    },
    {
      rt_ad_id: "1",
      rt_ad: "A",
      date: "2026-10-29",
      clicks: 4,
      cost: 18,
      revenuetype2: 80,
      convtype2: 2,
      convtype4: 2,
      convtype7: 0,
      convtype3: 3,
    },
    {
      rt_ad_id: "1",
      rt_ad: "A",
      date: "2026-11-01",
      clicks: 6,
      cost: 100,
      revenuetype2: 300,
      convtype2: 3,
      convtype4: 3,
      convtype7: 0,
      convtype3: 4,
    },
  ]);

  const [row] = buildCreativeRows(
    grouped,
    { from: "2026-10-29", to: "2026-10-29" },
    "2026-11-02",
    { ...DEFAULT_THRESHOLDS, scaleSpendThreshold: 15 },
  );
  assert.ok(row);
  assert.equal(row.spend, 18);
  assert.equal(row.ftds, 2);
  assert.equal(row.cpaFtd, 9);
  assert.equal(row.day, 6);
  assert.equal(row.roasD1, 0.5);
  assert.ok(row.roasThroughD4 != null && Math.abs(row.roasThroughD4 - 90 / 38) < 1e-9);
  assert.ok(row.scaleRoas != null && Math.abs(row.scaleRoas - 390 / 138) < 1e-9);
  assert.equal(row.decision.verdict, "escalar");
});

test("criativo sem clique e sem custo não ganha D1", () => {
  const grouped = groupRows([
    {
      rt_ad_id: "1",
      rt_ad: "Fantasma",
      date: "2026-11-01",
      clicks: 0,
      cost: 0,
      revenuetype2: 10,
      convtype2: 1,
      convtype4: 0,
      convtype7: 1,
      convtype3: 0,
    },
  ]);
  const [row] = buildCreativeRows(
    grouped,
    { from: "2026-11-01", to: "2026-11-01" },
    "2026-11-03",
    DEFAULT_THRESHOLDS,
  );
  assert.equal(row.day, null);
  assert.equal(row.roasD1, null);
  assert.equal(row.decision.motivo, "mais redeposits do que FTDs");
});

test("resumo soma a conta e não a média dos ROAS", () => {
  const grouped = groupRows([
    {
      rt_ad_id: "1",
      rt_ad: "A",
      date: "2026-11-03",
      clicks: 10,
      cost: 40,
      revenuetype2: 80,
      convtype2: 4,
      convtype4: 4,
      convtype7: 0,
      convtype3: 4,
    },
    {
      rt_ad_id: "2",
      rt_ad: "B",
      date: "2026-11-03",
      clicks: 10,
      cost: 60,
      revenuetype2: 30,
      convtype2: 2,
      convtype4: 1,
      convtype7: 0,
      convtype3: 2,
    },
  ]);
  const rows = buildCreativeRows(
    grouped,
    { from: "2026-11-03", to: "2026-11-03" },
    "2026-11-03",
    DEFAULT_THRESHOLDS,
  );
  const summary = summarize(rows);
  assert.equal(summary.spend, 100);
  assert.equal(summary.ftds, 5);
  assert.equal(summary.cpaFtd, 20);
  assert.equal(summary.roas, 1.1);
  assert.equal(summary.escalar + summary.manter + summary.descartar, 2);
});

test("datas de período e fuso da Cidade do México", () => {
  assert.equal(mexicoToday(new Date("2026-11-03T05:30:00Z")), "2026-11-02");
  assert.equal(mexicoToday(new Date("2026-11-03T06:30:00Z")), "2026-11-03");
  assert.deepEqual(periodRange("2026-11-03", "today"), { from: "2026-11-03", to: "2026-11-03" });
  assert.deepEqual(periodRange("2026-11-03", "yesterday"), { from: "2026-11-02", to: "2026-11-02" });
  assert.deepEqual(periodRange("2026-11-03", "3"), { from: "2026-11-01", to: "2026-11-03" });
  assert.deepEqual(periodRange("2026-11-03", "7"), { from: "2026-10-28", to: "2026-11-03" });
  assert.deepEqual(periodRange("2026-11-03", "14"), { from: "2026-10-21", to: "2026-11-03" });
  assert.equal(addDays("2026-11-03", -29), "2026-10-05");
});

test("cada comprador aponta para a campanha certa e Todos Meta não filtra campanha", () => {
  assert.equal(campaignIdFor("all"), null);
  assert.equal(campaignIdFor("felipe"), "6adae4745021de703da2318f");
  assert.equal(campaignIdFor("erick"), "6ad59d58aecec9f79f73bcbf");
  assert.equal(campaignIdFor("daniel"), "6adae4ed876e7a21d12c861b");
});

test("a URL pede o relatório v2 e não os campos prontos de ROAS", () => {
  const all = buildReportUrl({
    apiKey: "test-key",
    from: "2026-10-05",
    to: "2026-11-03",
    page: 2,
    campaignId: null,
  });
  assert.equal(all.origin, "https://api.redtrack.io");
  assert.equal(all.pathname, "/report/v2");
  assert.equal(all.searchParams.get("api_key"), "test-key");
  assert.equal(all.searchParams.get("group"), "rt_ad_id,rt_ad,date");
  assert.equal(all.searchParams.get("source_id"), "6ad59d1d78b93e5c029c71fe");
  assert.equal(all.searchParams.get("campaign_id"), null);
  assert.equal(all.searchParams.get("timezone"), "America/Mexico_City");
  assert.equal(all.searchParams.get("per"), "1000");
  assert.equal(all.searchParams.get("page"), "2");
  const fields = all.searchParams.get("fields")?.split(",") ?? [];
  assert.deepEqual(fields, REPORT_FIELDS);
  for (const blocked of ["roas", "profit", "cpa", "total_revenue"]) {
    assert.equal(fields.includes(blocked), false);
  }

  const felipe = buildReportUrl({
    apiKey: "test-key",
    from: "2026-10-05",
    to: "2026-11-03",
    page: 1,
    campaignId: "6adae4745021de703da2318f",
  });
  assert.equal(felipe.searchParams.get("campaign_id"), "6adae4745021de703da2318f");
});

test("critérios inválidos voltam para o padrão e o vazio desliga o opcional", () => {
  const cleaned = sanitizeThresholds({
    cpaFtdMax: -5,
    roasD1Min: "1.8",
    aovMin: "",
    cpsMax: "4",
    scaleSpendThreshold: null,
    maxEvaluationDay: 4.8,
    minFtdsForSignal: -2,
  });
  assert.equal(cleaned.cpaFtdMax, DEFAULT_THRESHOLDS.cpaFtdMax);
  assert.equal(cleaned.roasD1Min, 1.8);
  assert.equal(cleaned.aovMin, null);
  assert.equal(cleaned.cpsMax, 4);
  assert.equal(cleaned.scaleSpendThreshold, null);
  assert.equal(cleaned.maxEvaluationDay, 4);
  assert.equal(cleaned.minFtdsForSignal, DEFAULT_THRESHOLDS.minFtdsForSignal);
  assert.equal(cleaned.roasD3Min, DEFAULT_THRESHOLDS.roasD3Min);
});

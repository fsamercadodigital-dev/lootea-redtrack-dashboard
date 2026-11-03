import assert from "node:assert/strict";
import test from "node:test";
import { campaignIdFor } from "./campaigns";
import { DEFAULT_THRESHOLDS, sanitizeThresholds } from "./config";
import { readReportRows } from "./report-body";
import { addDays, mexicoToday, periodRange } from "./dates";
import { buildCreativeRows, cpm, ctr, groupRows, summarize, type RawRow } from "./metrics";
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
  assert.equal(grouped.length, 4);

  const ad = grouped.find((item) => item.name === "VELHO");
  assert.ok(ad);
  assert.equal(ad.adId, "120");
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
  assert.equal(row.day, 3);
  assert.equal(row.spend, 50);
  assert.equal(row.ftds, 3);
  assert.equal(row.tracked, true);
  assert.notEqual(row.decision.verdict, "sem-veredito");

  const other = built.find((item) => item.adId === "999");
  assert.equal(other, undefined);
});

test("o mesmo criativo em outro anúncio e outra caixa entra na mesma soma", () => {
  const grouped = groupRows([
    {
      rt_ad_id: "1",
      rt_ad: "[HT7] - AD017-FB-ELEKTRA",
      date: "2026-11-01",
      clicks: 4,
      cost: 10,
      convtype4: 1,
    },
    {
      rt_ad_id: "2",
      rt_ad: "ad017-fb-elektra",
      date: "2026-11-01",
      clicks: 3,
      cost: 5,
      convtype4: 1,
    },
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]?.name, "AD017-FB-ELEKTRA");
  assert.equal(grouped[0]?.days[0]?.cost, 15);
  assert.equal(grouped[0]?.days[0]?.ftds, 2);
  assert.deepEqual(grouped[0]?.rawNames, ["[HT7] - AD017-FB-ELEKTRA", "ad017-fb-elektra"]);
});

test("o período não mistura dias de fora, e a idade usa o histórico", () => {
  const grouped = groupRows([
    {
      rt_ad_id: "1",
      rt_ad: "A",
      rt_adgroup: "[E] 28/10",
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
    DEFAULT_THRESHOLDS,
  );
  assert.ok(row);
  assert.equal(row.spend, 18);
  assert.equal(row.ftds, 2);
  assert.equal(row.cpaFtd, 9);
  assert.equal(row.day, 5);
  assert.equal(row.tracked, true);
  assert.equal(row.decision.verdict, "manter");
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
  assert.equal(row.tracked, false);
  assert.equal(row.decision.verdict, "sem-veredito");
  assert.equal(row.decision.motivo, "sem dia com gasto");
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
  assert.equal(summary.depositRevenue, 110);
  assert.equal(summary.ftds, 5);
  assert.equal(summary.cpaFtd, 20);
  assert.equal(summary.roas, 1.1);
  assert.equal(summary.semVeredito, 0);

  const gated = buildCreativeRows(
    grouped,
    { from: "2026-11-03", to: "2026-11-03" },
    "2026-11-03",
    { ...DEFAULT_THRESHOLDS, requireAdsetTag: true },
  );
  const gatedSummary = summarize(gated);
  assert.equal(gated.every((item) => item.decision.verdict === "sem-veredito"), true);
  assert.equal(gatedSummary.spend, 100);
  assert.equal(gatedSummary.ftds, 5);
  assert.equal(gatedSummary.roas, 1.1);
});

test("CPM e CTR ficam vazios quando não há impressões", () => {
  assert.equal(cpm(10, 0), null);
  assert.equal(ctr(5, 0), null);
  assert.equal(cpm(10, 1000), 10);
  assert.equal(ctr(25, 1000), 0.025);
});

test("datas de período e fuso da Cidade do México", () => {
  assert.equal(mexicoToday(new Date("2026-11-03T05:30:00Z")), "2026-11-02");
  assert.equal(mexicoToday(new Date("2026-11-03T06:30:00Z")), "2026-11-03");
  assert.deepEqual(periodRange("2026-11-03", "today"), { from: "2026-11-03", to: "2026-11-03" });
  assert.deepEqual(periodRange("2026-11-03", "yesterday"), { from: "2026-11-02", to: "2026-11-02" });
  assert.deepEqual(periodRange("2026-11-03", "7"), { from: "2026-10-28", to: "2026-11-03" });
  assert.deepEqual(periodRange("2026-11-03", "14"), { from: "2026-10-21", to: "2026-11-03" });
  assert.deepEqual(periodRange("2026-11-03", "30"), { from: "2026-10-05", to: "2026-11-03" });
  assert.deepEqual(periodRange("2026-11-03", "custom", { from: "2026-10-20", to: "2026-10-25" }), {
    from: "2026-10-20",
    to: "2026-10-25",
  });
  assert.equal(addDays("2026-11-03", -29), "2026-10-05");
});

test("aceita o array puro do RedTrack e também o objeto com items", () => {
  const row = {
    clicks: 0,
    convtype2: 1.5,
    cost: 1.25,
    date: "2026-10-22",
    rt_ad: "ELEKTRARIFA-HOOK1-CLOSE1",
    rt_ad_id: "120246834964730138",
  };
  const fromArray = readReportRows([row]);
  const fromObject = readReportRows({ items: [row], pagination: { total: 0 } });
  assert.equal(fromArray?.length, 1);
  assert.deepEqual(fromObject, fromArray);
  assert.equal(readReportRows({ ok: true }), null);
  assert.equal(readReportRows(null), null);

  const [creative] = groupRows(fromArray ?? []);
  assert.equal(creative?.days[0]?.clicks, 0);
  assert.equal(creative?.days[0]?.cost, 1.25);
  assert.equal(creative?.days[0]?.deposits, 1.5);
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
  assert.equal(all.searchParams.get("group"), "rt_ad_id,rt_ad,rt_adgroup,date");
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

test("critérios inválidos voltam para o padrão", () => {
  const cleaned = sanitizeThresholds({
    dia0SpendNoReg: -5,
    superWinnerRoas: "2.5",
    scaleDay: 8.9,
    checkpointRpr: "30",
  });
  assert.equal(cleaned.dia0SpendNoReg, DEFAULT_THRESHOLDS.dia0SpendNoReg);
  assert.equal(cleaned.superWinnerRoas, 2.5);
  assert.equal(cleaned.scaleDay, 8);
  assert.equal(cleaned.checkpointRpr, 30);
  assert.equal(cleaned.discardCohort, DEFAULT_THRESHOLDS.discardCohort);
});

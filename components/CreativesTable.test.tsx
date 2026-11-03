import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import CreativesTable, { sortCreatives } from "./CreativesTable";
import type { CreativeRow } from "../lib/metrics";

function row(partial: Pick<CreativeRow, "adId" | "name" | "spend"> & Partial<CreativeRow>): CreativeRow {
  return {
    adset: "[E] 01/11",
    tracked: true,
    day: 2,
    signups: 3,
    deposits: 1,
    ftds: 1,
    cpaFtd: 8,
    adRoas: 1.5,
    cohortRevenue: 12,
    cohortRoas: 1.5,
    rpr: 0,
    topCustomerShare: null,
    legacyShare: null,
    redeposits: 0,
    aov: 20,
    cps: 4,
    clicks: 10,
    depositRevenue: 12,
    decision: { verdict: "manter", motivo: "não mexer, não subir budget", alerts: [] },
    ...partial,
  };
}

const rows = [
  row({
    adId: "111",
    name: "Criativo caro",
    spend: 40,
    decision: { verdict: "descartar", motivo: "ROAS cohort abaixo de 0.8", alerts: [] },
  }),
  row({
    adId: "222",
    name: "LT-RIFA-001",
    spend: 12,
    decision: { verdict: "escalar", motivo: "Super Winner – Surf Scaling hoje", alerts: ["amostra pequena, não escalar"] },
  }),
];

test("a tabela mostra o crachá, o motivo, o nome e o id", () => {
  const html = renderToStaticMarkup(
    <CreativesTable rows={rows} sortKey="spend" sortDir="desc" onSort={() => undefined} />,
  );
  assert.match(html, /Escalar/);
  assert.match(html, /Descartar/);
  assert.match(html, /ROAS cohort abaixo de 0.8/);
  assert.match(html, /amostra pequena, não escalar/);
  assert.match(html, /LT-RIFA-001/);
  assert.match(html, /222/);
  assert.match(html, />D2</);
  assert.match(html, /Redep\/FTD/);
});

test("o gasto maior vem primeiro quando a ordem é decrescente", () => {
  const sorted = sortCreatives(rows, "spend", "desc");
  assert.deepEqual(
    sorted.map((item) => item.adId),
    ["111", "222"],
  );
  const byAction = sortCreatives(rows, "action", "asc");
  assert.equal(byAction[0]?.decision.verdict, "escalar");
});

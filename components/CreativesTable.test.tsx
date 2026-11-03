import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import CreativesTable, { sortCreatives } from "./CreativesTable";
import type { CreativeRow } from "../lib/metrics";

function row(partial: Pick<CreativeRow, "adId" | "name" | "spend"> & Partial<CreativeRow>): CreativeRow {
  return {
    day: 2,
    ftds: 1,
    cpaFtd: 8,
    roas: 1.5,
    roasD1: 1.5,
    roasThroughD4: 1.2,
    redeposits: 0,
    aov: 20,
    cps: 4,
    signups: 3,
    clicks: 10,
    depositRevenue: 12,
    maxDailySpend: partial.spend,
    scaleRoas: null,
    decision: { verdict: "manter", motivo: "janela de teste, volume baixo" },
    ...partial,
  };
}

const rows = [
  row({
    adId: "111",
    name: "Criativo caro",
    spend: 40,
    decision: { verdict: "descartar", motivo: "CPA FTD acima do limite" },
  }),
  row({
    adId: "222",
    name: "LT-RIFA-001",
    spend: 12,
    decision: { verdict: "escalar", motivo: "CPA FTD abaixo do limite, ROAS D1 no alvo, mais FTDs do que redeposits" },
  }),
];

test("a tabela mostra o crachá, o motivo, o nome e o id", () => {
  const html = renderToStaticMarkup(
    <CreativesTable rows={rows} sortKey="spend" sortDir="desc" onSort={() => undefined} />,
  );
  assert.match(html, /Escalar/);
  assert.match(html, /Descartar/);
  assert.match(html, /CPA FTD acima do limite/);
  assert.match(html, /LT-RIFA-001/);
  assert.match(html, /222/);
  assert.match(html, />D2</);
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

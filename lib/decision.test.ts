import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THRESHOLDS, type Thresholds } from "./config";
import { decide, type DecisionInput } from "./decision";

function sample(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    spend: 40,
    ftds: 5,
    redeposits: 1,
    cpaFtd: 8,
    roasD1: 1.5,
    roasThroughD4: 1.2,
    aov: 25,
    cps: 4,
    day: 2,
    scaleRoas: null,
    ...overrides,
  };
}

function limits(overrides: Partial<Thresholds> = {}): Thresholds {
  return { ...DEFAULT_THRESHOLDS, ...overrides };
}

test("escala com CPA 8, ROAS D1 1.50 e mais FTDs do que redeposits", () => {
  const decision = decide(sample(), limits());
  assert.equal(decision.verdict, "escalar");
  assert.equal(
    decision.motivo,
    "CPA FTD abaixo do limite, ROAS D1 no alvo, mais FTDs do que redeposits",
  );
});

test("escala pelo ROAS acumulado até D4 quando o D1 fica em 1.10", () => {
  const decision = decide(sample({ roasD1: 1.1, roasThroughD4: 2.4 }), limits());
  assert.equal(decision.verdict, "escalar");
  assert.equal(
    decision.motivo,
    "CPA FTD abaixo do limite, ROAS acumulado até D4 no alvo, mais FTDs do que redeposits",
  );
});

test("cita os dois ROAS quando D1 e o acumulado até D4 passam", () => {
  const decision = decide(sample({ roasD1: 1.6, roasThroughD4: 2.1 }), limits());
  assert.equal(decision.verdict, "escalar");
  assert.match(decision.motivo, /ROAS D1 e acumulado até D4/);
});

test("ainda escala no D5 se os critérios passam", () => {
  const decision = decide(sample({ day: 5 }), limits());
  assert.equal(decision.verdict, "escalar");
});

test("descarta CPA 10.01 com 1 FTD no D1, mesmo com ROAS alto", () => {
  const decision = decide(
    sample({ spend: 10.01, ftds: 1, cpaFtd: 10.01, redeposits: 0, roasD1: 3, day: 1 }),
    limits(),
  );
  assert.equal(decision.verdict, "descartar");
  assert.equal(decision.motivo, "CPA FTD acima do limite");
});

test("descarta gasto 20.01 sem FTD e mantém gasto 20.00 no D1", () => {
  const over = decide(sample({ spend: 20.01, ftds: 0, cpaFtd: null, redeposits: 0, day: 1 }), limits());
  assert.equal(over.verdict, "descartar");
  assert.equal(over.motivo, "gasto sem FTD acima de 2× o CPA máximo");

  const exact = decide(sample({ spend: 20, ftds: 0, cpaFtd: null, redeposits: 0, day: 1 }), limits());
  assert.equal(exact.verdict, "manter");
  assert.equal(exact.motivo, "janela de teste, volume baixo");
});

test("descarta quando redeposits passam dos FTDs, antes de avaliar escala", () => {
  const decision = decide(sample({ ftds: 3, redeposits: 4, cpaFtd: 5, roasD1: 3 }), limits());
  assert.equal(decision.verdict, "descartar");
  assert.equal(decision.motivo, "mais redeposits do que FTDs");
});

test("FTDs iguais aos redeposits não escalam", () => {
  const decision = decide(sample({ ftds: 3, redeposits: 3, cpaFtd: 5 }), limits());
  assert.equal(decision.verdict, "manter");
  assert.equal(decision.motivo, "janela de teste, critérios de escala ainda não fechados");
});

test("descarta CPS 6 quando o limite é 5 e ignora o CPS se não está configurado", () => {
  const blocked = decide(sample({ cps: 6 }), limits({ cpsMax: 5 }));
  assert.equal(blocked.verdict, "descartar");
  assert.equal(blocked.motivo, "CPS acima do limite");

  const open = decide(sample({ cps: 6, aov: null }), limits({ cpsMax: null, aovMin: null }));
  assert.equal(open.verdict, "escalar");
});

test("AOV 19 não escala se o mínimo é 20; sem mínimo, o AOV fica de fora", () => {
  const low = decide(sample({ aov: 19, ftds: 5 }), limits({ aovMin: 20 }));
  assert.equal(low.verdict, "manter");
  assert.equal(low.motivo, "janela de teste, critérios de escala ainda não fechados");

  const skipped = decide(sample({ aov: null }), limits({ aovMin: null }));
  assert.equal(skipped.verdict, "escalar");
});

test("AOV vazio não passa quando o mínimo está configurado", () => {
  const decision = decide(sample({ aov: null }), limits({ aovMin: 10 }));
  assert.equal(decision.verdict, "manter");
});

test("escala só se o ROAS dos dias caros atinge 2", () => {
  const weak = decide(sample({ scaleRoas: 1.9 }), limits({ scaleSpendThreshold: 100 }));
  assert.equal(weak.verdict, "manter");

  const none = decide(sample({ scaleRoas: null }), limits({ scaleSpendThreshold: 100 }));
  assert.equal(none.verdict, "manter");

  const strong = decide(sample({ scaleRoas: 2 }), limits({ scaleSpendThreshold: 100 }));
  assert.equal(strong.verdict, "escalar");

  const off = decide(sample({ scaleRoas: 1 }), limits({ scaleSpendThreshold: null }));
  assert.equal(off.verdict, "escalar");
});

test("no D3 com 2 FTDs mantém por volume baixo; no D4 descarta por prazo", () => {
  const inside = decide(
    sample({ day: 3, ftds: 2, redeposits: 2, cpaFtd: 8, roasD1: 1 }),
    limits(),
  );
  assert.equal(inside.verdict, "manter");
  assert.equal(inside.motivo, "janela de teste, volume baixo");

  const late = decide(
    sample({ day: 4, ftds: 2, redeposits: 2, cpaFtd: 8, roasD1: 1 }),
    limits(),
  );
  assert.equal(late.verdict, "descartar");
  assert.equal(late.motivo, "não atingiu critérios até o D3");
});

test("CPA exatamente 10 não descarta e não escala", () => {
  const decision = decide(sample({ cpaFtd: 10, ftds: 5 }), limits());
  assert.equal(decision.verdict, "manter");
  assert.equal(decision.motivo, "janela de teste, critérios de escala ainda não fechados");
});

test("sem dia de início descarta, mas o CPA alto vem primeiro", () => {
  const unknown = decide(sample({ day: null, roasD1: null, roasThroughD4: null }), limits());
  assert.equal(unknown.verdict, "descartar");
  assert.equal(unknown.motivo, "sem dia de início na janela de 30 dias");

  const expensive = decide(sample({ day: null, cpaFtd: 12, ftds: 2 }), limits());
  assert.equal(expensive.motivo, "CPA FTD acima do limite");
});

test("o texto do prazo acompanha o dia máximo", () => {
  const decision = decide(sample({ day: 6, roasD1: 1, ftds: 1, redeposits: 1 }), limits({ maxEvaluationDay: 5 }));
  assert.equal(decision.verdict, "descartar");
  assert.equal(decision.motivo, "não atingiu critérios até o D5");
});

test("baixar o CPA máximo para 7 descarta um CPA de 8", () => {
  const decision = decide(sample({ cpaFtd: 8, ftds: 5 }), limits({ cpaFtdMax: 7 }));
  assert.equal(decision.verdict, "descartar");
  assert.equal(decision.motivo, "CPA FTD acima do limite");
});

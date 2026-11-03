import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THRESHOLDS, type Thresholds } from "./config";
import { decide, type DecisionInput } from "./decision";

function sample(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    tracked: true,
    day: 1,
    spend: 40,
    signups: 20,
    deposits: 16,
    ftds: 16,
    redeposits: 4,
    cpaFtd: 2.5,
    adRoas: 2.4,
    cohortRoas: 1.8,
    rpr: 0.3,
    topCustomerShare: 0.2,
    legacyShare: 0.1,
    accountAvgCpa: 8,
    scaleBar: 1.5,
    ...overrides,
  };
}

function limits(overrides: Partial<Thresholds> = {}): Thresholds {
  return { ...DEFAULT_THRESHOLDS, ...overrides };
}

test("sem o prefixo do conjunto não há veredito quando a regra está ligada", () => {
  const decision = decide(sample({ tracked: false, day: 1, adRoas: 5, ftds: 20 }), limits());
  assert.equal(decision.verdict, "sem-veredito");
  assert.equal(decision.motivo, "sem marcação de conjunto");
});

test("dia 1 descarta gasto de 10 sem cadastro e gasto de 15 sem depósito", () => {
  const noReg = decide(sample({ day: 1, spend: 10, signups: 0, deposits: 2, ftds: 0 }), limits());
  assert.equal(noReg.verdict, "descartar");
  assert.equal(noReg.motivo, "D1: gasto sem registro");
  assert.equal(noReg.rule, "d1-registro");

  const noDep = decide(
    sample({ day: 1, spend: 15, signups: 4, deposits: 0, ftds: 0, adRoas: 0 }),
    limits(),
  );
  assert.equal(noDep.verdict, "descartar");
  assert.equal(noDep.motivo, "D1: gasto sem depósito");

  const under = decide(sample({ day: 1, spend: 9, signups: 0, deposits: 0, ftds: 0, adRoas: 0 }), limits());
  assert.equal(under.verdict, "manter");
});

test("Super Winner no D1 exige ROAS ≥ 2, 15 FTDs e CPA até 7.50", () => {
  const winner = decide(sample({ day: 1, adRoas: 2, ftds: 15, cpaFtd: 7.5 }), limits());
  assert.equal(winner.verdict, "escalar");
  assert.equal(winner.motivo, "Super Winner – Surf Scaling hoje");
  assert.equal(winner.rule, "d1-winner");

  const roasShort = decide(sample({ day: 1, adRoas: 1.99, ftds: 15, cpaFtd: 7 }), limits());
  assert.equal(roasShort.verdict, "manter");
  assert.equal(roasShort.motivo, "D1: sem corte e sem Super Winner");
});

test("dias 2 e 3 mantêm mesmo com ROAS ruim", () => {
  const decision = decide(
    sample({ day: 2, spend: 80, ftds: 1, cpaFtd: 80, adRoas: 0.2, cohortRoas: 0.2, redeposits: 0 }),
    limits(),
  );
  assert.equal(decision.verdict, "manter");
  assert.equal(decision.motivo, "D2–D3: manter, sem descartar por um dia ruim");
  assert.equal(decide(sample({ day: 3, cohortRoas: 0.1, adRoas: 0.1 }), limits()).motivo, "D2–D3: manter, sem descartar por um dia ruim");
});

test("D4 a D7 sobe, segura ou descarta por CPA, e o proxy ignora RPR", () => {
  const ok = decide(
    sample({ day: 5, ftds: 8, rpr: 0, adRoas: 1.2, cohortRoas: 0.2, redeposits: 2 }),
    limits(),
  );
  assert.equal(ok.verdict, "manter");
  assert.equal(ok.motivo, "D4: pode subir budget no ABO");
  assert.equal(ok.rule, "d4-subir");

  const quiet = decide(sample({ day: 4, ftds: 4, rpr: 0, adRoas: 2, redeposits: 1, cpaFtd: 12 }), limits());
  assert.equal(quiet.motivo, "D4–D7: checkpoint");
  assert.deepEqual(quiet.alerts, []);

  const killed = decide(
    sample({ day: 4, ftds: 2, cpaFtd: 16, accountAvgCpa: 8, redeposits: 0, rpr: 0, adRoas: 0.4 }),
    limits(),
  );
  assert.equal(killed.verdict, "descartar");
  assert.equal(killed.motivo, "D4: CPA FTD acima da média e nenhum redepósito");
  assert.equal(killed.rule, "d4-cpa");

  const suspect = decide(
    sample({ day: 6, ftds: 3, rpr: 0, cohortRoas: 0.59, adRoas: 2, redeposits: 1 }),
    limits(),
    "full",
  );
  assert.equal(suspect.verdict, "manter");
  assert.equal(suspect.motivo, "suspeito");
});

test("D8 escala, descarta ROAS abaixo de 0,8 ou fica no budget baixo", () => {
  const scale = decide(
    sample({
      day: 8,
      adRoas: 1.5,
      cohortRoas: 0.1,
      scaleBar: 1.5,
      ftds: 15,
      rpr: 0,
      topCustomerShare: 0.9,
      redeposits: 4,
    }),
    limits(),
  );
  assert.equal(scale.verdict, "escalar");
  assert.equal(scale.motivo, "D8: escalar");
  assert.equal(scale.rule, "d8-escalar");

  const low = decide(sample({ day: 9, adRoas: 0.79, cohortRoas: 4, ftds: 20, rpr: 0, redeposits: 3 }), limits());
  assert.equal(low.verdict, "descartar");
  assert.equal(low.motivo, "D8: ROAS abaixo do corte");

  const hold = decide(sample({ day: 10, adRoas: 1, cohortRoas: 0.1, scaleBar: 1.5, ftds: 20, rpr: 0, redeposits: 3 }), limits());
  assert.equal(hold.verdict, "manter");
  assert.equal(hold.motivo, "D8: budget baixo");
});

test("no proxy a baleia, a amostra e o legacy não entram no veredito", () => {
  const proxy = decide(
    sample({ day: 3, ftds: 4, topCustomerShare: 0.51, legacyShare: 0.41 }),
    limits(),
  );
  assert.equal(proxy.verdict, "manter");
  assert.deepEqual(proxy.alerts, []);

  const full = decide(
    sample({ day: 3, ftds: 4, topCustomerShare: 0.51, legacyShare: 0.41 }),
    limits(),
    "full",
  );
  assert.equal(full.verdict, "manter");
  assert.deepEqual(full.alerts, [
    "baleia: mais de 50% da receita",
    "amostra pequena, não escalar",
    "legado acima de 40%",
  ]);
});

test("redeposits acima dos FTDs não mudam a ação", () => {
  const decision = decide(
    sample({ day: 8, ftds: 16, redeposits: 40, cohortRoas: 2, scaleBar: 1.2, rpr: 0.4, topCustomerShare: 0.2 }),
    limits(),
  );
  assert.equal(decision.verdict, "escalar");
  assert.equal(decision.motivo, "D8: escalar");
});

test("com coorte a baleia impede o CBO porque o top cliente passa de 50%", () => {
  const decision = decide(
    sample({ day: 8, adRoas: 0.2, cohortRoas: 2, scaleBar: 1.2, ftds: 20, rpr: 0.4, topCustomerShare: 0.51, redeposits: 5 }),
    limits(),
    "full",
  );
  assert.equal(decision.verdict, "manter");
  assert.equal(decision.motivo, "D8: budget baixo");
  assert.ok(decision.alerts.includes("baleia: mais de 50% da receita"));
});

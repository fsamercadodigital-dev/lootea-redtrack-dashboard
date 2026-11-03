import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THRESHOLDS, type Thresholds } from "./config";
import { decide, type DecisionInput } from "./decision";

function sample(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    tracked: true,
    day: 0,
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
  const decision = decide(sample({ tracked: false, day: 0, adRoas: 5, ftds: 20 }), limits());
  assert.equal(decision.verdict, "sem-veredito");
  assert.equal(decision.motivo, "sem tracking completo");
});

test("dia 0 descarta gasto de 10 sem cadastro e gasto de 15 sem depósito", () => {
  const noReg = decide(sample({ day: 0, spend: 10, signups: 0, deposits: 2, ftds: 0 }), limits());
  assert.equal(noReg.verdict, "descartar");
  assert.equal(noReg.motivo, "dia 0: gasto sem cadastro");

  const noDep = decide(
    sample({ day: 0, spend: 15, signups: 4, deposits: 0, ftds: 0, adRoas: 0 }),
    limits(),
  );
  assert.equal(noDep.verdict, "descartar");
  assert.equal(noDep.motivo, "dia 0: gasto sem depósito");

  const under = decide(sample({ day: 0, spend: 9, signups: 0, deposits: 0, ftds: 0, adRoas: 0 }), limits());
  assert.equal(under.verdict, "manter");
});

test("Super Winner no dia 0 exige ROAS > 2, 15 FTDs e CPA até 7.50", () => {
  const winner = decide(sample({ day: 0, adRoas: 2.01, ftds: 15, cpaFtd: 7.5 }), limits());
  assert.equal(winner.verdict, "escalar");
  assert.equal(winner.motivo, "Super Winner – Surf Scaling hoje");

  const roasShort = decide(sample({ day: 0, adRoas: 2, ftds: 15, cpaFtd: 7 }), limits());
  assert.equal(roasShort.verdict, "manter");
  assert.equal(roasShort.motivo, "dia 0, sem kill e sem Super Winner");
});

test("dias 1 e 2 mantêm mesmo com ROAS ruim", () => {
  const decision = decide(
    sample({ day: 1, spend: 80, ftds: 1, cpaFtd: 80, adRoas: 0.2, cohortRoas: 0.2, redeposits: 0 }),
    limits(),
  );
  assert.equal(decision.verdict, "manter");
  assert.equal(decision.motivo, "não mexer, não subir budget");
  assert.equal(decide(sample({ day: 2, cohortRoas: 0.1 }), limits()).motivo, "não mexer, não subir budget");
});

test("dias 3 a 6 mantêm, com checkpoint, suspeito ou descarte por CPA", () => {
  const ok = decide(
    sample({ day: 4, ftds: 8, rpr: 0.2, cohortRoas: 1.21, redeposits: 2 }),
    limits(),
  );
  assert.equal(ok.verdict, "manter");
  assert.equal(ok.motivo, "pode subir budget dentro do ABO");

  const suspect = decide(sample({ day: 5, ftds: 3, rpr: 0, cohortRoas: 0.59, redeposits: 1 }), limits());
  assert.equal(suspect.verdict, "manter");
  assert.equal(suspect.motivo, "suspeito");

  const quiet = decide(sample({ day: 3, ftds: 4, rpr: 0.1, cohortRoas: 1, redeposits: 1, cpaFtd: 12 }), limits());
  assert.equal(quiet.motivo, "checkpoint dias 3–6");

  const killed = decide(
    sample({ day: 3, ftds: 2, cpaFtd: 16, accountAvgCpa: 8, redeposits: 0, rpr: 0, cohortRoas: 0.4 }),
    limits(),
  );
  assert.equal(killed.verdict, "descartar");
  assert.equal(killed.motivo, "CPA ≥ 2× a média geral e zero redeposits");
});

test("dia 7 escala em CBO, descarta cohort abaixo de 0.8 ou fica no ABO", () => {
  const scale = decide(
    sample({
      day: 7,
      cohortRoas: 1.5,
      scaleBar: 1.5,
      ftds: 15,
      rpr: 0.25,
      topCustomerShare: 0.5,
      redeposits: 4,
    }),
    limits(),
  );
  assert.equal(scale.verdict, "escalar");
  assert.equal(scale.motivo, "escalar em CBO");

  const low = decide(sample({ day: 8, cohortRoas: 0.79, ftds: 20, rpr: 0.4, redeposits: 3 }), limits());
  assert.equal(low.verdict, "descartar");
  assert.equal(low.motivo, "ROAS cohort abaixo de 0.8");

  const hold = decide(sample({ day: 9, cohortRoas: 1, scaleBar: 1.5, ftds: 20, rpr: 0.4, redeposits: 3 }), limits());
  assert.equal(hold.verdict, "manter");
  assert.equal(hold.motivo, "ABO budget baixo fixo");
});

test("baleia, amostra pequena e legacy são alertas e não trocam a ação", () => {
  const decision = decide(
    sample({ day: 2, ftds: 4, topCustomerShare: 0.51, legacyShare: 0.41 }),
    limits(),
  );
  assert.equal(decision.verdict, "manter");
  assert.deepEqual(decision.alerts, [
    "baleia: mais de 50% da receita",
    "amostra pequena, não escalar",
    "legacy acima de 40%",
  ]);
});

test("redeposits acima dos FTDs não mudam a ação", () => {
  const decision = decide(
    sample({ day: 7, ftds: 16, redeposits: 40, cohortRoas: 2, scaleBar: 1.2, rpr: 0.4, topCustomerShare: 0.2 }),
    limits(),
  );
  assert.equal(decision.verdict, "escalar");
  assert.equal(decision.motivo, "escalar em CBO");
});

test("no dia 7 a baleia impede o CBO porque o top cliente passa de 50%", () => {
  const decision = decide(
    sample({ day: 7, cohortRoas: 2, scaleBar: 1.2, ftds: 20, rpr: 0.4, topCustomerShare: 0.51, redeposits: 5 }),
    limits(),
  );
  assert.equal(decision.verdict, "manter");
  assert.equal(decision.motivo, "ABO budget baixo fixo");
  assert.ok(decision.alerts.includes("baleia: mais de 50% da receita"));
});

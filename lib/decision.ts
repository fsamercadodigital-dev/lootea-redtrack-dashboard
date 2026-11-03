import type { Thresholds } from "./config";

export type Verdict = "escalar" | "manter" | "descartar" | "sem-veredito";

/** Identifica a frase do SOP que decidiu o criativo. O painel conta o impacto ao vivo. */
export type RuleId =
  | "sem-dia"
  | "sem-marcacao"
  | "d1-registro"
  | "d1-deposito"
  | "d1-winner"
  | "d1-manter"
  | "d2-manter"
  | "d4-subir"
  | "d4-cpa"
  | "d4-manter"
  | "d8-escalar"
  | "d8-descartar"
  | "d8-manter";

export type Decision = {
  verdict: Verdict;
  motivo: string;
  alerts: string[];
  rule: RuleId;
};

/**
 * Métricas de um anúncio no período, mais a idade (D1 = dia de lançamento).
 * cohortRoas, rpr, topCustomerShare e legacyShare só entram com coorte real.
 */
export type DecisionInput = {
  tracked: boolean;
  day: number | null;
  spend: number;
  signups: number;
  deposits: number;
  ftds: number;
  redeposits: number;
  cpaFtd: number | null;
  /** ROAS de Ad Tracking: receita de depósitos ÷ gasto. */
  adRoas: number | null;
  cohortRoas: number | null;
  /** 0 a 1. Null quando não dá para calcular. */
  rpr: number | null;
  topCustomerShare: number | null;
  legacyShare: number | null;
  accountAvgCpa: number | null;
  scaleBar: number | null;
};

/** D1 é o lançamento. D4 abre o checkpoint. D8 é a decisão. */
const OBSERVE_END = 3;
const DECISION_DAY = 8;

function percent(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value * 100;
}

function alertsFor(input: DecisionInput, thresholds: Thresholds): string[] {
  const alerts: string[] = [];
  const top = percent(input.topCustomerShare);
  const legacy = percent(input.legacyShare);
  if (top != null && top > thresholds.whaleShare) alerts.push("baleia: mais de 50% da receita");
  if (input.ftds < thresholds.smallSampleFtd) alerts.push("amostra pequena, não escalar");
  if (legacy != null && legacy > thresholds.legacyAlert) alerts.push("legado acima de 40%");
  return alerts;
}

/**
 * SOP com a idade em D.
 * Em proxy o ROAS é receita de depósito ÷ gasto. RPR, baleia, legacy, suspeito e amostra não entram.
 */
export function decide(
  input: DecisionInput,
  thresholds: Thresholds,
  cohort: "proxy" | "full" = "proxy",
): Decision {
  const full = cohort === "full";
  const roasValue = full ? input.cohortRoas : input.adRoas;

  function finish(verdict: Verdict, motivo: string, rule: RuleId): Decision {
    return { verdict, motivo, alerts: full ? alertsFor(input, thresholds) : [], rule };
  }

  if (input.day == null || input.day < 1) {
    return finish("sem-veredito", "sem dia com gasto", "sem-dia");
  }

  if (!input.tracked) {
    return finish("sem-veredito", "sem marcação de conjunto", "sem-marcacao");
  }

  if (input.day === 1) {
    if (input.spend >= thresholds.dia0SpendNoReg && input.signups <= 0) {
      return finish("descartar", "D1: gasto sem registro", "d1-registro");
    }
    if (input.spend >= thresholds.dia0SpendNoDeposit && input.deposits <= 0) {
      return finish("descartar", "D1: gasto sem depósito", "d1-deposito");
    }
    const superWinner =
      input.adRoas != null &&
      input.adRoas >= thresholds.superWinnerRoas &&
      input.ftds >= thresholds.superWinnerFtd &&
      input.cpaFtd != null &&
      input.cpaFtd <= thresholds.superWinnerCpa;
    if (superWinner) {
      return finish("escalar", "Super Winner – Surf Scaling hoje", "d1-winner");
    }
    return finish("manter", "D1: sem corte e sem Super Winner", "d1-manter");
  }

  if (input.day >= 2 && input.day <= OBSERVE_END) {
    return finish("manter", "D2–D3: manter, sem descartar por um dia ruim", "d2-manter");
  }

  const rprPct = percent(input.rpr);
  const topPct = percent(input.topCustomerShare);
  const expensiveAndDry =
    input.redeposits <= 0 &&
    input.cpaFtd != null &&
    input.accountAvgCpa != null &&
    input.accountAvgCpa > 0 &&
    input.cpaFtd >= input.accountAvgCpa * thresholds.cpaMultiple;

  if (input.day < DECISION_DAY) {
    if (expensiveAndDry) {
      return finish("descartar", "D4: CPA FTD acima da média e nenhum redepósito", "d4-cpa");
    }
    const rprOk = !full || (rprPct != null && rprPct >= thresholds.checkpointRpr);
    const checkpointOk =
      input.ftds >= thresholds.checkpointFtd && roasValue != null && roasValue >= thresholds.checkpointCohort && rprOk;
    if (checkpointOk) {
      return finish("manter", "D4: pode subir budget no ABO", "d4-subir");
    }
    if (full && roasValue != null && roasValue < thresholds.suspectCohort && rprPct === 0) {
      return finish("manter", "suspeito", "d4-manter");
    }
    return finish("manter", "D4–D7: checkpoint", "d4-manter");
  }

  const topOk = !full || topPct == null || topPct <= thresholds.scaleTopMax;
  const rprOk = !full || (rprPct != null && rprPct >= thresholds.scaleRpr);
  const canScale =
    roasValue != null &&
    input.scaleBar != null &&
    roasValue >= input.scaleBar &&
    input.ftds >= thresholds.scaleFtd &&
    rprOk &&
    topOk;

  if (canScale) {
    return finish("escalar", "D8: escalar", "d8-escalar");
  }

  if (roasValue != null && roasValue < thresholds.discardCohort) {
    return finish("descartar", "D8: ROAS abaixo do corte", "d8-descartar");
  }

  return finish("manter", "D8: budget baixo", "d8-manter");
}

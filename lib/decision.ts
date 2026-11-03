import type { Thresholds } from "./config";

export type Verdict = "escalar" | "manter" | "descartar" | "sem-veredito";

export type Decision = {
  verdict: Verdict;
  motivo: string;
  alerts: string[];
};

/**
 * Métricas de um anúncio no período, mais a idade (dia 1 = dia de lançamento).
 * cohortRoas, rpr, topCustomerShare e legacyShare vêm da coorte quando ela existe.
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

function withAlerts(input: DecisionInput, thresholds: Thresholds, verdict: Verdict, motivo: string): Decision {
  return { verdict, motivo, alerts: alertsFor(input, thresholds) };
}

/**
 * SOP Teste, Decisão e Scaling.
 * Dia 1 é o lançamento, o primeiro dia com gasto. Sem a marcação do conjunto, não há veredito.
 */
export function decide(input: DecisionInput, thresholds: Thresholds): Decision {
  if (input.day == null) {
    return withAlerts(input, thresholds, "sem-veredito", "sem dia com gasto");
  }

  if (!input.tracked) {
    return withAlerts(input, thresholds, "sem-veredito", "sem marcação de conjunto");
  }

  if (input.day === 1) {
    if (input.spend >= thresholds.dia0SpendNoReg && input.signups <= 0) {
      return withAlerts(input, thresholds, "descartar", "dia 1: gasto sem cadastro");
    }
    if (input.spend >= thresholds.dia0SpendNoDeposit && input.deposits <= 0) {
      return withAlerts(input, thresholds, "descartar", "dia 1: gasto sem depósito");
    }
    const superWinner =
      input.adRoas != null &&
      input.adRoas > thresholds.superWinnerRoas &&
      input.ftds >= thresholds.superWinnerFtd &&
      input.cpaFtd != null &&
      input.cpaFtd <= thresholds.superWinnerCpa;
    if (superWinner) {
      return withAlerts(input, thresholds, "escalar", "Super Winner – Surf Scaling hoje");
    }
    return withAlerts(input, thresholds, "manter", "dia 1, sem descarte e sem Super Winner");
  }

  if (input.day >= 2 && input.day <= thresholds.earlyDayEnd) {
    return withAlerts(input, thresholds, "manter", "não mexer, não subir o orçamento");
  }

  const rprPct = percent(input.rpr);
  const topPct = percent(input.topCustomerShare);
  const expensiveAndDry =
    input.day > thresholds.earlyDayEnd &&
    input.redeposits <= 0 &&
    input.cpaFtd != null &&
    input.accountAvgCpa != null &&
    input.accountAvgCpa > 0 &&
    input.cpaFtd >= input.accountAvgCpa * thresholds.cpaMultiple;

  if (input.day > thresholds.earlyDayEnd && input.day < thresholds.scaleDay) {
    if (expensiveAndDry) {
      return withAlerts(input, thresholds, "descartar", "CPA ≥ 2× a média geral e zero Redeposit");
    }
    const checkpointOk =
      input.ftds >= thresholds.checkpointFtd &&
      rprPct != null &&
      rprPct >= thresholds.checkpointRpr &&
      input.cohortRoas != null &&
      input.cohortRoas > thresholds.checkpointCohort;
    const suspect =
      input.cohortRoas != null &&
      input.cohortRoas < thresholds.suspectCohort &&
      rprPct === 0;
    const motivo = checkpointOk
      ? "pode subir o orçamento no ABO"
      : suspect
        ? "suspeito"
        : `checagem dos dias ${thresholds.earlyDayEnd + 1}–${thresholds.scaleDay - 1}`;
    return withAlerts(input, thresholds, "manter", motivo);
  }

  if (expensiveAndDry) {
    return withAlerts(input, thresholds, "descartar", "CPA ≥ 2× a média geral e zero Redeposit");
  }

  const topOk = topPct == null || topPct <= thresholds.scaleTopMax;
  const canScale =
    input.cohortRoas != null &&
    input.scaleBar != null &&
    input.cohortRoas >= input.scaleBar &&
    input.ftds >= thresholds.scaleFtd &&
    rprPct != null &&
    rprPct >= thresholds.scaleRpr &&
    topOk;

  if (canScale) {
    return withAlerts(input, thresholds, "escalar", "escalar em CBO");
  }

  if (input.cohortRoas != null && input.cohortRoas < thresholds.discardCohort) {
    return withAlerts(input, thresholds, "descartar", "ROAS da coorte abaixo de 0,8");
  }

  return withAlerts(input, thresholds, "manter", "ABO com orçamento baixo fixo");
}

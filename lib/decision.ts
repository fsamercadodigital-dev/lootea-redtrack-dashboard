import type { Thresholds } from "./config";

export type Verdict = "escalar" | "manter" | "descartar";

export type Decision = {
  verdict: Verdict;
  motivo: string;
};

/**
 * Números já agregados de um criativo.
 * roasThroughD4 é o ROAS acumulado do D1 até o D4 (não só os dias 3 e 4).
 * scaleRoas é o ROAS dos dias em que o gasto passou de scaleSpendThreshold.
 */
export type DecisionInput = {
  spend: number;
  ftds: number;
  redeposits: number;
  cpaFtd: number | null;
  roasD1: number | null;
  roasThroughD4: number | null;
  aov: number | null;
  cps: number | null;
  day: number | null;
  scaleRoas: number | null;
};

function meetsMinimum(value: number | null, minimum: number): boolean {
  return value != null && value >= minimum;
}

/**
 * Ordem: descartes duros, depois escalar, depois manter dentro da janela,
 * senão descartar por prazo.
 */
export function decide(input: DecisionInput, thresholds: Thresholds): Decision {
  if (input.ftds >= 1 && input.cpaFtd != null && input.cpaFtd > thresholds.cpaFtdMax) {
    return { verdict: "descartar", motivo: "CPA FTD acima do limite" };
  }

  if (input.ftds <= 0 && input.spend > thresholds.cpaFtdMax * 2) {
    return { verdict: "descartar", motivo: "gasto sem FTD acima de 2× o CPA máximo" };
  }

  if (input.redeposits > input.ftds) {
    return { verdict: "descartar", motivo: "mais redeposits do que FTDs" };
  }

  if (thresholds.cpsMax != null && input.cps != null && input.cps > thresholds.cpsMax) {
    return { verdict: "descartar", motivo: "CPS acima do limite" };
  }

  const cpaOk = input.cpaFtd != null && input.cpaFtd < thresholds.cpaFtdMax;
  const roasD1Ok = meetsMinimum(input.roasD1, thresholds.roasD1Min);
  const roasD4Ok = meetsMinimum(input.roasThroughD4, thresholds.roasD3Min);
  const moreFtds = input.ftds > input.redeposits;
  const aovOk =
    thresholds.aovMin == null || (input.aov != null && input.aov >= thresholds.aovMin);
  const scaleOk =
    thresholds.scaleSpendThreshold == null ||
    meetsMinimum(input.scaleRoas, thresholds.scaleRoasMin);

  if (cpaOk && (roasD1Ok || roasD4Ok) && moreFtds && aovOk && scaleOk) {
    const roasMotivo =
      roasD1Ok && roasD4Ok
        ? "ROAS D1 e acumulado até D4 no alvo"
        : roasD1Ok
          ? "ROAS D1 no alvo"
          : "ROAS acumulado até D4 no alvo";
    return {
      verdict: "escalar",
      motivo: `CPA FTD abaixo do limite, ${roasMotivo}, mais FTDs do que redeposits`,
    };
  }

  if (input.day != null && input.day <= thresholds.maxEvaluationDay) {
    return {
      verdict: "manter",
      motivo:
        input.ftds < thresholds.minFtdsForSignal
          ? "janela de teste, volume baixo"
          : "janela de teste, critérios de escala ainda não fechados",
    };
  }

  if (input.day == null) {
    return { verdict: "descartar", motivo: "sem dia de início na janela de 30 dias" };
  }

  return {
    verdict: "descartar",
    motivo: `não atingiu critérios até o D${thresholds.maxEvaluationDay}`,
  };
}

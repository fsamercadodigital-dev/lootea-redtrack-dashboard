/**
 * Limites padrão da decisão. O painel deixa editar e guarda no navegador.
 * Valores em USD. null = critério desligado ("não configurado").
 */
export type Thresholds = {
  cpaFtdMax: number;
  roasD1Min: number;
  roasD3Min: number;
  aovMin: number | null;
  cpsMax: number | null;
  scaleSpendThreshold: number | null;
  scaleRoasMin: number;
  maxEvaluationDay: number;
  minFtdsForSignal: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  cpaFtdMax: 10,
  roasD1Min: 1.4,
  roasD3Min: 2,
  aovMin: null,
  cpsMax: null,
  scaleSpendThreshold: null,
  scaleRoasMin: 2,
  maxEvaluationDay: 3,
  minFtdsForSignal: 3,
};

export const TIME_ZONE = "America/Mexico_City";
export const LOOKBACK_DAYS = 30;
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const REDTRACK_SOURCE_ID = "6ad59d1d78b93e5c029c71fe";
export const PAGE_SIZE = 1000;

export const BUYERS = [
  { id: "all", label: "Todos Meta" },
  { id: "felipe", label: "Felipe" },
  { id: "erick", label: "Erick" },
  { id: "daniel", label: "Daniel" },
] as const;

export type BuyerId = (typeof BUYERS)[number]["id"];

export function isBuyerId(value: string): value is BuyerId {
  return BUYERS.some((buyer) => buyer.id === value);
}

function requiredNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number;
}

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

function wholeNumber(value: unknown, fallback: number, min: number): number {
  const number = requiredNumber(value, fallback);
  return Math.max(min, Math.floor(number));
}

/** Aceita o que veio do localStorage e completa com o padrão. */
export function sanitizeThresholds(value: unknown): Thresholds {
  const raw = value && typeof value === "object" ? (value as Partial<Thresholds>) : {};
  return {
    cpaFtdMax: requiredNumber(raw.cpaFtdMax, DEFAULT_THRESHOLDS.cpaFtdMax),
    roasD1Min: requiredNumber(raw.roasD1Min, DEFAULT_THRESHOLDS.roasD1Min),
    roasD3Min: requiredNumber(raw.roasD3Min, DEFAULT_THRESHOLDS.roasD3Min),
    aovMin: optionalNumber(raw.aovMin),
    cpsMax: optionalNumber(raw.cpsMax),
    scaleSpendThreshold: optionalNumber(raw.scaleSpendThreshold),
    scaleRoasMin: requiredNumber(raw.scaleRoasMin, DEFAULT_THRESHOLDS.scaleRoasMin),
    maxEvaluationDay: wholeNumber(raw.maxEvaluationDay, DEFAULT_THRESHOLDS.maxEvaluationDay, 1),
    minFtdsForSignal: wholeNumber(raw.minFtdsForSignal, DEFAULT_THRESHOLDS.minFtdsForSignal, 0),
  };
}

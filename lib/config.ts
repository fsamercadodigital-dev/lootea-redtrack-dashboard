/**
 * Limites da SOP. O painel deixa editar e guarda no navegador.
 * Dinheiro em USD. RPR, top cliente, baleia e legacy estão em porcentagem (20 = 20%).
 */
export type Thresholds = {
  dia0SpendNoReg: number;
  dia0SpendNoDeposit: number;
  superWinnerRoas: number;
  superWinnerFtd: number;
  superWinnerCpa: number;
  earlyDayEnd: number;
  checkpointFtd: number;
  checkpointRpr: number;
  checkpointCohort: number;
  suspectCohort: number;
  cpaMultiple: number;
  scaleDay: number;
  scaleBarMultiple: number;
  scaleFtd: number;
  scaleRpr: number;
  scaleTopMax: number;
  discardCohort: number;
  whaleShare: number;
  smallSampleFtd: number;
  legacyAlert: number;
  /** Quando ligado, só o conjunto [E]/[F]/[D] + data entra no veredito e nas médias. */
  requireAdsetTag: boolean;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  dia0SpendNoReg: 10,
  dia0SpendNoDeposit: 15,
  superWinnerRoas: 2,
  superWinnerFtd: 15,
  superWinnerCpa: 7.5,
  earlyDayEnd: 2,
  checkpointFtd: 8,
  checkpointRpr: 20,
  checkpointCohort: 1.2,
  suspectCohort: 0.6,
  cpaMultiple: 2,
  scaleDay: 7,
  scaleBarMultiple: 1.2,
  scaleFtd: 15,
  scaleRpr: 25,
  scaleTopMax: 50,
  discardCohort: 0.8,
  whaleShare: 50,
  smallSampleFtd: 15,
  legacyAlert: 40,
  requireAdsetTag: false,
};

export const TIME_ZONE = "America/Mexico_City";
export const LOOKBACK_DAYS = 30;
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const REDTRACK_SOURCE_ID = "6ad59d1d78b93e5c029c71fe";
export const PAGE_SIZE = 1000;
export const CONVERSION_PAGE_SIZE = 10000;
export const CONVERSION_PAGE_CAP = 8;

export const BUYERS = [
  { id: "all", label: "Todos os gestores" },
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

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function wholeNumber(value: unknown, fallback: number, min: number): number {
  const number = requiredNumber(value, fallback);
  return Math.max(min, Math.floor(number));
}

/** Aceita o que veio do localStorage e completa com o padrão. */
export function sanitizeThresholds(value: unknown): Thresholds {
  const raw = value && typeof value === "object" ? (value as Partial<Thresholds>) : {};
  return {
    dia0SpendNoReg: requiredNumber(raw.dia0SpendNoReg, DEFAULT_THRESHOLDS.dia0SpendNoReg),
    dia0SpendNoDeposit: requiredNumber(raw.dia0SpendNoDeposit, DEFAULT_THRESHOLDS.dia0SpendNoDeposit),
    superWinnerRoas: requiredNumber(raw.superWinnerRoas, DEFAULT_THRESHOLDS.superWinnerRoas),
    superWinnerFtd: wholeNumber(raw.superWinnerFtd, DEFAULT_THRESHOLDS.superWinnerFtd, 0),
    superWinnerCpa: requiredNumber(raw.superWinnerCpa, DEFAULT_THRESHOLDS.superWinnerCpa),
    earlyDayEnd: wholeNumber(raw.earlyDayEnd, DEFAULT_THRESHOLDS.earlyDayEnd, 1),
    checkpointFtd: wholeNumber(raw.checkpointFtd, DEFAULT_THRESHOLDS.checkpointFtd, 0),
    checkpointRpr: requiredNumber(raw.checkpointRpr, DEFAULT_THRESHOLDS.checkpointRpr),
    checkpointCohort: requiredNumber(raw.checkpointCohort, DEFAULT_THRESHOLDS.checkpointCohort),
    suspectCohort: requiredNumber(raw.suspectCohort, DEFAULT_THRESHOLDS.suspectCohort),
    cpaMultiple: requiredNumber(raw.cpaMultiple, DEFAULT_THRESHOLDS.cpaMultiple),
    scaleDay: wholeNumber(raw.scaleDay, DEFAULT_THRESHOLDS.scaleDay, 1),
    scaleBarMultiple: requiredNumber(raw.scaleBarMultiple, DEFAULT_THRESHOLDS.scaleBarMultiple),
    scaleFtd: wholeNumber(raw.scaleFtd, DEFAULT_THRESHOLDS.scaleFtd, 0),
    scaleRpr: requiredNumber(raw.scaleRpr, DEFAULT_THRESHOLDS.scaleRpr),
    scaleTopMax: requiredNumber(raw.scaleTopMax, DEFAULT_THRESHOLDS.scaleTopMax),
    discardCohort: requiredNumber(raw.discardCohort, DEFAULT_THRESHOLDS.discardCohort),
    whaleShare: requiredNumber(raw.whaleShare, DEFAULT_THRESHOLDS.whaleShare),
    smallSampleFtd: wholeNumber(raw.smallSampleFtd, DEFAULT_THRESHOLDS.smallSampleFtd, 0),
    legacyAlert: requiredNumber(raw.legacyAlert, DEFAULT_THRESHOLDS.legacyAlert),
    requireAdsetTag: flag(raw.requireAdsetTag, DEFAULT_THRESHOLDS.requireAdsetTag),
  };
}

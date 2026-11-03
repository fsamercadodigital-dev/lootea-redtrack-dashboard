import { DEFAULT_THRESHOLDS, sanitizeThresholds, type Thresholds } from "./config";

const STORAGE_KEY = "lootea.criteria.v3";
const PREVIOUS_KEY = "lootea.criteria.v2";

/**
 * A v2 contava o lançamento como dia 0. A v3 conta como dia 1,
 * então os dois limites de idade avançam um dia e o calendário da SOP não muda.
 */
export function migrateV2Thresholds(raw: unknown): Thresholds {
  const parsed = sanitizeThresholds(raw);
  return { ...parsed, earlyDayEnd: parsed.earlyDayEnd + 1, scaleDay: parsed.scaleDay + 1 };
}

export function readStoredThresholds(): Thresholds {
  if (typeof window === "undefined") return { ...DEFAULT_THRESHOLDS };
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return sanitizeThresholds(JSON.parse(current));
    const previous = window.localStorage.getItem(PREVIOUS_KEY);
    if (!previous) return { ...DEFAULT_THRESHOLDS };
    return migrateV2Thresholds(JSON.parse(previous));
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

export function storeThresholds(value: Thresholds) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // O navegador pode bloquear o armazenamento. Os critérios seguem valendo nesta visita.
  }
}

import { DEFAULT_THRESHOLDS, sanitizeThresholds, type Thresholds } from "./config";

const STORAGE_KEY = "lootea.criteria.v2";

export function readStoredThresholds(): Thresholds {
  if (typeof window === "undefined") return { ...DEFAULT_THRESHOLDS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THRESHOLDS };
    return sanitizeThresholds(JSON.parse(raw));
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

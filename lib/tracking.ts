/**
 * Conjunto no padrão [E], [F] ou [D] seguido de uma data.
 * Os conjuntos reais do Felipe (nov/2026) não usam isso: "CONJUNTO - 1 / RIFA",
 * "México 18/45", "WINNERS REMAKE", "BATCH#1-CrespoLF", "LT-LF-CRESPO-001".
 */
export function hasFullTracking(adsetName: string): boolean {
  return /^\s*\[(E|F|D)\][\s\-_./]*\d/.test(adsetName);
}

/** Conjunto no padrão [E], [F] ou [D] seguido de uma data. */
export function hasFullTracking(adsetName: string): boolean {
  return /^\s*\[(E|F|D)\][\s\-_./]*\d/.test(adsetName);
}

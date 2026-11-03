export const UNIDENTIFIED_NAME = "Nome não identificado";

const COPY_SUFFIX = /(?:\s+-\s*(?:c[oó]pia|copy)|\s*\(\s*c[oó]pia\s*\))\s*$/i;
const EDGE_TAG = String.raw`(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|["'][^"']*["'])`;
const LEADING_TAG = new RegExp(String.raw`^\s*${EDGE_TAG}\s*(?:[-|:_]\s*)?`, "i");
const TRAILING_TAG = new RegExp(String.raw`\s*(?:[-|:_]\s*)?${EDGE_TAG}\s*$`, "i");
const SPACED_SEPARATOR = /\s+-\s+|\s+\|\s+|\s+\/\s+|\s+:\s+/;

function stripCopy(value: string): string {
  let current = value.trim();
  let previous = "";
  while (current && current !== previous) {
    previous = current;
    current = current.replace(COPY_SUFFIX, "").trim();
  }
  return current;
}

function stripEdgeTags(value: string): string {
  let current = value.trim();
  let previous = "";
  while (current && current !== previous) {
    previous = current;
    current = current.replace(LEADING_TAG, "").replace(TRAILING_TAG, "").trim();
  }
  return current;
}

function collapseHyphens(value: string): string {
  return value.replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim();
}

function looksLikeCreative(segment: string): boolean {
  const collapsed = collapseHyphens(segment);
  if (/^LT-/i.test(collapsed)) return true;
  if (/^AD\d+/i.test(collapsed)) return true;
  return /[-_]/.test(collapsed) && /\d/.test(collapsed);
}

function isAccountToken(segment: string): boolean {
  const token = segment.trim();
  if (!token || /^\d+$/.test(token) || /^v\d+$/i.test(token)) return false;
  return /^[A-Za-z]{1,8}\d{0,4}$/.test(token);
}

function placeholder(value: string): boolean {
  const upper = value.trim().toUpperCase();
  if (!upper) return true;
  if (upper.includes("{{") || upper.includes("}}")) return true;
  if (new RegExp(String.raw`^${EDGE_TAG}$`, "i").test(upper)) return true;
  return false;
}

function fromLtSegments(parts: string[]): string | null {
  const start = parts.findIndex((part) => {
    const collapsed = collapseHyphens(part);
    return /^lt$/i.test(collapsed) || /^lt-/i.test(collapsed);
  });
  if (start < 0) return null;
  const slice = parts.slice(start);
  while (slice.length > 1 && isAccountToken(slice[slice.length - 1] ?? "")) slice.pop();
  const joined = collapseHyphens(slice.join("-")).toUpperCase();
  return /^LT-/.test(joined) ? joined : null;
}

/** Nome estável do criativo. Maiúsculas, sem a tag da conta. */
function dropSpacedAccountSuffix(value: string): string {
  const parts = value.split(/\s+-\s+/);
  while (parts.length > 1 && isAccountToken(parts[parts.length - 1] ?? "")) parts.pop();
  return parts.join(" - ");
}

export function normalizeAdName(raw: string | null | undefined): string {
  const source = String(raw ?? "");
  if (source.includes("{{") || source.includes("}}")) return UNIDENTIFIED_NAME;

  const stripped = dropSpacedAccountSuffix(stripEdgeTags(stripCopy(source)));
  if (!stripped) return UNIDENTIFIED_NAME;

  const collapsed = collapseHyphens(stripped).toUpperCase();
  if (/^LT-/.test(collapsed)) return collapsed;

  const parts = stripped
    .split(SPACED_SEPARATOR)
    .map((part) => stripEdgeTags(stripCopy(part)))
    .filter(Boolean);
  const ltName = fromLtSegments(parts);
  if (ltName) return ltName;

  const chosen = parts.find(looksLikeCreative) ?? parts[parts.length - 1] ?? "";
  const result = collapseHyphens(stripEdgeTags(chosen)).toUpperCase();
  if (placeholder(result) || !result) return UNIDENTIFIED_NAME;
  return result;
}

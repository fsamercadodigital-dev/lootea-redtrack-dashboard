"use client";

import type { Verdict } from "@/lib/decision";
import { formatCount, formatDay, formatPercent, formatRatio, formatRoas, formatUsd } from "@/lib/format";
import type { CreativeRow } from "@/lib/metrics";

export type SortKey =
  | "name"
  | "day"
  | "spend"
  | "signups"
  | "ftds"
  | "cpaFtd"
  | "cohortRoas"
  | "rpr"
  | "redepPerFtd"
  | "topCustomerShare"
  | "legacyShare"
  | "action"
  | "redeposits"
  | "aov"
  | "cps"
  | "clicks";

export type SortDir = "asc" | "desc";

type Props = {
  rows: CreativeRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
};

const VERDICT_LABEL: Record<Verdict, string> = {
  escalar: "Escalar",
  manter: "Manter",
  descartar: "Descartar",
  "sem-veredito": "Sem veredito",
};

const ACTION_ORDER: Record<Verdict, number> = {
  escalar: 0,
  manter: 1,
  descartar: 2,
  "sem-veredito": 3,
};

type Column = {
  key: SortKey;
  label: string;
  title: string;
  align: "left" | "right";
  secondary?: boolean;
  split?: boolean;
};

const COLUMNS: Column[] = [
  { key: "name", label: "Criativo", title: "Nome mais recente e ID do anúncio", align: "left" },
  { key: "day", label: "Dia", title: "Dia 0 é o primeiro dia com gasto", align: "right" },
  { key: "spend", label: "Gasto", title: "Custo no período", align: "right" },
  { key: "signups", label: "Registros", title: "Cadastros no período", align: "right" },
  { key: "ftds", label: "FTD", title: "Primeiros depósitos no período", align: "right" },
  { key: "cpaFtd", label: "CPA FTD", title: "Gasto ÷ FTDs", align: "right" },
  { key: "cohortRoas", label: "ROAS cohort", title: "Receita da coorte ÷ gasto. Sem coorte, usa o Ad Tracking", align: "right" },
  { key: "rpr", label: "RPR", title: "Percentual de FTDs com redeposit", align: "right" },
  { key: "redepPerFtd", label: "Redep/FTD", title: "Redeposits ÷ FTDs no período", align: "right" },
  { key: "topCustomerShare", label: "Top cliente", title: "Maior cliente ÷ receita da coorte", align: "right" },
  { key: "legacyShare", label: "Legacy", title: "Receita do anúncio vinda de usuários de outra coorte", align: "right" },
  { key: "action", label: "Ação", title: "Decisão, motivo e alertas", align: "left" },
  { key: "redeposits", label: "Redeposits", title: "Depósitos que não são o primeiro", align: "right", secondary: true, split: true },
  { key: "aov", label: "AOV", title: "Receita de depósitos ÷ depósitos", align: "right", secondary: true },
  { key: "cps", label: "CPS", title: "Gasto ÷ cadastros", align: "right", secondary: true },
  { key: "clicks", label: "Cliques", title: "Cliques no período", align: "right", secondary: true },
];

function rank(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value === Number.POSITIVE_INFINITY) return Number.MAX_VALUE;
  if (!Number.isFinite(value)) return null;
  return value;
}

function readNumber(row: CreativeRow, key: SortKey): number | null {
  switch (key) {
    case "action":
      return ACTION_ORDER[row.decision.verdict];
    case "day":
      return row.day;
    case "spend":
      return row.spend;
    case "signups":
      return row.signups;
    case "ftds":
      return row.ftds;
    case "cpaFtd":
      return row.cpaFtd;
    case "cohortRoas":
      return row.cohortRoas;
    case "rpr":
      return row.rpr;
    case "redepPerFtd":
      return row.ftds > 0 ? row.redeposits / row.ftds : null;
    case "topCustomerShare":
      return row.topCustomerShare;
    case "legacyShare":
      return row.legacyShare;
    case "redeposits":
      return row.redeposits;
    case "aov":
      return row.aov;
    case "cps":
      return row.cps;
    case "clicks":
      return row.clicks;
    default:
      return null;
  }
}

export function sortCreatives(rows: CreativeRow[], key: SortKey, dir: SortDir): CreativeRow[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "name") {
      const byName = a.name.localeCompare(b.name, "pt-BR") * factor;
      return byName !== 0 ? byName : a.adId.localeCompare(b.adId);
    }
    const left = rank(readNumber(a, key));
    const right = rank(readNumber(b, key));
    if (left == null || right == null) {
      if (left == null && right == null) return a.name.localeCompare(b.name, "pt-BR");
      return left == null ? 1 : -1;
    }
    if (left !== right) return (left - right) * factor;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export default function CreativesTable({ rows, sortKey, sortDir, onSort }: Props) {
  const sorted = sortCreatives(rows, sortKey, sortDir);

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Criativos Meta no período, com a ação recomendada</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = sortKey === column.key;
              const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";
              return (
                <th
                  key={column.key}
                  aria-sort={ariaSort}
                  className={`${column.align === "left" ? "left" : "num"}${column.secondary ? " secondary" : ""}${column.split ? " split" : ""}`}
                >
                  <button type="button" className="sort" title={column.title} onClick={() => onSort(column.key)}>
                    {column.label}
                    {active ? <span aria-hidden="true">{sortDir === "asc" ? " ↑" : " ↓"}</span> : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.adId} data-verdict={row.decision.verdict}>
              <td className="left">
                <div className="creative">
                  <span className="creative-name" title={row.rawNames.length > 1 ? row.rawNames.join("\n") : undefined}>
                    {row.name}
                  </span>
                  {row.name !== row.adId ? <span className="ad-id">{row.adId}</span> : null}
                </div>
              </td>
              <td className="num">{formatDay(row.day)}</td>
              <td className="num">{formatUsd(row.spend)}</td>
              <td className="num">{formatCount(row.signups)}</td>
              <td className="num">{formatCount(row.ftds)}</td>
              <td className="num">{formatUsd(row.cpaFtd)}</td>
              <td className="num">{formatRoas(row.cohortRoas)}</td>
              <td className="num">{formatPercent(row.rpr)}</td>
              <td className="num">{formatRatio(row.ftds > 0 ? row.redeposits / row.ftds : null)}</td>
              <td className="num">{formatPercent(row.topCustomerShare)}</td>
              <td className="num">{formatPercent(row.legacyShare)}</td>
              <td className="left">
                <div className="action">
                  <span className="verdict">
                    <span className={`dot ${row.decision.verdict}`} aria-hidden="true" />
                    {VERDICT_LABEL[row.decision.verdict]}
                  </span>
                  <span className="motivo">{row.decision.motivo}</span>
                  {row.decision.alerts.length > 0 ? (
                    <span className="tags">
                      {row.decision.alerts.map((alert) => (
                        <span key={alert} className="tag">
                          {alert}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="num secondary split">{formatCount(row.redeposits)}</td>
              <td className="num secondary">{formatUsd(row.aov)}</td>
              <td className="num secondary">{formatUsd(row.cps)}</td>
              <td className="num secondary">{formatCount(row.clicks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import type { Verdict } from "@/lib/decision";
import { formatCount, formatDay, formatRoas, formatUsd } from "@/lib/format";
import type { CreativeRow } from "@/lib/metrics";

export type SortKey =
  | "action"
  | "name"
  | "day"
  | "spend"
  | "ftds"
  | "cpaFtd"
  | "roas"
  | "roasD1"
  | "roasThroughD4"
  | "redeposits"
  | "aov"
  | "cps"
  | "signups"
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
};

const ACTION_ORDER: Record<Verdict, number> = {
  escalar: 0,
  manter: 1,
  descartar: 2,
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
  { key: "action", label: "Ação", title: "Decisão e motivo", align: "left" },
  { key: "name", label: "Criativo", title: "Nome mais recente e ID do anúncio", align: "left" },
  { key: "day", label: "Dia", title: "Idade até hoje, a partir do primeiro dia com cliques ou custo", align: "right" },
  { key: "spend", label: "Gasto", title: "Custo no período", align: "right" },
  { key: "ftds", label: "FTDs", title: "Primeiros depósitos no período", align: "right" },
  { key: "cpaFtd", label: "CPA FTD", title: "Gasto ÷ FTDs", align: "right" },
  { key: "roas", label: "ROAS", title: "Receita de depósitos ÷ gasto, no período", align: "right" },
  { key: "roasD1", label: "ROAS D1", title: "ROAS só do primeiro dia com cliques ou custo", align: "right" },
  {
    key: "roasThroughD4",
    label: "ROAS até D4",
    title: "Receita e gasto acumulados do D1 ao D4",
    align: "right",
  },
  {
    key: "redeposits",
    label: "Redeposits",
    title: "Depósitos que não são o primeiro",
    align: "right",
    secondary: true,
    split: true,
  },
  { key: "aov", label: "AOV", title: "Receita de depósitos ÷ depósitos", align: "right", secondary: true },
  { key: "cps", label: "CPS", title: "Gasto ÷ cadastros", align: "right", secondary: true },
  { key: "signups", label: "Cadastros", title: "Cadastros no período", align: "right", secondary: true },
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
    case "ftds":
      return row.ftds;
    case "cpaFtd":
      return row.cpaFtd;
    case "roas":
      return row.roas;
    case "roasD1":
      return row.roasD1;
    case "roasThroughD4":
      return row.roasThroughD4;
    case "redeposits":
      return row.redeposits;
    case "aov":
      return row.aov;
    case "cps":
      return row.cps;
    case "signups":
      return row.signups;
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

function money(value: number | null): string {
  return formatUsd(value);
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
                  <button
                    type="button"
                    className="sort"
                    title={column.title}
                    onClick={() => onSort(column.key)}
                  >
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
                <div className="action">
                  <span className={`badge ${row.decision.verdict}`}>{VERDICT_LABEL[row.decision.verdict]}</span>
                  <span className="motivo">{row.decision.motivo}</span>
                </div>
              </td>
              <td className="left">
                <div className="creative">
                  <span className="creative-name">{row.name}</span>
                  {row.name !== row.adId ? <span className="ad-id">{row.adId}</span> : null}
                </div>
              </td>
              <td className="num">{formatDay(row.day)}</td>
              <td className="num" title={`Maior gasto em um dia: ${formatUsd(row.maxDailySpend)}`}>
                {money(row.spend)}
              </td>
              <td className="num">{formatCount(row.ftds)}</td>
              <td className="num">{money(row.cpaFtd)}</td>
              <td className="num">{formatRoas(row.roas)}</td>
              <td className="num">{formatRoas(row.roasD1)}</td>
              <td className="num">{formatRoas(row.roasThroughD4)}</td>
              <td className="num secondary split">{formatCount(row.redeposits)}</td>
              <td className="num secondary">{money(row.aov)}</td>
              <td className="num secondary">{money(row.cps)}</td>
              <td className="num secondary">{formatCount(row.signups)}</td>
              <td className="num secondary">{formatCount(row.clicks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

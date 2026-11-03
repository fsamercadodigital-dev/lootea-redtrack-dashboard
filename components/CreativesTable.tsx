"use client";

import type { Verdict } from "@/lib/decision";
import { formatCount, formatDay, formatPercent, formatRoas, formatUsd } from "@/lib/format";
import type { CreativeRow } from "@/lib/metrics";

export type SortKey =
  | "name"
  | "day"
  | "spend"
  | "deposits"
  | "depositRevenue"
  | "cpaDeposit"
  | "aovDeposit"
  | "ftds"
  | "redeposits"
  | "cpaFtd"
  | "ftdRevenue"
  | "roas"
  | "cpm"
  | "cpc"
  | "clicks"
  | "ctr"
  | "d1"
  | "d2"
  | "d3"
  | "d4"
  | "action";

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
};

const COLUMNS: Column[] = [
  { key: "name", label: "Criativo", title: "Nome normalizado", align: "left" },
  { key: "day", label: "Dia", title: "Dia 0 é o primeiro dia com gasto", align: "right" },
  { key: "spend", label: "Spend", title: "Custo", align: "right" },
  { key: "deposits", label: "Depósitos", title: "Depósitos no período", align: "right" },
  { key: "depositRevenue", label: "Deposit Rev", title: "Receita dos depósitos", align: "right" },
  { key: "cpaDeposit", label: "CPA Deposit", title: "Custo ÷ depósitos", align: "right" },
  { key: "aovDeposit", label: "AOV Deposit", title: "Receita de depósitos ÷ depósitos", align: "right" },
  { key: "ftds", label: "FTD", title: "Primeiros depósitos", align: "right" },
  { key: "redeposits", label: "Redeposit", title: "Depósitos depois do primeiro", align: "right" },
  { key: "cpaFtd", label: "CPA FTD", title: "Custo ÷ FTDs", align: "right" },
  { key: "ftdRevenue", label: "Revenue FTD", title: "Receita dos primeiros depósitos", align: "right" },
  { key: "roas", label: "ROAS", title: "Receita de depósitos ÷ custo", align: "right" },
  { key: "cpm", label: "CPM", title: "Custo por mil impressões. Vazio sem impressões", align: "right" },
  { key: "cpc", label: "CPC", title: "Custo ÷ cliques", align: "right" },
  { key: "clicks", label: "Cliques no link", title: "Cliques no link", align: "right" },
  { key: "ctr", label: "CTR", title: "Cliques ÷ impressões. Vazio sem impressões", align: "right" },
  { key: "d1", label: "D1", title: "Gasto no primeiro dia", align: "right" },
  { key: "d2", label: "D2", title: "Gasto no segundo dia", align: "right" },
  { key: "d3", label: "D3", title: "Gasto no terceiro dia", align: "right" },
  { key: "d4", label: "D4", title: "Gasto no quarto dia", align: "right" },
  { key: "action", label: "Ação", title: "Decisão", align: "left" },
];

function rank(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
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
    case "deposits":
      return row.deposits;
    case "depositRevenue":
      return row.depositRevenue;
    case "cpaDeposit":
      return row.cpaDeposit;
    case "aovDeposit":
      return row.aov;
    case "ftds":
      return row.ftds;
    case "redeposits":
      return row.redeposits;
    case "cpaFtd":
      return row.cpaFtd;
    case "ftdRevenue":
      return row.ftdRevenue;
    case "roas":
      return row.adRoas;
    case "cpm":
      return row.cpm;
    case "cpc":
      return row.cpc;
    case "clicks":
      return row.clicks;
    case "ctr":
      return row.ctr;
    case "d1":
      return row.earlySpend[0];
    case "d2":
      return row.earlySpend[1];
    case "d3":
      return row.earlySpend[2];
    case "d4":
      return row.earlySpend[3];
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

function textFor(row: CreativeRow, key: SortKey): string {
  switch (key) {
    case "spend":
    case "depositRevenue":
    case "cpaDeposit":
    case "cpaFtd":
    case "ftdRevenue":
    case "cpm":
    case "cpc":
      return formatUsd(readNumber(row, key));
    case "aovDeposit":
      return formatUsd(row.aov);
    case "roas":
      return formatRoas(row.adRoas);
    case "ctr":
      return formatPercent(row.ctr);
    case "d1":
    case "d2":
    case "d3":
    case "d4":
      return formatUsd(readNumber(row, key));
    case "deposits":
    case "ftds":
    case "redeposits":
    case "clicks":
      return formatCount(readNumber(row, key) ?? 0);
    default:
      return "";
  }
}

export default function CreativesTable({ rows, sortKey, sortDir, onSort }: Props) {
  const sorted = sortCreatives(rows, sortKey, sortDir);

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Criativos no período, com a ação recomendada</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = sortKey === column.key;
              return (
                <th
                  key={column.key}
                  aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  className={column.align === "left" ? "left" : "num"}
                >
                  <button type="button" className="sort" title={column.title} onClick={() => onSort(column.key)}>
                    {column.label}
                    {active ? <span aria-hidden="true">{sortDir === "asc" ? " ↑" : " ↓"}</span> : null}
                  </button>
                </th>
              );
            })}
            <th className="left">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.adId} data-verdict={row.decision.verdict}>
              <td className="left">
                <div className="creative">
                  <span
                    className="creative-name"
                    title={[row.name, row.adId, ...row.rawNames.filter((name) => name !== row.name)].join("\n")}
                  >
                    {row.name}
                  </span>
                </div>
              </td>
              <td className="num">{formatDay(row.day)}</td>
              {COLUMNS.slice(2).map((column) =>
                column.key === "action" ? (
                  <td key={column.key} className="left">
                    <span className={`pill ${row.decision.verdict}`}>{VERDICT_LABEL[row.decision.verdict]}</span>
                  </td>
                ) : (
                  <td key={column.key} className="num">
                    {textFor(row, column.key)}
                  </td>
                ),
              )}
              <td className="left">
                <span
                  className="motivo"
                  title={[row.decision.motivo, ...row.decision.alerts].join(" · ")}
                >
                  {[row.decision.motivo, ...row.decision.alerts].join(" · ")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { Fragment, useState } from "react";
import type { Verdict } from "@/lib/decision";
import { formatShortDate } from "@/lib/dates";
import { formatCount, formatLaunch, formatPercent, formatRoas, formatUsd } from "@/lib/format";
import type { CreativeRow, EarlyDay } from "@/lib/metrics";

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
  | "earlyRoas"
  | "action";

export type SortDir = "asc" | "desc";

type Props = {
  rows: CreativeRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  showGestores?: boolean;
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
  width: string;
};

const COLUMNS: Column[] = [
  { key: "name", label: "Criativo", title: "Nome normalizado", align: "left", width: "16%" },
  { key: "day", label: "Lançamento", title: "Data do primeiro gasto e idade. O lançamento é o dia 1", align: "left", width: "7%" },
  { key: "spend", label: "Spend", title: "Spend", align: "right", width: "6%" },
  { key: "deposits", label: "Dep.", title: "Depósitos", align: "right", width: "4%" },
  { key: "depositRevenue", label: "Dep. Rev", title: "Deposit Rev", align: "right", width: "6.2%" },
  { key: "cpaDeposit", label: "CPA Dep.", title: "CPA Deposit", align: "right", width: "5.6%" },
  { key: "aovDeposit", label: "AOV Dep.", title: "AOV Deposit", align: "right", width: "5.4%" },
  { key: "roas", label: "ROAS", title: "ROAS", align: "right", width: "4.2%" },
  { key: "ftds", label: "FTD", title: "FTD", align: "right", width: "3.6%" },
  { key: "redeposits", label: "Redep.", title: "Redeposit", align: "right", width: "4.2%" },
  { key: "cpaFtd", label: "CPA FTD", title: "CPA FTD", align: "right", width: "5.4%" },
  { key: "ftdRevenue", label: "Rev. FTD", title: "Revenue FTD", align: "right", width: "5.6%" },
  { key: "cpm", label: "CPM", title: "CPM", align: "right", width: "4.2%" },
  { key: "cpc", label: "CPC", title: "CPC", align: "right", width: "4.2%" },
  { key: "clicks", label: "Cliques", title: "Cliques no link", align: "right", width: "4.6%" },
  { key: "ctr", label: "CTR", title: "CTR", align: "right", width: "4%" },
  { key: "earlyRoas", label: "ROAS D1–D4", title: "ROAS do dia de lançamento e dos três dias seguintes", align: "right", width: "13%" },
  { key: "action", label: "Ação", title: "Decisão. O motivo aparece ao passar o mouse.", align: "left", width: "6.8%" },
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
    case "earlyRoas":
      return row.earlyDays[0]?.roas ?? null;
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

function earlyText(day: EarlyDay | null): string {
  if (!day || day.roas == null) return "—";
  return formatRoas(day.roas);
}

function earlyTip(day: EarlyDay | null, index: number): string {
  if (!day) return `D${index + 1}: dia ainda não chegou`;
  const roas = day.roas == null ? "—" : formatRoas(day.roas);
  return `${formatShortDate(day.date)} · Spend ${formatUsd(day.spend)} · Deposit Rev ${formatUsd(day.depositRevenue)} · ROAS ${roas}`;
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
    case "deposits":
    case "ftds":
    case "redeposits":
    case "clicks":
      return formatCount(readNumber(row, key) ?? 0);
    default:
      return "";
  }
}

function motivoTitle(row: CreativeRow): string {
  return [row.decision.motivo, ...row.decision.alerts].filter(Boolean).join(" · ");
}

function EarlyRoas({ days }: { days: CreativeRow["earlyDays"] }) {
  return (
    <span className="early-roas">
      {days.map((day, index) => (
        <span key={index} title={earlyTip(day, index)}>
          {index > 0 ? " · " : ""}
          {earlyText(day)}
        </span>
      ))}
    </span>
  );
}

function MetricCells({ row }: { row: CreativeRow }) {
  return (
    <>
      {COLUMNS.slice(2).map((column) => {
        if (column.key === "action") {
          return (
            <td key={column.key} className="left">
              <span className={`pill ${row.decision.verdict}`} title={motivoTitle(row)}>
                {VERDICT_LABEL[row.decision.verdict]}
              </span>
            </td>
          );
        }
        if (column.key === "earlyRoas") {
          return (
            <td key={column.key} className="num">
              <EarlyRoas days={row.earlyDays} />
            </td>
          );
        }
        return (
          <td key={column.key} className="num">
            {textFor(row, column.key)}
          </td>
        );
      })}
    </>
  );
}

export default function CreativesTable({ rows, sortKey, sortDir, onSort, showGestores = false }: Props) {
  const sorted = sortCreatives(rows, sortKey, sortDir);
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(name: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Criativos no período, com a ação recomendada</caption>
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
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
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const gestores = showGestores ? (row.gestorRows ?? []) : [];
            const canExpand = gestores.length > 1;
            const expanded = canExpand && open.has(row.name);
            return (
              <Fragment key={row.name}>
                <tr data-verdict={row.decision.verdict}>
                  <td className="left">
                    <div className="creative">
                      {canExpand ? (
                        <button
                          type="button"
                          className={expanded ? "chevron open" : "chevron"}
                          aria-expanded={expanded}
                          aria-label={`Gestores de ${row.name}`}
                          onClick={() => toggle(row.name)}
                        >
                          <svg viewBox="0 0 12 12" aria-hidden="true">
                            <path d="M4 2.5 8 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      ) : (
                        <span className="chevron-space" />
                      )}
                      <div className="creative-copy">
                        <span
                          className="creative-name"
                          title={[row.name, row.adId, ...row.rawNames.filter((name) => name !== row.name)].join("\n")}
                        >
                          {row.name}
                        </span>
                        {gestores.length > 0 ? (
                          <span className="gestores">{gestores.map((item) => item.gestorLabel).join(" · ")}</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="left">{formatLaunch(row.launchDate, row.day)}</td>
                  <MetricCells row={row} />
                </tr>
                {expanded
                  ? gestores.map((child) => (
                      <tr key={`${row.name}:${child.gestorId}`} className="sub" data-verdict={child.decision.verdict}>
                        <td className="left">
                          <div className="creative sub">
                            <span className="chevron-space" />
                            <span className="creative-name">{child.gestorLabel}</span>
                          </div>
                        </td>
                        <td className="left">{formatLaunch(child.launchDate, child.day)}</td>
                        <MetricCells row={child} />
                      </tr>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

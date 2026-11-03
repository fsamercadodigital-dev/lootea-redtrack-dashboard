"use client";

import { formatCount, formatRoas, formatUsd } from "@/lib/format";
import type { Summary } from "@/lib/metrics";
import type { Verdict } from "@/lib/decision";

type ActionFilter = "todas" | Verdict;

type Props = {
  summary: Summary;
  action: ActionFilter;
  onAction: (action: ActionFilter) => void;
};

const VERDICTS: { id: Verdict; label: string }[] = [
  { id: "escalar", label: "Escalar" },
  { id: "manter", label: "Manter" },
  { id: "descartar", label: "Descartar" },
];

export default function SummaryCards({ summary, action, onAction }: Props) {
  return (
    <section className="cards" aria-label="Resumo do período">
      <article className="card">
        <p>Gasto</p>
        <strong>{formatUsd(summary.spend)}</strong>
      </article>
      <article className="card">
        <p>FTDs</p>
        <strong>{formatCount(summary.ftds)}</strong>
      </article>
      <article className="card">
        <p>CPA FTD</p>
        <strong>{formatUsd(summary.cpaFtd)}</strong>
      </article>
      <article className="card">
        <p>ROAS</p>
        <strong>{formatRoas(summary.roas)}</strong>
      </article>
      {VERDICTS.map((verdict) => {
        const selected = action === verdict.id;
        return (
          <button
            key={verdict.id}
            type="button"
            className={`card card-action ${verdict.id}${selected ? " selected" : ""}`}
            aria-pressed={selected}
            onClick={() => onAction(selected ? "todas" : verdict.id)}
          >
            <p>{verdict.label}</p>
            <strong>{summary[verdict.id]}</strong>
          </button>
        );
      })}
    </section>
  );
}

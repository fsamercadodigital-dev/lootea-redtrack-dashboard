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
  { id: "sem-veredito", label: "Sem veredito" },
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
        <p>CPA médio</p>
        <strong>{formatUsd(summary.cpaFtd)}</strong>
      </article>
      <article className="card">
        <p>ROAS cohort</p>
        <strong>{formatRoas(summary.cohortRoas)}</strong>
      </article>
      <article className="card">
        <p>Barra</p>
        <strong>{formatRoas(summary.scaleBar)}</strong>
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
            <strong>{summary[verdict.id === "sem-veredito" ? "semVeredito" : verdict.id]}</strong>
          </button>
        );
      })}
    </section>
  );
}

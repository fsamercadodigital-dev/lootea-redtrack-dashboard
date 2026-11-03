"use client";

import { formatCount, formatRoas, formatUsd } from "@/lib/format";
import type { Summary } from "@/lib/metrics";

type Props = {
  summary: Summary;
};

export default function SummaryCards({ summary }: Props) {
  const items = [
    ["Gasto", formatUsd(summary.spend)],
    ["FTDs", formatCount(summary.ftds)],
    ["CPA FTD", formatUsd(summary.cpaFtd)],
    ["ROAS", formatRoas(summary.cohortRoas)],
    ["Barra", formatRoas(summary.scaleBar)],
  ] as const;

  return (
    <section className="kpis" aria-label="Resumo do período">
      {items.map(([label, value]) => (
        <div key={label} className="kpi">
          <p>{label}</p>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

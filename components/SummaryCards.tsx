"use client";

import { formatCount, formatRoas, formatUsd } from "@/lib/format";
import type { Summary } from "@/lib/metrics";

type Props = {
  summary: Summary;
};

export default function SummaryCards({ summary }: Props) {
  const items = [
    ["Spend", formatUsd(summary.spend)],
    ["Deposit Rev", formatUsd(summary.depositRevenue)],
    ["ROAS", formatRoas(summary.roas)],
    ["FTD", formatCount(summary.ftds)],
    ["CPA FTD", formatUsd(summary.cpaFtd)],
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

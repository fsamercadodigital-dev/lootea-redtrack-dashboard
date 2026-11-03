"use client";

import { useEffect, useState } from "react";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/config";
import type { RuleId } from "@/lib/decision";
import type { CriteriaLive } from "@/lib/metrics";

type Props = {
  thresholds: Thresholds;
  live: CriteriaLive;
  onChange: (value: Thresholds) => void;
};

type Range = { min: number; max: number; integer: boolean };

const RANGES = {
  dia0SpendNoReg: { min: 0, max: 1000, integer: false },
  dia0SpendNoDeposit: { min: 0, max: 1000, integer: false },
  superWinnerRoas: { min: 0, max: 20, integer: false },
  superWinnerFtd: { min: 0, max: 500, integer: true },
  superWinnerCpa: { min: 0, max: 500, integer: false },
  checkpointCohort: { min: 0, max: 20, integer: false },
  checkpointFtd: { min: 0, max: 500, integer: true },
  cpaMultiple: { min: 1, max: 10, integer: false },
  scaleBarMultiple: { min: 0.5, max: 5, integer: false },
  scaleFtd: { min: 0, max: 500, integer: true },
  discardCohort: { min: 0, max: 5, integer: false },
} satisfies Partial<Record<keyof Thresholds, Range>>;

type NumericKey = keyof typeof RANGES;

function show(value: number, integer: boolean): string {
  if (integer) return String(Math.trunc(value));
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

function stillTyping(raw: string): boolean {
  const trimmed = raw.trim().replace(",", ".");
  return trimmed === "" || trimmed === "." || /^\d+\.$/.test(trimmed);
}

function parseDraft(raw: string, range: Range): number | null {
  const trimmed = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < range.min || value > range.max) return null;
  if (range.integer && !Number.isInteger(value)) return null;
  return value;
}

function changed(value: number, fallback: number): boolean {
  return Math.abs(value - fallback) > 1e-9;
}

function impact(count: number): string {
  return count === 1 ? "afeta 1 criativo agora" : `afeta ${count} criativos agora`;
}

function pt(value: number, digits = 2): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function money(value: number): string {
  return `$${pt(value)}`;
}

function ruleCount(live: CriteriaLive, id: RuleId): number {
  return live.rules[id] ?? 0;
}

type NumberProps = {
  value: number;
  fallback: number;
  range: Range;
  prefix?: string;
  suffix?: string;
  label: string;
  onCommit: (value: number) => void;
};

function InlineNumber({ value, fallback, range, prefix, suffix, label, onCommit }: NumberProps) {
  const [text, setText] = useState(() => show(value, range.integer));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(show(value, range.integer));
    setInvalid(false);
  }, [value, range.integer]);

  return (
    <span className="inline-num">
      {prefix ? <span>{prefix}</span> : null}
      <input
        aria-label={label}
        inputMode={range.integer ? "numeric" : "decimal"}
        className={invalid ? "invalid" : undefined}
        value={text}
        onWheel={(event) => event.currentTarget.blur()}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (stillTyping(next)) {
            setInvalid(false);
            return;
          }
          const parsed = parseDraft(next, range);
          if (parsed == null) {
            setInvalid(true);
            return;
          }
          setInvalid(false);
          if (parsed !== value) onCommit(parsed);
        }}
        onBlur={() => {
          const parsed = parseDraft(text, range);
          if (parsed == null) {
            setText(show(value, range.integer));
            setInvalid(false);
            return;
          }
          setText(show(parsed, range.integer));
        }}
      />
      {suffix ? <span>{suffix}</span> : null}
      {changed(value, fallback) ? <span className="dirty-dot" title="Diferente do padrão do SOP" /> : null}
      {invalid ? (
        <span className="hint">
          {range.integer ? "inteiro" : "número"} de {show(range.min, range.integer)} a {show(range.max, range.integer)}
        </span>
      ) : null}
    </span>
  );
}

export default function SettingsPanel({ thresholds, live, onChange }: Props) {
  function set<K extends NumericKey>(key: K, value: number) {
    onChange({ ...thresholds, [key]: value });
  }

  const proxy = live.cohortMode !== "full";

  return (
    <section className="settings-panel" aria-label="Critérios de decisão">
      <div className="settings-head">
        <h2>Critérios</h2>
        <button type="button" className="ghost" onClick={() => onChange({ ...DEFAULT_THRESHOLDS })}>
          Restaurar padrão do SOP
        </button>
      </div>
      {proxy ? (
        <p className="cohort-note">
          ROAS = receita de depósito ÷ gasto (Ad Tracking). RPR, baleia e legacy entram quando houver dados de cohort.
        </p>
      ) : null}
      <p className="preview" aria-live="polite">
        <span>Escalar {live.counts.escalar}</span>
        <span>Manter {live.counts.manter}</span>
        <span>Descartar {live.counts.descartar}</span>
      </p>

      <section className="stage">
        <h3>D1 · Corte rápido</h3>
        <p className="rule-line">
          Descartar se gastar{" "}
          <InlineNumber
            label="Gasto sem registro no D1"
            prefix="$"
            value={thresholds.dia0SpendNoReg}
            fallback={DEFAULT_THRESHOLDS.dia0SpendNoReg}
            range={RANGES.dia0SpendNoReg}
            onCommit={(value) => set("dia0SpendNoReg", value)}
          />{" "}
          sem nenhum registro
        </p>
        <p className="impact">{impact(ruleCount(live, "d1-registro"))}</p>
        <p className="rule-line">
          Descartar se gastar{" "}
          <InlineNumber
            label="Gasto sem depósito no D1"
            prefix="$"
            value={thresholds.dia0SpendNoDeposit}
            fallback={DEFAULT_THRESHOLDS.dia0SpendNoDeposit}
            range={RANGES.dia0SpendNoDeposit}
            onCommit={(value) => set("dia0SpendNoDeposit", value)}
          />{" "}
          sem nenhum depósito
        </p>
        <p className="impact">{impact(ruleCount(live, "d1-deposito"))}</p>
      </section>

      <section className="stage">
        <h3>D1 · Super Winner</h3>
        <p className="rule-line">
          Escalar no mesmo dia se ROAS ≥{" "}
          <InlineNumber
            label="ROAS mínimo do Super Winner"
            value={thresholds.superWinnerRoas}
            fallback={DEFAULT_THRESHOLDS.superWinnerRoas}
            range={RANGES.superWinnerRoas}
            onCommit={(value) => set("superWinnerRoas", value)}
          />
          , FTD ≥{" "}
          <InlineNumber
            label="FTD mínimo do Super Winner"
            suffix="FTD"
            value={thresholds.superWinnerFtd}
            fallback={DEFAULT_THRESHOLDS.superWinnerFtd}
            range={RANGES.superWinnerFtd}
            onCommit={(value) => set("superWinnerFtd", value)}
          />{" "}
          e CPA FTD ≤{" "}
          <InlineNumber
            label="CPA FTD máximo do Super Winner"
            prefix="$"
            value={thresholds.superWinnerCpa}
            fallback={DEFAULT_THRESHOLDS.superWinnerCpa}
            range={RANGES.superWinnerCpa}
            onCommit={(value) => set("superWinnerCpa", value)}
          />
        </p>
        <p className="impact">{impact(ruleCount(live, "d1-winner"))}</p>
      </section>

      <section className="stage">
        <h3>D2–D3 · Observação</h3>
        <p className="rule-line">Manter. Não descartar por um dia ruim.</p>
        <p className="impact">{impact(ruleCount(live, "d2-manter"))}</p>
      </section>

      <section className="stage">
        <h3>D4 · Checkpoint</h3>
        <p className="rule-line">
          Pode subir budget no ABO se ROAS ≥{" "}
          <InlineNumber
            label="ROAS mínimo do checkpoint"
            value={thresholds.checkpointCohort}
            fallback={DEFAULT_THRESHOLDS.checkpointCohort}
            range={RANGES.checkpointCohort}
            onCommit={(value) => set("checkpointCohort", value)}
          />{" "}
          e FTD ≥{" "}
          <InlineNumber
            label="FTD mínimo do checkpoint"
            suffix="FTD"
            value={thresholds.checkpointFtd}
            fallback={DEFAULT_THRESHOLDS.checkpointFtd}
            range={RANGES.checkpointFtd}
            onCommit={(value) => set("checkpointFtd", value)}
          />
        </p>
        <p className="impact">{impact(ruleCount(live, "d4-subir"))}</p>
        <p className="rule-line">
          Descartar antes da decisão se CPA FTD ≥{" "}
          <InlineNumber
            label="Múltiplo do CPA FTD médio"
            suffix="x"
            value={thresholds.cpaMultiple}
            fallback={DEFAULT_THRESHOLDS.cpaMultiple}
            range={RANGES.cpaMultiple}
            onCommit={(value) => set("cpaMultiple", value)}
          />{" "}
          a média e nenhum redepósito
        </p>
        <p className="reference">
          {live.avgCpa == null || live.cpaLimit == null
            ? "CPA FTD médio indisponível neste período"
            : `CPA FTD médio ${money(live.avgCpa)} → limite ${money(live.cpaLimit)}`}
        </p>
        <p className="impact">{impact(ruleCount(live, "d4-cpa"))}</p>
      </section>

      <section className="stage">
        <h3>D8+ · Decisão</h3>
        <p className="rule-line">
          Escalar se ROAS ≥ média geral ×{" "}
          <InlineNumber
            label="Múltiplo da média geral"
            value={thresholds.scaleBarMultiple}
            fallback={DEFAULT_THRESHOLDS.scaleBarMultiple}
            range={RANGES.scaleBarMultiple}
            onCommit={(value) => set("scaleBarMultiple", value)}
          />{" "}
          e FTD ≥{" "}
          <InlineNumber
            label="FTD mínimo para escalar"
            suffix="FTD"
            value={thresholds.scaleFtd}
            fallback={DEFAULT_THRESHOLDS.scaleFtd}
            range={RANGES.scaleFtd}
            onCommit={(value) => set("scaleFtd", value)}
          />
        </p>
        <p className="reference">
          {live.avgRoas == null || live.scaleBar == null
            ? "média geral indisponível neste período"
            : `média geral atual ${pt(live.avgRoas)} → barra ${pt(live.scaleBar)}`}
        </p>
        <p className="impact">{impact(ruleCount(live, "d8-escalar"))}</p>
        <p className="rule-line">
          Descartar se ROAS {"<"}{" "}
          <InlineNumber
            label="ROAS máximo para descartar"
            value={thresholds.discardCohort}
            fallback={DEFAULT_THRESHOLDS.discardCohort}
            range={RANGES.discardCohort}
            onCommit={(value) => set("discardCohort", value)}
          />
        </p>
        <p className="impact">{impact(ruleCount(live, "d8-descartar"))}</p>
        <p className="rule-line">Nos demais casos: Manter com budget baixo</p>
        <p className="impact">{impact(ruleCount(live, "d8-manter"))}</p>
      </section>

      <section className="stage">
        <h3>Rastreamento</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={thresholds.requireAdsetTag}
            onChange={(event) => onChange({ ...thresholds, requireAdsetTag: event.target.checked })}
          />
          Exigir conjunto [E]/[F]/[D] + data
          {thresholds.requireAdsetTag !== DEFAULT_THRESHOLDS.requireAdsetTag ? (
            <span className="dirty-dot" title="Diferente do padrão do SOP" />
          ) : null}
        </label>
        <p className="impact">
          {thresholds.requireAdsetTag
            ? impact(ruleCount(live, "sem-marcacao"))
            : "desligado: o conjunto não tira ninguém do veredito"}
        </p>
      </section>
    </section>
  );
}

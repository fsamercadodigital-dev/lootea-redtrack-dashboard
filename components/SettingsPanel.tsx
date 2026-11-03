"use client";

import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/config";

type Props = {
  thresholds: Thresholds;
  onChange: (value: Thresholds) => void;
};

type FieldProps = {
  label: string;
  value: number;
  step: string;
  onChange: (value: number) => void;
};

function OptionalField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="0.1"
        inputMode="decimal"
        value={value ?? ""}
        placeholder="não configurado"
        onWheel={(event) => event.currentTarget.blur()}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
        }}
      />
      <small>{value == null ? "não configurado" : "ativo"}</small>
    </label>
  );
}

function Field({ label, value, step, onChange }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        inputMode="decimal"
        value={value}
        onWheel={(event) => event.currentTarget.blur()}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
        }}
      />
    </label>
  );
}

export default function SettingsPanel({ thresholds, onChange }: Props) {
  function update(partial: Partial<Thresholds>) {
    onChange({ ...thresholds, ...partial });
  }

  return (
    <section className="settings-panel" aria-label="Critérios de decisão">
      <div className="settings-panel-body">
        <div className="settings-head">
          <h2>Critérios de decisão</h2>
          <button type="button" className="ghost" onClick={() => onChange({ ...DEFAULT_THRESHOLDS })}>
            Restaurar padrões
          </button>
        </div>
        <ol className="rules">
          <li>Dia 0: descartar com gasto alto sem cadastro ou sem depósito. Super Winner escala no mesmo dia.</li>
          <li>Dias 1 e 2: manter, sem mexer no budget.</li>
          <li>Até a véspera da decisão final: manter, e descartar só se o CPA passar de 2× a média sem redeposit.</li>
          <li>Da decisão final em diante: escalar em CBO se a coorte bater a barra, ou descartar se ficar abaixo de 0,8.</li>
        </ol>
        <div className="fields">
          <Field label="Dia 0: gasto sem cadastro (US$)" value={thresholds.dia0SpendNoReg} step="1" onChange={(value) => update({ dia0SpendNoReg: value })} />
          <Field label="Dia 0: gasto sem depósito (US$)" value={thresholds.dia0SpendNoDeposit} step="1" onChange={(value) => update({ dia0SpendNoDeposit: value })} />
          <Field label="Super Winner: ROAS mínimo" value={thresholds.superWinnerRoas} step="0.1" onChange={(value) => update({ superWinnerRoas: value })} />
          <Field label="Super Winner: FTDs mínimos" value={thresholds.superWinnerFtd} step="1" onChange={(value) => update({ superWinnerFtd: Math.floor(value) })} />
          <Field label="Super Winner: CPA máximo (US$)" value={thresholds.superWinnerCpa} step="0.1" onChange={(value) => update({ superWinnerCpa: value })} />
          <Field label="Não mexer até o dia" value={thresholds.earlyDayEnd} step="1" onChange={(value) => update({ earlyDayEnd: Math.max(1, Math.floor(value)) })} />
          <Field label="FTDs do checkpoint" value={thresholds.checkpointFtd} step="1" onChange={(value) => update({ checkpointFtd: Math.floor(value) })} />
          <Field label="RPR do checkpoint (%)" value={thresholds.checkpointRpr} step="1" onChange={(value) => update({ checkpointRpr: value })} />
          <Field label="ROAS cohort do checkpoint" value={thresholds.checkpointCohort} step="0.1" onChange={(value) => update({ checkpointCohort: value })} />
          <Field label="ROAS suspeito abaixo de" value={thresholds.suspectCohort} step="0.1" onChange={(value) => update({ suspectCohort: value })} />
          <Field label="Múltiplo do CPA médio para descarte" value={thresholds.cpaMultiple} step="0.1" onChange={(value) => update({ cpaMultiple: value })} />
          <Field label="Decisão final a partir do dia" value={thresholds.scaleDay} step="1" onChange={(value) => update({ scaleDay: Math.max(1, Math.floor(value)) })} />
          <Field label="Barra = média ×" value={thresholds.scaleBarMultiple} step="0.1" onChange={(value) => update({ scaleBarMultiple: value })} />
          <Field label="CBO: FTDs mínimos" value={thresholds.scaleFtd} step="1" onChange={(value) => update({ scaleFtd: Math.floor(value) })} />
          <Field label="CBO: RPR mínimo (%)" value={thresholds.scaleRpr} step="1" onChange={(value) => update({ scaleRpr: value })} />
          <Field label="CBO: top cliente máximo (%)" value={thresholds.scaleTopMax} step="1" onChange={(value) => update({ scaleTopMax: value })} />
          <Field label="Descartar se ROAS cohort abaixo de" value={thresholds.discardCohort} step="0.1" onChange={(value) => update({ discardCohort: value })} />
          <Field label="Alerta de baleia acima de (%)" value={thresholds.whaleShare} step="1" onChange={(value) => update({ whaleShare: value })} />
          <Field label="Alerta de amostra abaixo de (FTDs)" value={thresholds.smallSampleFtd} step="1" onChange={(value) => update({ smallSampleFtd: Math.floor(value) })} />
          <Field label="Alerta de legacy acima de (%)" value={thresholds.legacyAlert} step="1" onChange={(value) => update({ legacyAlert: value })} />
          <OptionalField label="Redep/FTD mínimo" value={thresholds.redepPerFtdMin} onChange={(value) => update({ redepPerFtdMin: value })} />
          <OptionalField label="Redep/FTD máximo" value={thresholds.redepPerFtdMax} onChange={(value) => update({ redepPerFtdMax: value })} />
        </div>
      </div>
    </section>
  );
}

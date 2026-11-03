"use client";

import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/config";

type Props = {
  thresholds: Thresholds;
  onChange: (value: Thresholds) => void;
};

type FieldProps = {
  label: string;
  value: number | null;
  step: string;
  optional?: boolean;
  hint?: string;
  onChange: (value: number | null) => void;
};

function Field({ label, value, step, optional = false, hint, onChange }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        inputMode="decimal"
        value={value ?? ""}
        placeholder={optional ? "não configurado" : undefined}
        onWheel={(event) => event.currentTarget.blur()}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            if (optional) onChange(null);
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
        }}
      />
      {optional ? <small>{value == null ? "não configurado" : "ativo"}</small> : null}
      {hint ? <small className="field-help">{hint}</small> : null}
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
            <li>Descartar se o CPA FTD passa do limite, se o gasto sem FTD passa de 2× esse limite, se há mais redeposits que FTDs, ou se o CPS passa do limite.</li>
            <li>Escalar se o CPA fica abaixo do limite, o ROAS do D1 ou o acumulado até o D4 atinge o mínimo, há mais FTDs que redeposits, e AOV e escala passam quando estão configurados.</li>
            <li>Manter até o dia limite quando ainda não dá para escalar nem descartar.</li>
            <li>Depois desse dia, descartar: não atingiu os critérios.</li>
          </ol>
          <div className="fields">
            <Field
              label="CPA FTD máximo (US$)"
              value={thresholds.cpaFtdMax}
              step="0.01"
              onChange={(value) => update({ cpaFtdMax: value ?? DEFAULT_THRESHOLDS.cpaFtdMax })}
            />
            <Field
              label="ROAS D1 mínimo"
              value={thresholds.roasD1Min}
              step="0.01"
              onChange={(value) => update({ roasD1Min: value ?? DEFAULT_THRESHOLDS.roasD1Min })}
            />
            <Field
              label="ROAS acumulado até D4 mínimo"
              value={thresholds.roasD3Min}
              step="0.01"
              onChange={(value) => update({ roasD3Min: value ?? DEFAULT_THRESHOLDS.roasD3Min })}
            />
            <Field
              label="AOV mínimo (US$)"
              value={thresholds.aovMin}
              step="0.01"
              optional
              onChange={(value) => update({ aovMin: value })}
            />
            <Field
              label="CPS máximo (US$)"
              value={thresholds.cpsMax}
              step="0.01"
              optional
              onChange={(value) => update({ cpsMax: value })}
            />
            <Field
              label="Gasto diário para checar escala (US$)"
              value={thresholds.scaleSpendThreshold}
              step="0.01"
              optional
              hint="ROAS só dos dias que chegaram nesse gasto."
              onChange={(value) => update({ scaleSpendThreshold: value })}
            />
            <Field
              label="ROAS mínimo nos dias de escala"
              value={thresholds.scaleRoasMin}
              step="0.01"
              onChange={(value) => update({ scaleRoasMin: value ?? DEFAULT_THRESHOLDS.scaleRoasMin })}
            />
            <Field
              label="Avaliar até o dia"
              value={thresholds.maxEvaluationDay}
              step="1"
              onChange={(value) =>
                update({
                  maxEvaluationDay: Math.max(1, Math.floor(value ?? DEFAULT_THRESHOLDS.maxEvaluationDay)),
                })
              }
            />
            <Field
              label="FTDs mínimos para volume"
              value={thresholds.minFtdsForSignal}
              step="1"
              hint="Abaixo disso, Manter diz volume baixo. Não impede Escalar."
              onChange={(value) =>
                update({
                  minFtdsForSignal: Math.max(0, Math.floor(value ?? DEFAULT_THRESHOLDS.minFtdsForSignal)),
                })
              }
            />
        </div>
      </div>
    </section>
  );
}

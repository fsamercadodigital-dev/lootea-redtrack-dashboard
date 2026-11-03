"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchReport, ClientReportError } from "@/lib/client-report";
import { BUYERS, DEFAULT_THRESHOLDS, type BuyerId, type Thresholds } from "@/lib/config";
import { addDays, formatClock, mexicoToday, PERIODS, type PeriodId } from "@/lib/dates";
import type { Verdict } from "@/lib/decision";
import { buildCreativeRows, summarize } from "@/lib/metrics";
import { readStoredThresholds, storeThresholds } from "@/lib/settings";
import type { ReportFailure, ReportPayload } from "@/lib/types";
import CreativesTable, { type SortDir, type SortKey } from "./CreativesTable";
import SettingsPanel from "./SettingsPanel";
import SummaryCards from "./SummaryCards";

type ActionFilter = "todas" | Verdict;

function toFailure(error: unknown): ReportFailure {
  if (error instanceof ClientReportError) {
    return { ok: false, stage: error.stage, status: error.status, message: error.message };
  }
  return {
    ok: false,
    stage: "consulta RedTrack",
    status: 0,
    message: "Não foi possível carregar o relatório.",
  };
}

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodId>("7");
  const [buyer, setBuyer] = useState<BuyerId>("all");
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReportFailure | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [action, setAction] = useState<ActionFilter>("todas");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(
    (nextBuyer: BuyerId, nextPeriod: PeriodId, refresh: boolean, custom?: { from: string; to: string }) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);

    fetchReport(nextBuyer, nextPeriod, refresh, controller.signal, custom)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setReport(payload);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(toFailure(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  },
  []);

  useEffect(() => {
    setThresholds(readStoredThresholds());
    setSettingsReady(true);
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    storeThresholds(thresholds);
  }, [settingsReady, thresholds]);

  useEffect(() => {
    const custom = period === "custom" ? { from: customFrom, to: customTo } : undefined;
    if (period === "custom" && (!customFrom || !customTo || customFrom > customTo)) return;
    load(buyer, period, false, custom);
    return () => requestRef.current?.abort();
  }, [buyer, period, customFrom, customTo, load]);

  const rows = useMemo(() => {
    if (!report) return [];
    const cohorts =
      report.cohortMode === "full" ? new Map(Object.entries(report.cohorts)) : null;
    return buildCreativeRows(
      report.creatives,
      { from: report.periodFrom, to: report.periodTo },
      report.today,
      thresholds,
      cohorts,
    );
  }, [report, thresholds]);

  const summary = useMemo(() => summarize(rows), [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (action !== "todas" && row.decision.verdict !== action) return false;
      if (!query) return true;
      return row.name.toLowerCase().includes(query) || row.adId.toLowerCase().includes(query);
    });
  }, [rows, action, search]);

  function choosePeriod(next: PeriodId) {
    if (next === "custom" && (!customFrom || !customTo)) {
      const today = mexicoToday();
      setCustomFrom(addDays(today, -6));
      setCustomTo(today);
    }
    setPeriod(next);
  }

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "name" || key === "action" ? "asc" : "desc");
  }

  return (
    <main className="page">
      <header className="bar">
        <div className="brand">
          <h1 className="logo">Lootea</h1>
          <span className="meta">Meta</span>
          <button
            type="button"
            className="info"
            aria-expanded={infoOpen}
            aria-label="Como ler o painel"
            onClick={() => setInfoOpen((open) => !open)}
          >
            i
          </button>
          {infoOpen ? (
            <p className="info-pop" role="note">
              Dia 0 é o primeiro dia com gasto, até hoje na Cidade do México. Os cartões somam os
              criativos do gestor e do período. Se Critérios exigir o conjunto
              [E], [F] ou [D] seguido de data, só esses entram na média.
              O custo por criativo é aproximado enquanto o RedTrack sincroniza o custo por conjunto.
            </p>
          ) : null}
        </div>
        <div className="controls">
          <div className="periods" role="group" aria-label="Período">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === period ? "segment selected" : "segment"}
                aria-pressed={item.id === period}
                onClick={() => choosePeriod(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {period === "custom" ? (
            <div className="custom-range">
              <input type="date" aria-label="De" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} />
              <input type="date" aria-label="Até" value={customTo} min={customFrom || undefined} max={mexicoToday()} onChange={(event) => setCustomTo(event.target.value)} />
            </div>
          ) : null}
          <label className="buyer">
            <span className="sr-only">Gestor</span>
            <select value={buyer} onChange={(event) => setBuyer(event.target.value as BuyerId)}>
              {BUYERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <p className="updated">{report ? `Atualizado ${formatClock(report.fetchedAt)}` : "Atualizado —"}</p>
          <button
            type="button"
            className="icon"
            aria-label="Atualizar"
            onClick={() =>
              load(buyer, period, true, period === "custom" ? { from: customFrom, to: customTo } : undefined)
            }
            disabled={loading}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M13.5 8a5.5 5.5 0 1 1-1.4-3.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path d="M13.6 2.8v2.6H11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      {error ? (
        <div className="banner error" role="alert">
          <strong>{error.message}</strong>
          <span>
            Etapa: {error.stage}
            {" · "}
            {error.status ? `HTTP ${error.status}` : "sem resposta HTTP"}
          </span>
        </div>
      ) : null}

      {loading && !report ? (
        <div className="banner" role="status">
          <strong>Carregando relatório</strong>
          <span>Etapa: consulta RedTrack</span>
        </div>
      ) : null}

      {report ? <SummaryCards summary={summary} /> : null}

      <div className="filter-card">
        <label className="search">
          <span className="sr-only">Buscar criativo</span>
          <input
            type="search"
            value={search}
            placeholder="Buscar"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="tabs" role="group" aria-label="Filtrar por ação">
          {(
            [
              ["todas", "Todas", rows.length],
              ["escalar", "Escalar", summary.escalar],
              ["manter", "Manter", summary.manter],
              ["descartar", "Descartar", summary.descartar],
              ["sem-veredito", "Sem veredito", summary.semVeredito],
            ] as const
          ).map(([item, label, count]) => (
            <button
              key={item}
              type="button"
              className={action === item ? "tab selected" : "tab"}
              aria-pressed={action === item}
              onClick={() => setAction(item)}
            >
              {label} {count}
            </button>
          ))}
        </div>
        <button type="button" className="text-button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}>
          Critérios
        </button>
        {report?.cohortMode === "proxy" ? (
          <p className="quiet">coorte indisponível – usando o rastreamento do anúncio</p>
        ) : null}
      </div>

      {settingsOpen ? (
        <div className="drawer-root">
          <button type="button" className="backdrop" aria-label="Fechar critérios" onClick={() => setSettingsOpen(false)} />
          <aside className="drawer" role="dialog" aria-label="Critérios">
            <button type="button" className="text-button close" onClick={() => setSettingsOpen(false)}>
              Fechar
            </button>
            <SettingsPanel thresholds={thresholds} onChange={setThresholds} />
          </aside>
        </div>
      ) : null}

      {report && visibleRows.length === 0 ? (
        <div className="banner">
          <strong>
            {rows.length === 0
              ? "Nenhum criativo com dados neste período."
              : "Nenhum criativo corresponde à busca ou ao filtro."}
          </strong>
        </div>
      ) : null}

      {report && visibleRows.length > 0 ? (
        <CreativesTable rows={visibleRows} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      ) : null}

    </main>
  );
}

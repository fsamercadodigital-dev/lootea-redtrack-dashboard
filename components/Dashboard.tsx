"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchReport, ClientReportError } from "@/lib/client-report";
import { BUYERS, DEFAULT_THRESHOLDS, type BuyerId, type Thresholds } from "@/lib/config";
import { addDays, formatShortDate, mexicoToday, PERIODS, formatStamp, type PeriodId } from "@/lib/dates";
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

  const summary = useMemo(() => summarize(rows, thresholds), [rows, thresholds]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (action !== "todas" && row.decision.verdict !== action) return false;
      if (!query) return true;
      return row.name.toLowerCase().includes(query) || row.adId.toLowerCase().includes(query);
    });
  }, [rows, action, search]);

  const buyerLabel = BUYERS.find((item) => item.id === buyer)?.label ?? "Todas as contas";

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
      <header className="top">
        <div className="brand">
          <h1 className="sr-only">Lootea Meta</h1>
          <p className="logo" aria-hidden="true">Lootea</p>
          <span className="meta-label">
            <svg viewBox="0 0 20 12" aria-hidden="true" className="meta-mark">
              <path
                fill="#0668E1"
                d="M5.2 6c0-1.5.7-2.6 1.9-2.6.7 0 1.2.3 1.6.9.4-.6.9-.9 1.6-.9 1.2 0 1.9 1.1 1.9 2.6S11.5 8.6 10.3 8.6c-.7 0-1.2-.3-1.6-.9-.4.6-.9.9-1.6.9C5.9 8.6 5.2 7.5 5.2 6zm-4 0c0-1.5.7-2.6 1.9-2.6.7 0 1.2.3 1.6.9.4-.6.9-.9 1.6-.9.3 0 .6.1.8.2-.5.6-.8 1.5-.8 2.4s.3 1.8.8 2.4c-.2.1-.5.2-.8.2-.7 0-1.2-.3-1.6-.9-.4.6-.9.9-1.6.9C1.9 8.6 1.2 7.5 1.2 6z"
              />
            </svg>
            Meta
          </span>
        </div>
        <button
          type="button"
          className="primary"
          onClick={() =>
            load(buyer, period, true, period === "custom" ? { from: customFrom, to: customTo } : undefined)
          }
          disabled={loading}
        >
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      <div className="toolbar">
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
            <label>
              De
              <input type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} />
            </label>
            <label>
              Até
              <input type="date" value={customTo} min={customFrom || undefined} max={mexicoToday()} onChange={(event) => setCustomTo(event.target.value)} />
            </label>
          </div>
        ) : null}
        <label className="buyer">
          <span className="sr-only">Conta</span>
          <select value={buyer} onChange={(event) => setBuyer(event.target.value as BuyerId)}>
            {BUYERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <p className="updated">
          {report
            ? `Atualizado em ${formatStamp(report.fetchedAt)} (Cidade do México)`
            : "Ainda sem atualização"}
        </p>
      </div>

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

      {report ? (
        <>
          <p className="scope">
            {buyerLabel}
            {" · "}
            {formatShortDate(report.periodFrom)}
            {report.periodFrom !== report.periodTo ? ` a ${formatShortDate(report.periodTo)}` : ""}
            {" · "}
            {rows.length} {rows.length === 1 ? "criativo" : "criativos"}
          </p>
          <SummaryCards summary={summary} action={action} onAction={setAction} />
        </>
      ) : null}

      <div className="filters">
        <label className="search">
          <span className="sr-only">Buscar criativo</span>
          <input
            type="search"
            value={search}
            placeholder="Buscar por nome ou ID"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="chips" role="group" aria-label="Filtrar por ação">
          {(
            [
              ["todas", "Todas"],
              ["escalar", "Escalar"],
              ["manter", "Manter"],
              ["descartar", "Descartar"],
              ["sem-veredito", "Sem veredito"],
            ] as const
          ).map(([item, label]) => (
            <button
              key={item}
              type="button"
              className={action === item ? "chip selected" : "chip"}
              aria-pressed={action === item}
              onClick={() => setAction(item)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ghost"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          Critérios
        </button>
      </div>

      {settingsOpen ? <SettingsPanel thresholds={thresholds} onChange={setThresholds} /> : null}

      {report?.cohortMode === "proxy" ? (
        <div className="banner error" role="status">
          <strong>cohort indisponível – usando Ad Tracking</strong>
        </div>
      ) : null}

      {report ? (
        <p className="note">
          Dia 0 é o primeiro dia com gasto, contado até hoje na Cidade do México. Gasto, registros e FTDs são
          do período. Os cartões de média usam só anúncios com conjunto [E], [F] ou [D] mais data. Os demais
          ficam sem veredito.
        </p>
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

      <footer>
        Custo por anúncio é aproximado enquanto o RedTrack sincroniza custo por conjunto.
      </footer>
    </main>
  );
}

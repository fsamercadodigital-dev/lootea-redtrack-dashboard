"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchReport, ClientReportError } from "@/lib/client-report";
import { BUYERS, DEFAULT_THRESHOLDS, type BuyerId, type Thresholds } from "@/lib/config";
import { formatShortDate, PERIODS, periodRange, formatStamp, type PeriodId } from "@/lib/dates";
import type { Verdict } from "@/lib/decision";
import { rowsForPeriod, summarize } from "@/lib/metrics";
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
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback((nextBuyer: BuyerId, refresh: boolean) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);

    fetchReport(nextBuyer, refresh, controller.signal)
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
  }, []);

  useEffect(() => {
    setThresholds(readStoredThresholds());
    setSettingsReady(true);
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    storeThresholds(thresholds);
  }, [settingsReady, thresholds]);

  useEffect(() => {
    load(buyer, false);
    return () => requestRef.current?.abort();
  }, [buyer, load]);

  const rows = useMemo(() => {
    if (!report) return [];
    return rowsForPeriod(report.creatives, report.today, period, thresholds);
  }, [report, period, thresholds]);

  const summary = useMemo(() => summarize(rows), [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (action !== "todas" && row.decision.verdict !== action) return false;
      if (!query) return true;
      return row.name.toLowerCase().includes(query) || row.adId.toLowerCase().includes(query);
    });
  }, [rows, action, search]);

  const range = report ? periodRange(report.today, period) : null;
  const buyerLabel = BUYERS.find((item) => item.id === buyer)?.label ?? "Todos Meta";

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
          <span className="mark" aria-hidden="true">
            L
          </span>
          <div>
            <h1>Lootea · Criativos Meta</h1>
            <p className="subtitle">Decisão por primeiro depósito</p>
          </div>
        </div>
        <button type="button" className="primary" onClick={() => load(buyer, true)} disabled={loading}>
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
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="buyer">
          <span>Comprador</span>
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

      {report && range ? (
        <>
          <p className="scope">
            {buyerLabel}
            {" · "}
            {formatShortDate(range.from)}
            {range.from !== range.to ? ` a ${formatShortDate(range.to)}` : ""}
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
          {(["todas", "escalar", "manter", "descartar"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={action === item ? "chip selected" : "chip"}
              aria-pressed={action === item}
              onClick={() => setAction(item)}
            >
              {item === "todas" ? "Todas" : item === "escalar" ? "Escalar" : item === "manter" ? "Manter" : "Descartar"}
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

      {report ? (
        <p className="note">
          Gasto, FTDs, CPA, ROAS, redeposits, AOV, CPS, cadastros e cliques usam o período escolhido. O dia
          conta até hoje na Cidade do México, a partir do primeiro dia com cliques ou custo nos últimos 30
          dias. ROAS até D4 é o acumulado do D1 ao D4.
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

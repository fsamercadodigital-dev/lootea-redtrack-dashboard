import type { BuyerId } from "./config";
import type { PeriodId } from "./dates";
import type { ReportFailure, ReportPayload } from "./types";

export class ClientReportError extends Error {
  stage: string;
  status: number;

  constructor(stage: string, status: number, message: string) {
    super(message);
    this.name = "ClientReportError";
    this.stage = stage;
    this.status = status;
  }
}

function isPayload(value: unknown): value is ReportPayload {
  return (
    !!value &&
    typeof value === "object" &&
    (value as ReportPayload).ok === true &&
    Array.isArray((value as ReportPayload).creatives)
  );
}

function isFailure(value: unknown): value is ReportFailure {
  if (!value || typeof value !== "object") return false;
  const body = value as ReportFailure;
  return typeof body.stage === "string" && typeof body.message === "string";
}

export async function fetchReport(
  buyer: BuyerId,
  period: PeriodId,
  refresh: boolean,
  signal: AbortSignal,
  custom?: { from: string; to: string },
): Promise<ReportPayload> {
  const params = new URLSearchParams({ buyer, period });
  if (period === "custom" && custom) {
    params.set("from", custom.from);
    params.set("to", custom.to);
  }
  if (refresh) params.set("refresh", "1");

  let response: Response;
  try {
    response = await fetch(`/api/report?${params.toString()}`, { signal, cache: "no-store" });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ClientReportError("consulta RedTrack", 0, "Não foi possível conectar ao painel.");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || !isPayload(body)) {
    if (isFailure(body)) {
      throw new ClientReportError(
        body.stage,
        typeof body.status === "number" ? body.status : response.status,
        body.message,
      );
    }
    throw new ClientReportError(
      "consulta RedTrack",
      response.status,
      "Não foi possível carregar o relatório.",
    );
  }

  return body;
}

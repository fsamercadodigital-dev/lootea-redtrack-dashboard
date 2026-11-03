import { NextRequest, NextResponse } from "next/server";
import { isBuyerId } from "@/lib/config";
import { isPeriodId } from "@/lib/dates";
import { getReport, ReportError } from "@/lib/redtrack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const buyerParam = request.nextUrl.searchParams.get("buyer") ?? "all";
  if (!isBuyerId(buyerParam)) {
    return NextResponse.json(
      { ok: false, stage: "parâmetros", status: 400, message: "Gestor desconhecido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const periodParam = request.nextUrl.searchParams.get("period") ?? "7";
  if (!isPeriodId(periodParam)) {
    return NextResponse.json(
      { ok: false, stage: "parâmetros", status: 400, message: "Período desconhecido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const custom =
    periodParam === "custom"
      ? {
          from: request.nextUrl.searchParams.get("from") ?? "",
          to: request.nextUrl.searchParams.get("to") ?? "",
        }
      : undefined;

  try {
    const report = await getReport(buyerParam, periodParam, refresh, custom);
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ReportError) {
      return NextResponse.json(
        { ok: false, stage: error.stage, status: error.status, message: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: false, stage: "processamento", status: 500, message: "Falha ao montar o relatório." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

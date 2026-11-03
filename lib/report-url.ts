import { PAGE_SIZE, REDTRACK_SOURCE_ID } from "./config";

const FIELDS = [
  "rt_ad_id",
  "rt_ad",
  "rt_adgroup",
  "date",
  "clicks",
  "impressions",
  "cost",
  "convtype2",
  "revenuetype2",
  "convtype3",
  "convtype4",
  "revenuetype4",
  "convtype7",
  "revenuetype7",
  "convtype8",
  "revenuetype8",
];

/** Monta a URL do relatório. A chave entra só aqui, no servidor. */
export function buildReportUrl(options: {
  apiKey: string;
  from: string;
  to: string;
  page: number;
  campaignId: string | null;
}): URL {
  const url = new URL("https://api.redtrack.io/report/v2");
  url.searchParams.set("api_key", options.apiKey);
  const splitByBuyer = !options.campaignId;
  url.searchParams.set(
    "group",
    splitByBuyer ? "campaign_id,rt_ad_id,rt_ad,rt_adgroup,date" : "rt_ad_id,rt_ad,rt_adgroup,date",
  );
  url.searchParams.set("date_from", options.from);
  url.searchParams.set("date_to", options.to);
  url.searchParams.set("timezone", "America/Mexico_City");
  url.searchParams.set("source_id", REDTRACK_SOURCE_ID);
  if (options.campaignId) {
    url.searchParams.set("campaign_id", options.campaignId);
  }
  url.searchParams.set("fields", (splitByBuyer ? [...FIELDS, "campaign_id"] : FIELDS).join(","));
  url.searchParams.set("per", String(PAGE_SIZE));
  url.searchParams.set("page", String(options.page));
  return url;
}

export const REPORT_FIELDS = FIELDS;

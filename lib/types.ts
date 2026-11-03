export type DailyPoint = {
  date: string;
  clicks: number;
  impressions: number;
  cost: number;
  deposits: number;
  depositRevenue: number;
  signups: number;
  ftds: number;
  ftdRevenue: number;
  redeposits: number;
};

export type CreativeSeries = {
  adId: string;
  name: string;
  rawNames: string[];
  adset: string;
  days: DailyPoint[];
};

export type CohortMode = "full" | "proxy";

export type ReportPayload = {
  ok: true;
  fetchedAt: string;
  today: string;
  from: string;
  to: string;
  periodFrom: string;
  periodTo: string;
  buyer: string;
  cohortMode: CohortMode;
  creatives: CreativeSeries[];
  cohorts: Record<string, { revenue: number; rpr: number | null; topCustomerShare: number | null; legacyShare: number | null }>;
};

export type ReportFailure = {
  ok: false;
  stage: string;
  status: number;
  message: string;
};

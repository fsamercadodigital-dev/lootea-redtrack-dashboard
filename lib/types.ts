export type DailyPoint = {
  date: string;
  clicks: number;
  cost: number;
  deposits: number;
  depositRevenue: number;
  signups: number;
  ftds: number;
  redeposits: number;
};

export type CreativeSeries = {
  adId: string;
  name: string;
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
  conversionTypes: string[];
  conversionRows: number;
  conversionFtdFlags: number;
  conversionMatch: {
    ftdEvents: number;
    ftdWithUser: number;
    ftdWithAd: number;
    ftdExternal: number;
    ftdClick: number;
    depositWithUser: number;
    depositWithAd: number;
  };
  creatives: CreativeSeries[];
  cohorts: Record<string, { revenue: number; rpr: number | null; topCustomerShare: number | null; legacyShare: number | null }>;
};

export type ReportFailure = {
  ok: false;
  stage: string;
  status: number;
  message: string;
};

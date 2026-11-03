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
  days: DailyPoint[];
};

export type ReportPayload = {
  ok: true;
  fetchedAt: string;
  today: string;
  from: string;
  to: string;
  buyer: string;
  creatives: CreativeSeries[];
};

export type ReportFailure = {
  ok: false;
  stage: string;
  status: number;
  message: string;
};

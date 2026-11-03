import type { BuyerId } from "./config";

/** Campanhas do Meta. Só o servidor usa isto na hora de montar a URL. */
const CAMPAIGN_IDS: Partial<Record<BuyerId, string>> = {
  felipe: "6adae4745021de703da2318f",
  erick: "6ad59d58aecec9f79f73bcbf",
  daniel: "6adae4ed876e7a21d12c861b",
};

export type GestorId = "felipe" | "erick" | "daniel" | "other";

export const GESTOR_ORDER: GestorId[] = ["felipe", "erick", "daniel", "other"];

export const GESTOR_LABEL: Record<GestorId, string> = {
  felipe: "Felipe",
  erick: "Erick",
  daniel: "Daniel",
  other: "Sem gestor",
};

export function campaignIdFor(buyer: BuyerId): string | null {
  return CAMPAIGN_IDS[buyer] ?? null;
}

export function buyerForCampaign(campaignId: string): GestorId {
  if (campaignId && campaignId === CAMPAIGN_IDS.felipe) return "felipe";
  if (campaignId && campaignId === CAMPAIGN_IDS.erick) return "erick";
  if (campaignId && campaignId === CAMPAIGN_IDS.daniel) return "daniel";
  return "other";
}

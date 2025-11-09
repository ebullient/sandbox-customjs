import type { CampaignReferenceAPI } from "./api";

declare global {
    interface Window {
        campaignNotes?: {
            api?: CampaignReferenceAPI;
        };
    }
}

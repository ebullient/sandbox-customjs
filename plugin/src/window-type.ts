// globals.d.ts
import type { CampaignReferenceAPI } from "./@types/api";

declare global {
    interface Window {
        campaignNotes?: {
            api?: CampaignReferenceAPI;
        };
    }
}

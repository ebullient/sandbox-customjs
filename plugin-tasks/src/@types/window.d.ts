import type { TaskIndexAPI } from "../taskindex-Api";

declare global {
    interface Window {
        taskIndex?: {
            api?: TaskIndexAPI;
        };
    }
}

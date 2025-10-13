// globals.d.ts
import type { TaskIndexAPI } from "TaskIndex-Api";

declare global {
    interface Window {
        taskIndex?: {
            api?: TaskIndexAPI;
        };
    }
}

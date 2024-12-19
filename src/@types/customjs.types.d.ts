import type * as obsidian from "obsidian";
import type { AreaPriority } from "src/priority";
import type { Campaign } from "src/campaign";
import type { Timeline } from "src/cmd-timeline";
import type { Utils } from "src/_utils";
import type { Reference } from "src/reference";

// Note: Partial CustomJS API

export type CustomJSType = {
    obsidian?: typeof obsidian;
    app?: obsidian.App;
    state?: Record<string, unknown>;
    [scriptName: string]: unknown;
    AreaPriority: AreaPriority;
    Campaign: Campaign;
    Reference: Reference;
    Timeline: Timeline;
    Utils: Utils;
};

declare global {
    interface Window {
        forceLoadCustomJS?: () => Promise<void>;
        cJS?: (
            moduleOrCallback?: string | ((customJS: CustomJSType) => void),
        ) => Promise<CustomJSType>;
        customJS?: CustomJSType;
    }
}

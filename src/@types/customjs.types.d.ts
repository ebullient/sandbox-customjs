import type * as obsidian from "obsidian";
import type { Utils } from "../_utils";
import type { AreaRelated } from "../areaRelated";
import type { Campaign } from "../campaign";
import type { Timeline } from "../cmd-timeline";
import type { Reference } from "../reference";

// Note: Partial CustomJS API

export type CustomJSType = {
    obsidian?: typeof obsidian;
    app?: obsidian.App;
    state?: Record<string, unknown>;
    [scriptName: string]: unknown;
    AreaRelated: AreaRelated;
    Campaign: Campaign;
    Reference: Reference;
    Timeline: Timeline;
    Utils: Utils;
};

import * as obsidian from 'obsidian';
import { AreaPriority } from 'src/priority';
import { Campaign } from 'src/campaign';
import { Timeline } from 'src/cmd-timeline';
import { Utils } from 'src/_utils';

// Note: Partial CustomJS API

export type CustomJSType = {
  obsidian?: typeof obsidian;
  app?: obsidian.App;
  state?: Record<string, unknown>;
  [scriptName: string]: unknown;
  AreaPriority: AreaPriority;
  Campaign: Campaign;
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

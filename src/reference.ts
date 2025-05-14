import type { App, TFile } from "obsidian";
import type {
    CampaignEntity,
    Encounter,
    EntityType,
    Group,
    NPC,
    Place,
} from "../plugin/src/@types";
import type { CampaignReferenceAPI } from "../plugin/src/@types/api";
import type { EngineAPI, MarkdownBuilder } from "./@types/jsengine.types";
import type { Conditions, Utils } from "./_utils";

declare global {
    interface Window {
        campaignNotes?: {
            api?: CampaignReferenceAPI;
        };
    }
}

type Tags = string | string[];

export class Reference {
    app: App;
    statusOrder = ["alive", "undead", "ghost", "dead", "unknown"];

    constructor() {
        // Constructor
        console.log("loading Reference");
        this.app = window.customJS.app;
        console.log("Campaign Notes API connected");
    }

    utils = (): Utils => window.customJS.Utils;

    currentScope = () => {
        const current = this.app.workspace.getActiveFile();
        return current.path.split("/")[0];
    };


    itemsForTagRaw = (
        tag: Tags,
        maybeType: string,
        scoped = false,
    ): string[] => {
        const campaignApi = window.campaignNotes?.api;
        const tagRegexes = this.tagToRegexes(tag);
        const scope = this.currentScope();
        const type = maybeType.replace("location", "place");
        const currentFile = this.app.workspace.getActiveFile();

        const entities = campaignApi
            .getEntitiesByType(type as EntityType, scoped ? scope : undefined)
            .filter((entity) => entity.file.path !== currentFile.path)
            .filter((entity) =>
                entity.tags.find((t) =>
                    tagRegexes.some((regex) => regex.test(t)),
                ),
            );

        const items: string[] = [];
        for (const entity of entities) {
            items.push(this.entityToLink(entity, scoped));
        }
        return items.sort((a, b) => this.sortMarkdownLinks(a, b));
    };

    itemsForTag = (
        engine: EngineAPI,
        tag: Tags,
        type: string,
        scoped = false,
    ) => {
        const markdownBuilder = engine.markdown.createBuilder();
        const items = this.itemsForTagRaw(tag, type, scoped);

        if (items.length > 0) {
            markdownBuilder.addText(items.join("\n"));
        } else {
            markdownBuilder.createParagraph("None");
        }
        return markdownBuilder;
    };

    linkedItems = (
        engine: EngineAPI,
        includeLogs = true,
        conditions?: Conditions,
    ) => {
        const campaignApi = window.campaignNotes?.api;
        const current = this.app.workspace.getActiveFile();

        const includeLogsFilter = (tfile: TFile) => {
            // either do nothing (allow logs) or filter out logs
            return includeLogs
                ? true // do nothing
                : !this.utils().filterByPath(tfile, /sessions/);
        };

        // Backlinks to current file
        const files = campaignApi
            .getBacklinks(current.path)
            .filter((f) => includeLogsFilter(f));

        // References to items in current file (idTag)
        const entityFiles = campaignApi
            .getEntitiesInFile(current.path)
            .filter((entity) => entity.idTag)
            .map((entity) => entity.idTag)
            .flatMap((idTag) => campaignApi.getEntitiesByTag(idTag))
            .map((x) => x.file)
            .filter((f) => includeLogsFilter(f) && f.path !== current.path);
        files.push(...entityFiles);

        // Other files matching conditions (if any)
        if (conditions) {
            const conditionsFilter =
                this.utils().createFileConditionFilter(conditions);
            const extraFiles = this.utils().filesMatchingCondition(
                (f) => conditionsFilter(f) && includeLogsFilter(f),
            );
            files.push(...extraFiles);
        }

        return this.sortedItemList(
            engine,
            Array.from(new Map(files.map((f) => [f.path, f])).values()),
        );
    };

    // List of backlinks from session logs
    logBacklink = (engine: EngineAPI) => {
        const campaignApi = window.campaignNotes?.api;
        const current = this.app.workspace.getActiveFile();
        const files = campaignApi
            .getBacklinks(current.path)
            .filter((f) => this.utils().filterByPath(f, /sessions/))
            .sort((a, b) => this.utils().sortTFile(a, b));

        return files == null || files.length === 0
            ? engine.markdown.create("None")
            : engine.markdown.create(
                  files.map((f) => this.utils().fileListItem(f)).join("\n"),
              );
    };

    logs = (engine: EngineAPI, conditions?: Conditions) => {
        const current = this.app.workspace.getActiveFile();
        const campaignApi = window.campaignNotes?.api;

        const files = campaignApi
            .getBacklinks(current.path)
            .filter((f) => this.utils().filterByPath(f, /sessions/));

        if (conditions) {
            const conditionsFilter =
                this.utils().createFileConditionFilter(conditions);

            const extraFiles = this.utils().filesMatchingCondition(
                (tfile: TFile) =>
                    this.utils().filterByPath(tfile, /sessions/) &&
                    conditionsFilter(tfile),
            );
            files.push(...extraFiles);
        }

        const fileMap = new Map<string, TFile>();
        for (const f of files) {
            fileMap.set(f.path, f);
        }

        return fileMap.size === 0
            ? engine.markdown.create("None")
            : engine.markdown.create(
                  Array.from(fileMap.values())
                      .sort((a, b) => this.utils().sortTFile(a, b))
                      .map((f) => this.utils().scopedFileListItem(f))
                      .join("\n"),
              );
    };

    relatedNotItems = (engine: EngineAPI, tags: Tags = []): string => {
        const campaignApi = window.campaignNotes?.api;
        const current = this.app.workspace.getActiveFile();
        const tagRegexes = tags ? this.tagToRegexes(tags) : [];
        const files = campaignApi
            .getBacklinks(current.path)
            .filter((f) => f.path !== current.path)
            .filter((f) => campaignApi.getEntitiesInFile(f.path).length === 0)
            .filter((f) => this.utils().filterByTags(f, tagRegexes));

        return files == null || files.length === 0
            ? engine.markdown.create("None")
            : engine.markdown.create(
                  files
                      .map((f) => this.utils().scopedFileListItem(f))
                      .join("\n"),
              );
    };

    relatedWithinScope = (
        engine: EngineAPI,
        scope: string,
        conditions: Conditions = [],
    ): string => {
        const pathRegex = this.utils().segmentFilterRegex(scope);
        const conditionsFilter =
            this.utils().createFileConditionFilter(conditions);

        const files = this.utils().filesMatchingCondition((tfile: TFile) => {
            return (
                this.utils().filterByPath(tfile, pathRegex) &&
                conditionsFilter(tfile)
            );
        });
        return this.sortedItemList(engine, files, true);
    };

    sortedItemList = (
        engine: EngineAPI,
        files: TFile[],
        scoped = false,
    ): string => {
        const campaignApi = window.campaignNotes?.api;

        const items = [];
        for (const f of files) {
            const entities = campaignApi.getEntitiesInFile(f.path);
            if (entities.length > 0) {
                for (const entity of entities) {
                    items.push(this.entityToLink(entity, scoped));
                }
            } else {
                items.push(
                    scoped
                        ? this.utils().scopedFileListItem(f)
                        : this.utils().fileListItem(f),
                );
            }
        }

        return items == null || items.length === 0
            ? engine.markdown.create("None")
            : engine.markdown.create(
                  items.sort((a, b) => this.sortMarkdownLinks(a, b)).join("\n"),
              );
    };

    scopeRegex = (root: string): RegExp => {
        return this.utils().segmentFilterRegex(root);
    };

    sortMarkdownLinks = (a: string, b: string): number => {
        const n1 = a.replace(/\[(.*)\].*/, "$1").toLowerCase();
        const n2 = b.replace(/\[(.*)\].*/, "$1").toLowerCase();
        return n1.localeCompare(n2);
    };

    sortStatus = (a: NPC, b: NPC): number => {
        const n1 = a.state[a.scope || "*"]?.status || "unknown";
        const idx1 = this.statusOrder.indexOf(n1);
        const n2 = b.state[b.scope || "*"]?.status || "unknown";
        const idx2 = this.statusOrder.indexOf(n2);
        if (idx1 === idx2) {
            return a.name.localeCompare(b.name);
        }
        return idx1 - idx2;
    };

    entityToLink = (entity: CampaignEntity, scoped = false): string => {
        const campaignApi = window.campaignNotes?.api;
        const icons = campaignApi.getIcons(entity);
        const iconText = icons ? `<span class="icon">${icons}</span> ` : "";
        if (scoped) {
            return `- <small>(${entity.scope})</small> ${iconText}[${entity.name}](${entity.id})`;
        }
        return `- ${iconText}[${entity.name}](${entity.id})`;
    };

    tagToRegexes = (startTag: Tags): RegExp[] => {
        let tag = startTag;
        if (typeof tag === "string") {
            tag = [tag];
        }
        return tag.map(this.utils().tagFilterRegex);
    };

    todos = (engine: EngineAPI, scope: string): string => {
        const pathRegex = this.utils().segmentFilterRegex(scope);
        const files = this.utils().filesMatchingCondition((tfile: TFile) => {
            return (
                this.utils().filterByPath(tfile, pathRegex) &&
                this.utils().filterByTag(tfile, "#todo")
            );
        });
        return engine.markdown.create(
            files.map((f) => this.utils().fileListItem(f)).join("\n"),
        );
    };
}

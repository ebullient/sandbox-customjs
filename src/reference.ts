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
import type { EngineAPI } from "./@types/jsengine.types";
import type { Conditions, Tags, Utils } from "./_utils";

declare global {
    interface Window {
        campaignNotes?: {
            api?: CampaignReferenceAPI;
        };
    }
}

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
    campaignApi = (): CampaignReferenceAPI => window.campaignNotes.api;

    currentScope = () => {
        const current = this.app.workspace.getActiveFile();
        return current.path.split("/")[0];
    };

    itemsForTagRaw = (
        tag: Tags,
        maybeType: string,
        scoped = false,
    ): string[] => {
        const tagRegexes = this.tagToRegexes(tag);
        const scope = this.currentScope();
        const type = maybeType.replace("location", "place");
        const currentFile = this.app.workspace.getActiveFile();

        const entities = this.campaignApi()
            .getEntitiesByType(type as EntityType, scoped ? scope : undefined)
            .filter((entity) => entity.filePath !== currentFile.path)
            .filter((entity) =>
                entity.tags.find((t) =>
                    tagRegexes.some((regex) => regex.test(t)),
                ),
            );

        const items: string[] = [];
        for (const entity of entities) {
            items.push(this.entityToListLink(entity, scoped));
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
        const current = this.app.workspace.getActiveFile();

        const includeLogsFilter = (filePath: string) => {
            // either do nothing (allow logs) or filter out logs
            return includeLogs
                ? true // do nothing
                : !filePath.match(/sessions/);
        };

        // Backlinks to current file
        const files = this.campaignApi()
            .getBacklinks(current.path)
            .filter(
                (f) =>
                    this.campaignApi().includeFile(f) &&
                    includeLogsFilter(f.path),
            );

        // References to items in current file (idTag)
        const entityFiles = this.campaignApi()
            .getEntitiesInFile(current.path)
            .filter((entity) => entity.idTag)
            .map((entity) => entity.idTag)
            .flatMap((idTag) => this.campaignApi().getEntitiesByTag(idTag))
            .filter(
                (e) =>
                    includeLogsFilter(e.filePath) &&
                    e.filePath !== current.path,
            )
            .map(
                (entity) =>
                    this.app.vault.getAbstractFileByPath(
                        entity.filePath,
                    ) as TFile,
            )
            .filter((f) => f as TFile);

        files.push(...entityFiles);

        // Other files matching conditions (if any)
        if (conditions) {
            const conditionsFilter =
                this.utils().createFileConditionFilter(conditions);
            const extraFiles = this.utils().filesMatchingCondition(
                (f) => conditionsFilter(f) && includeLogsFilter(f.path),
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
        const current = this.app.workspace.getActiveFile();
        const files = this.campaignApi()
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

        const files = this.campaignApi()
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
        const current = this.app.workspace.getActiveFile();
        const tagRegexes = tags ? this.tagToRegexes(tags) : [];
        const files = this.campaignApi()
            .getBacklinks(current.path)
            .filter(
                (f) =>
                    this.campaignApi().getEntitiesInFile(f.path).length === 0,
            )
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
        const items = [];
        for (const f of files) {
            const entities = this.campaignApi().getEntitiesInFile(f.path);
            if (entities.length > 0) {
                for (const entity of entities) {
                    items.push(this.entityToListLink(entity, scoped));
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

    sortMarkdownLinks = (a: string, b: string): number => {
        const n1 = a.replace(/\[(.*)\].*/, "$1").toLowerCase();
        const n2 = b.replace(/\[(.*)\].*/, "$1").toLowerCase();
        return n1.localeCompare(n2);
    };

    entityToListLink = (entity: CampaignEntity, scoped = false): string => {
        const icons = this.campaignApi().getIcons(entity);
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

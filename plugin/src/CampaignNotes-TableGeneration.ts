import type { CampaignNotesCache } from "CampaignNotes-Cache";
import type { CampaignNotesIndex } from "CampaignNotes-Index";
import {
    addToMappedArray,
    entityToLink,
    iffStatusIcon,
    lowerKebab,
    scopeToRegex,
    segmentFilterRegex,
    statusIcon,
    typeIcon,
} from "CampaignNotes-utils";
import { type App, Notice, type TFile } from "obsidian";
import {
    type Area,
    type CampaignEntity,
    type DataScope,
    type Encounter,
    EntityType,
    type Group,
    GroupStatus,
    type NPC,
    NPCStatus,
    type Place,
    type RowCount,
} from "./@types";

/**
 * Class for regenerating index tables in markdown files
 * This creates static representations of the dynamic tables from reference.ts
 * It also handles generation of tag-based connection tables previously in cmd-tag-lists.ts
 */
export class TableGenerationService {
    private index: CampaignNotesIndex;
    private cache: CampaignNotesCache;
    private app: App;

    // Regular expressions for finding sections to replace with scope parameter
    private ENCOUNTERS_SECTION =
        /([\s\S]*?<!--\s*ENCOUNTERS\s+BEGIN\s*-->)[\s\S]*?(<!--\s*ENCOUNTERS\s+END\s*-->[\s\S]*?)/i;
    private GROUPS_SECTION =
        /([\s\S]*?<!--\s*GROUPS\s+BEGIN\s*-->)[\s\S]*?(<!--\s*GROUPS\s+END\s*-->[\s\S]*?)/i;
    private NPCS_SECTION =
        /([\s\S]*?<!--\s*NPCS\s+BEGIN\s*-->)[\s\S]*?(<!--\s*NPCS\s+END\s*-->[\s\S]*?)/i;
    private PLACES_SECTION =
        /([\s\S]*?<!--\s*PLACES\s+BEGIN\s*-->)[\s\S]*?(<!--\s*PLACES\s+END\s*-->[\s\S]*?)/i;
    private RENOWN_SECTION =
        /([\s\S]*?<!--\s*RENOWN\s+BEGIN\s*-->)[\s\S]*?(<!--\s*RENOWN\s+END\s*-->[\s\S]*?)/i;
    private TAG_CONNECTION_SECTION =
        /(<!--\s*tagConnection:begin\s+(?:scope|tag)="([^"]+?)"\s+type="([^"]+?)"\s*-->)[\s\S]*?(<!--\s*tagConnection:end\s*-->)/i;

    constructor(
        app: App,
        index: CampaignNotesIndex,
        cache: CampaignNotesCache,
    ) {
        this.app = app;
        this.index = index;
        this.cache = cache;
    }

    rowCount = (): { count: number } => ({ count: 0 });

    scopeFilter = (entity: CampaignEntity, dataScope: DataScope): boolean => {
        return dataScope.filter ? dataScope.filter.test(entity.filePath) : true;
    };

    fileScope = (file: TFile): string => {
        const cache = this.app.metadataCache.getFileCache(file);
        return cache?.frontmatter?.scope || file.path.split("/")[0];
    };

    fileScopePattern = (file: TFile, scope: string): string => {
        const cache = this.app.metadataCache.getFileCache(file);
        return cache?.frontmatter?.scopePattern || scope;
    };

    fileFilterPattern = (file: TFile): RegExp | undefined => {
        const cache = this.app.metadataCache.getFileCache(file);
        const filterString = cache?.frontmatter?.scopeFilter;
        return filterString ? segmentFilterRegex(filterString) : undefined;
    };

    async generateTables(): Promise<void> {
        const files = this.index.getGeneratedIndexFiles();
        if (files.length === 0) {
            console.warn(
                "No index files found with 'index: generated' in frontmatter",
            );
            return;
        }

        // Process index files with appropriate tags in frontmatter
        const indexFilesByScope = new Map<string, TFile[]>();
        for (const file of files) {
            const scope = this.fileScope(file); //primary
            const scopePattern = this.fileScopePattern(file, scope); // included scopes
            addToMappedArray(indexFilesByScope, scopePattern, file);
        }
        this.index.logDebug("Index files by scope", indexFilesByScope);

        this.cache.clearRelationshipCache();

        // First: read/update content
        for (const [scopePattern, files] of indexFilesByScope) {
            await this.processFileGroup(scopePattern, files);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        this.cache.clearRelationshipCache();
    }

    private async processFileGroup(
        scopePattern: string, files: TFile[]): Promise<void> {
        this.cache.precomputeRelationshipsForScope(scopePattern);
        await new Promise((resolve) => setTimeout(resolve, 0));

        for (const file of files) {
            const dataScope = {
                active: this.fileScope(file),
                pattern: scopePattern,
                regex: scopeToRegex(scopePattern),
                filter: this.fileFilterPattern(file),
            };

            await this.processFile(dataScope, file);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    private async processFile(
        dataScope: DataScope,
        file: TFile,
    ): Promise<void> {
        // Processing the file is an atomic operation.
        // Do as little processing as possible to format content
        let updatedContent = await this.app.vault.read(file);

        // Check for each section type and update if found
        if (this.ENCOUNTERS_SECTION.test(updatedContent)) {
            updatedContent = this.updateEncounterSection(
                updatedContent,
                dataScope,
            );
        }

        if (this.GROUPS_SECTION.test(updatedContent)) {
            updatedContent = this.updateGroupsSection(
                updatedContent,
                dataScope,
            );
        }

        if (this.NPCS_SECTION.test(updatedContent)) {
            updatedContent = this.updateNPCsSection(
                updatedContent,
                dataScope,
            );
        }

        if (this.PLACES_SECTION.test(updatedContent)) {
            updatedContent = this.updatePlacesSection(
                updatedContent,
                dataScope,
            );
        }

        if (this.RENOWN_SECTION.test(updatedContent)) {
            updatedContent = this.updateRenownSection(
                updatedContent,
                dataScope,
            );
        }

        if (this.TAG_CONNECTION_SECTION.test(updatedContent)) {
            updatedContent = this.updateTagConnectionSections(
                updatedContent,
                dataScope,
            );
        }

        await this.app.vault.process(file, () => updatedContent);
        new Notice(`Updated ${file.path}`);
        console.log("Processed", file.path, "with", dataScope);
    }

    private updateEncounterSection(
        content: string,
        dataScope: DataScope,
    ): string {
        const match = this.ENCOUNTERS_SECTION.exec(content);
        if (!match) return content;

        const prefix = match[1];
        const suffix = match[2];
        const generated = this.generateEncounterContent(dataScope);

        return content.replace(
            this.ENCOUNTERS_SECTION,
            prefix + generated + suffix,
        );
    }

    private updateGroupsSection(content: string, dataScope: DataScope): string {
        const match = this.GROUPS_SECTION.exec(content);
        if (!match) return content;

        const prefix = match[1];
        const suffix = match[2];
        const generated = this.generateGroupsContent(dataScope);

        return content.replace(
            this.GROUPS_SECTION,
            prefix + generated + suffix,
        );
    }

    private updateNPCsSection(content: string, dataScope: DataScope): string {
        const match = this.NPCS_SECTION.exec(content);
        if (!match) return content;

        const prefix = match[1];
        const suffix = match[2];
        const generated = this.generateNPCsContent(dataScope);

        return content.replace(this.NPCS_SECTION, prefix + generated + suffix);
    }

    private updatePlacesSection(content: string, dataScope: DataScope): string {
        const match = this.PLACES_SECTION.exec(content);
        if (!match) return content;

        const prefix = match[1];
        const suffix = match[2];
        const generated = this.generatePlacesContent(dataScope);

        return content.replace(
            this.PLACES_SECTION,
            prefix + generated + suffix,
        );
    }

    private updateRenownSection(content: string, dataScope: DataScope): string {
        const match = this.RENOWN_SECTION.exec(content);
        if (!match) return content;

        const prefix = match[1];
        const suffix = match[2];
        const generated = this.generateRenownContent(dataScope);

        return content.replace(
            this.RENOWN_SECTION,
            prefix + generated + suffix,
        );
    }

    private updateTagConnectionSections(
        content: string,
        dataScope: DataScope,
    ): string {
        const blocks = content.split(
            /(<!--\s*tagConnection:begin[\s\S]*?tagConnection:end\s*-->)/,
        );

        let i: number;
        for (i = 0; i < blocks.length; i++) {
            const match = this.TAG_CONNECTION_SECTION.exec(blocks[i]);
            if (match) {
                const prefix = match[1];
                const scope = match[2];
                const typeString = match[3].replace("location", "place"); // Normalize type
                const suffix = match[4];

                const type = this.index.getEntityType(typeString);
                if (!type) {
                    console.warn(
                        `Unknown type "${typeString}" in tag connection section`,
                    );
                    continue;
                }

                const sectionDataScope = {
                    ...dataScope,
                    active: scope,
                };

                const generated = this.generateTagConnectionContent(
                    sectionDataScope,
                    type,
                );

                blocks[i] = prefix + generated + suffix;
            }
        }
        return blocks.join("");
    }

    private generateEncounterContent(dataScope: DataScope): string {
        // Get scoped encounters from the API
        const encounters = this.cache.getEncounters(dataScope.pattern);

        const activeEncounters = [];
        const activeCounter = this.rowCount();
        const newEncounters = [];
        const newCounter = this.rowCount();
        const otherEncounters = [];
        const otherCounter = this.rowCount();

        for (const e of encounters) {
            const status = e.status;
            if (status === "active") {
                activeEncounters.push(
                    this.formatEncounterCard(dataScope, e, activeCounter, true),
                );
            } else if (status === "new") {
                newEncounters.push(
                    this.formatEncounterCard(dataScope, e, newCounter, true),
                );
            } else {
                otherEncounters.push(
                    this.formatEncounterCard(dataScope, e, otherCounter),
                );
            }
        }

        let result = "\n";

        const header =
            "<thead><tr><th>level</th><th>status</th><th></th></tr></thead>";

        if (activeEncounters.length > 0) {
            result += "## Active Encounters\n\n";
            result += `<table class="index encounter-table">${header}<tbody>${activeEncounters.join("")}</tbody></table>\n\n`;
        }

        if (newEncounters.length > 0) {
            result += "## New Encounters\n\n";
            result += `<table class="index encounter-table">${header}<tbody>${newEncounters.join("")}</tbody></table>\n\n`;
        }

        if (otherEncounters.length > 0) {
            result += "## Other Encounters\n\n";
            result += `<table class="index encounter-table">${header.replace("<th>level</th>", "")}<tbody>${otherEncounters.join("")}</tbody></table>\n\n`;
        }

        if (
            activeEncounters.length === 0 &&
            newEncounters.length === 0 &&
            otherEncounters.length === 0
        ) {
            result += "No Encounters\n\n";
        }

        return result;
    }

    private generateGroupsContent(dataScope: DataScope): string {
        const filteredGroups = this.cache.getGroups(dataScope.pattern);

        const activeGroups = [];
        const activeCounter = this.rowCount();
        const defunctGroups = [];
        const defunctCounter = this.rowCount();
        const otherGroups = [];
        const otherCounter = this.rowCount();

        for (const group of filteredGroups) {
            const status = this.cache.getGroupStatus(dataScope, group.id);

            if (!status || status === "active") {
                const text = this.formatGroupCard(
                    group,
                    dataScope,
                    activeCounter,
                );
                activeGroups.push(text);
            } else if (status === "defunct") {
                const text = this.formatGroupCard(
                    group,
                    dataScope,
                    defunctCounter,
                );
                defunctGroups.push(text);
            } else {
                const text = this.formatGroupCard(
                    group,
                    dataScope,
                    otherCounter,
                );
                otherGroups.push(text);
            }
        }

        let result = "\n";

        const header =
            "<thead><tr><th></th><th>name</th><th>subtype</th><th>scope</th><th>sess</th></tr></thead>";

        if (activeGroups.length > 0) {
            result += "## Active Groups\n\n";
            result += `<table class="index group-table">${header}<tbody>${activeGroups.join("")}</tbody></table>\n\n`;
        }

        if (defunctGroups.length > 0) {
            result += "## Defunct Groups\n\n";
            result += `<table class="index group-table">${header}<tbody>${defunctGroups.join("")}</tbody></table>\n\n`;
        }

        if (otherGroups.length > 0) {
            result += "## Other Groups\n\n";
            result += `<table class="index group-table">${header}<tbody>${otherGroups.join("")}</tbody></table>\n\n`;
        }

        if (
            activeGroups.length === 0 &&
            defunctGroups.length === 0 &&
            otherGroups.length === 0
        ) {
            result += "No Groups\n\n";
        }

        return result;
    }

    private generateNPCsContent(dataScope: DataScope): string {
        const result = [];
        const header =
            "<thead><tr><th>sess</th><th>stat</th><th>iff</th><th></th><th>scope</th></tr></thead>";

        // Family / Pets
        const familySection = this.generateNPCGroup(
            header,
            "family",
            "Family & Friends",
            dataScope,
        );
        if (familySection) result.push(familySection);

        // Allies / Employees
        const alliesSection = this.generateNPCGroup(
            header,
            "allies",
            "Friends & Allies",
            dataScope,
        );
        if (alliesSection) result.push(alliesSection);

        // Enemies
        const enemiesSection = this.generateNPCGroup(
            header,
            "enemies",
            "Enemies",
            dataScope,
        );
        if (enemiesSection) result.push(enemiesSection);

        // Other
        const otherSection = this.generateNPCGroup(
            header,
            "other",
            "Other",
            dataScope,
        );
        if (otherSection) result.push(otherSection);

        if (result.length > 0) {
            return `\n${result.join("")}`;
        }
        return "\nNo NPCs\n\n";
    }

    private generateNPCGroup(
        thead: string,
        iffGroup: string,
        heading: string,
        dataScope: DataScope,
    ): string {
        const iffNpcs = this.cache.getIffNpcs(dataScope, iffGroup);

        if (!iffNpcs || iffNpcs.length === 0) {
            return "";
        }
        const counter = this.rowCount();
        return (
            `## ${heading}\n\n` +
            `<table class="index npc-table">${thead}<tbody>${iffNpcs
                .map((npc) => this.formatNPCCard(npc, dataScope, counter))
                .join("")}</tbody></table>\n\n`
        );
    }

    private generatePlacesContent(dataScope: DataScope): string {
        let result = "\n";

        const areaCounter = this.rowCount();
        const formattedAreas = this.cache
            .getAreas(dataScope.pattern)
            .filter((area) => this.scopeFilter(area, dataScope))
            .map((area) => this.formatAreaCard(area, dataScope, areaCounter));

        const header =
            "<thead><tr><th>sess</th><th></th><th>subtype</th></tr></thead>";

        result += "## Areas\n\n";
        if (formattedAreas.length > 0) {
            result += `<table class="index area-table">${header}<tbody>${formattedAreas.join("")}</tbody></table>\n\n`;
        } else {
            result += "No Areas\n\n";
        }

        const placeCounter = this.rowCount();
        const formattedPlaces = this.cache
            .getPlaces(dataScope.pattern)
            .filter((place) => this.scopeFilter(place, dataScope))
            .map((place) =>
                this.formatPlaceCard(place, dataScope, placeCounter),
            );

        result += "## Places\n\n";
        if (formattedPlaces.length > 0) {
            result += `<table class="index place-table">${header}<tbody>${formattedPlaces.join("")}</tbody></table>\n\n`;
        } else {
            result += "No Places\n\n";
        }
        return result;
    }

    private generateRenownContent(dataScope: DataScope): string {
        let result = "\n";
        const header =
            "<thead><tr><th>renown</th><th></th><th></th><th>sess</th></tr></thead>";

        const counter = this.rowCount();
        const groupsRenown = this.cache
            .getGroupRenown(dataScope)
            .map((place) => this.formatRenownCard(place, dataScope, counter));

        result += "## Renown\n\n";
        if (groupsRenown.length > 0) {
            result += `<table class="index place-table">${header}<tbody>${groupsRenown.join("")}</tbody></table>\n\n`;
        } else {
            result += "None\n\n";
        }
        return result;
    }

    private generateTagConnectionContent(
        dataScope: DataScope,
        type: EntityType,
    ): string {
        const result = [];

        // Filter to entities that are active in the current scope
        const entities: CampaignEntity[] = this.cache.getActiveByType(
            type,
            dataScope,
        );
        const filteredEntities = entities.filter((e) => {
            return (
                e.scope === dataScope.active || !!e.state?.[dataScope.active]
            );
        });

        result.push(`| ${type} for ${dataScope.pattern.replace("|", "|")} |`);
        result.push("|--------|");
        if (filteredEntities?.length > 0) {
            for (const entity of filteredEntities) {
                result.push(`| [${entity.name}](${entity.id}) |`);
            }
        } else {
            result.push("| None |");
        }

        result.push(`^${type}-items-${dataScope.active}`);

        // Markdown table content
        return `\n\n${result.join("\n")}\n\n`;
    }

    private formatEncounterCard(
        dataScope: DataScope,
        encounter: Encounter,
        counter: RowCount,
        showLevel = false,
    ): string {
        const status = encounter.status;
        const references = this.cache.getRelatedByType(
            dataScope.pattern,
            encounter.id,
        );

        const entityGroups = [];
        for (const [type, entityLinks] of references) {
            entityGroups.push(
                `<span>${typeIcon(type)} ${Array.from(entityLinks.values()).join(", ")}</span>`,
            );
        }

        const evenOdd = counter.count++ % 2 === 0 ? "even" : "odd";
        const rowSpan = entityGroups.length > 0 ? ' rowspan="2"' : "";
        const rowClass = evenOdd + (rowSpan ? " multirow" : "");

        const related =
            entityGroups.length > 0
                ? `</tr><tr class="${rowClass} last"><td class="indent multirow">${entityGroups.join("; ")}</td>`
                : "";

        const level = showLevel
            ? `<td${rowSpan} class="cellWidth center">${encounter.level ? encounter.level : ""}</td>`
            : "";

        const row = [
            `<tr class="${rowClass} first">`,
            level,
            `<td${rowSpan} class="cellWidth" style="--cell-width: 4.5em;">${status}</td>`,
            `<td>${entityToLink(encounter, true)}</td>`,
            related,
            "</tr>",
        ];
        return row.join("");
    }

    private formatGroupCard(
        group: Group,
        dataScope: DataScope,
        counter: RowCount,
    ): string {
        const evenOdd = counter.count++ % 2 === 0 ? "even" : "odd";
        const notesRow = this.associatedNotes(
            group,
            dataScope,
            `${evenOdd} last`,
        );
        const rowSpan = notesRow ? ` rowspan="2"` : "";
        const rowClass = evenOdd + (rowSpan ? " multirow first" : "");
        const renown = group.state[dataScope.active || "*"]?.renown || "";

        const row = [
            `<tr class="${rowClass}"}>`,
            `<td${rowSpan} class="cellWidth center" style="--cell-width: 3em;">${group.icon || ""}</td>`,
            `<td>${entityToLink(group, true)}${renown ? ` (${renown})` : ""}</td>`,
            `<td${rowSpan} class="cellWidth" style="--cell-width: 8em;">${group.subtype || ""}</td>`,
            `<td${rowSpan} class="cellWidth" style="--cell-width: 6em;">${group.scope}</td>`,
            `<td${rowSpan} class="cellWidth center" style="--cell-width: 3em;">${this.cache.getLastSeen(group, dataScope.pattern)}</td>`,
            notesRow,
            "</tr>",
        ];
        return row.join("");
    }

    private formatNPCCard(
        npc: NPC,
        dataScope: DataScope,
        counter: RowCount,
    ): string {
        const iffKey = iffStatusIcon(
            npc.state[dataScope.active || "*"]?.iff || "",
        );
        const status = statusIcon(
            npc.state[dataScope.active || "*"]?.status || "",
        );

        const icons = this.cache.getIcons(npc);
        const iconText = icons ? ` <span class="icon">(${icons})</span>` : "";
        const lastSeenText = this.cache.getLastSeen(npc, dataScope.pattern);

        const evenOdd = counter.count++ % 2 === 0 ? "even" : "odd";
        const notesRow = this.associatedNotes(
            npc,
            dataScope,
            `${evenOdd} last`,
        );
        const rowSpan = notesRow ? ` rowspan="2"` : "";
        const rowClass = evenOdd + (rowSpan ? " multirow first" : "");

        const set = [
            `<tr class="${rowClass}">`,
            `<td${rowSpan} class="cellWidth center" style="--cell-width: 2em;">${lastSeenText}</td>`,
            `<td${rowSpan} class="cellWidth">${status}</td>`,
            `<td${rowSpan} class="cellWidth">${iffKey}</td>`,
            `<td>${entityToLink(npc, true)}${iconText}</td>`,
            `<td${rowSpan} class="cellWidth center" style="--cell-width: 6em;">${npc.scope}</td>`,
            notesRow,
            "</tr>",
        ];

        return set.join("");
    }

    private formatAreaCard(
        area: Area,
        dataScope: DataScope,
        counter: RowCount,
    ): string {
        const lastSeenText = this.cache.getLastSeen(area, dataScope.pattern);
        const subtypeText = area.subtype || "";

        const groupAreaText = [];
        const areas = this.cache.getRelatedOfType(
            dataScope.pattern,
            area.id,
            EntityType.AREA,
        );
        if (areas) {
            groupAreaText.push(`${typeIcon("area")} ${areas.join(", ")}`);
        }
        const groups = this.cache.getRelatedOfType(
            dataScope.pattern,
            area.id,
            EntityType.GROUP,
        );
        if (groups) {
            groupAreaText.push(`${typeIcon("group")} ${groups.join(", ")}`);
        }
        const groupInfo =
            groupAreaText.length > 0 ? ` — ${groupAreaText.join("; ")}` : "";

        const evenOdd = counter.count++ % 2 === 0 ? "even" : "odd";
        const notesRow = this.associatedNotes(
            area,
            dataScope,
            `${evenOdd} last`,
        );
        const rowSpan = notesRow ? ` rowspan="2"` : "";
        const rowClass = evenOdd + (rowSpan ? " multirow first" : "");

        const set = [
            `<tr class="${rowClass}">`,
            `<td${rowSpan} class="cellWidth center" style="--cell-width: 2em;">${lastSeenText}</td>`,
            `<td>${entityToLink(area, true)}${groupInfo}</td>`,
            `<td${rowSpan} class="cellWidth" style="--cell-width: 8em;">${subtypeText}</td>`,
            notesRow,
            "</tr>",
        ];
        return set.join("");
    }

    private formatPlaceCard(
        place: Place,
        dataScope: DataScope,
        counter: RowCount,
    ): string {
        const lastSeenText = this.cache.getLastSeen(place, dataScope.pattern);
        const subtypeText = place.subtype || "";

        const groupAreaText = [];
        if (place.area) {
            const area = this.index.getEntityById(place.area);
            if (area) {
                groupAreaText.push(`${typeIcon("area")} ${entityToLink(area)}`);
            } else {
                console.warn(
                    "Area not found",
                    place.id,
                    place.name,
                    place.area,
                );
            }
        }

        const groups = this.cache.getRelatedOfType(
            dataScope.pattern,
            place.id,
            EntityType.GROUP,
        );
        if (groups) {
            groupAreaText.push(`${typeIcon("group")} ${groups.join(", ")}`);
        }

        const groupInfo =
            groupAreaText.length > 0 ? ` — ${groupAreaText.join("; ")}` : "";

        // If notes exist, add them as a second row
        const evenOdd = counter.count++ % 2 === 0 ? "even" : "odd";
        const notesRow = this.associatedNotes(
            place,
            dataScope,
            `${evenOdd} last`,
        );
        const rowSpan = notesRow ? ` rowspan="2"` : "";
        const rowClass = evenOdd + (rowSpan ? " multirow first" : "");

        const row = [
            `<tr class="${rowClass}">`,
            `<td${rowSpan} class="cellWidth center" style="--cell-width: 2em;">${lastSeenText}</td>`,
            `<td>${entityToLink(place, true)}${groupInfo}</span>`,
            `<td${rowSpan} class="cellWidth" style="--cell-width: 8em;">${subtypeText}</td>`,
            notesRow,
            "</tr>",
        ];
        return row.join("");
    }

    formatRenownCard(
        group: Group,
        dataScope: DataScope,
        counter: RowCount,
    ): string {
        const lastSeenText = this.cache.getLastSeen(group, dataScope.pattern);
        const evenOdd = counter.count++ % 2 === 0 ? "even" : "odd";
        const renown = group.state[dataScope.active || "*"]?.renown || "";

        const row = [
            `<tr class="${evenOdd}">`,
            `<td class="cellWidth center" style="--cell-width: 3em;">${renown || ""}</td>`,
            `<td class="cellWidth center" style="--cell-width: 3em;">${group.icon || ""}</td>`,
            `<td>${entityToLink(group, true)}</td>`,
            `<td class="cellWidth center" style="--cell-width: 2em;">${lastSeenText}</td>`,
            "</tr>",
        ];
        return row.join("");
    }

    private associatedNotes(
        entity: CampaignEntity,
        dataScope: DataScope,
        evenOdd: string,
    ): string {
        const notes = entity.state[dataScope.active || "*"]?.notes || "";
        return notes
            ? `</tr><tr class="${evenOdd} multirow"><td class="indent notes">${notes}</td>`
            : "";
    }
}

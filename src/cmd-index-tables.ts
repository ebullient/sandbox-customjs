import type { App, TFile } from "obsidian";
import type {
    Area,
    CampaignEntity,
    Encounter,
    EntityType,
    Group,
    NPC,
    Place,
} from "../plugin/src/@types";
import type { CampaignReferenceAPI } from "../plugin/src/@types/api";
import type { Utils } from "./_utils";

declare global {
    interface Window {
        campaignNotes?: {
            api?: CampaignReferenceAPI;
        };
    }
}

/**
 * Class for regenerating index tables in markdown files
 * This creates static representations of the dynamic tables from reference.ts,
 * using a similar approach to cmd-timeline.ts
 */
export class IndexTables {
    // Regular expressions for finding sections to replace with scope parameter
    ENCOUNTERS_SECTION =
        /([\s\S]*?<!--\s*ENCOUNTERS\s+BEGIN\s*-->)[\s\S]*?(<!--\s*ENCOUNTERS\s+END\s*-->[\s\S]*?)/i;
    GROUPS_SECTION =
        /([\s\S]*?<!--\s*GROUPS\s+BEGIN(?:\s+scope="([^"]+?)")?\s*-->)[\s\S]*?(<!--\s*GROUPS\s+END\s*-->[\s\S]*?)/i;
    NPCS_SECTION =
        /([\s\S]*?<!--\s*NPCS\s+BEGIN(?:\s+scope="([^"]+?)")?\s*-->)[\s\S]*?(<!--\s*NPCS\s+END\s*-->[\s\S]*?)/i;
    PLACES_SECTION =
        /([\s\S]*?<!--\s*PLACES\s+BEGIN(?:\s+scope="([^"]+?)")?\s*-->)[\s\S]*?(<!--\s*PLACES\s+END\s*-->[\s\S]*?)/i;

    app: App;
    statusOrder = ["alive", "undead", "ghost", "dead", "unknown"];

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded IndexTables renderer");
    }

    utils = (): Utils => window.customJS.Utils;
    campaignApi = (): CampaignReferenceAPI => window.campaignNotes?.api;

    fileScope = (file: TFile) => {
        const cache = this.app.metadataCache.getFileCache(file);
        return cache?.frontmatter?.scope || file.path.split("/")[0];
    };

    async invoke() {
        console.log("Rebuilding the index");
        this.campaignApi().rebuildIndex();

        console.log("Regenerating index tables");

        // Process index files with appropriate tags in frontmatter
        const files = this.campaignApi().getGeneratedIndexFiles();

        if (files.length === 0) {
            console.log(
                "No index files found with 'index: generated' in frontmatter",
            );
            return;
        }
        console.log(`Found ${files.length} index files to process`);
        const promises = files.map((file) => this.processFile(file));
        return Promise.all(promises);
    }

    async processFile(file: TFile): Promise<void> {
        console.log(`Processing index file ${file.path}`);
        const currentScope = this.fileScope(file);

        await this.app.vault.process(file, (content) => {
            let updatedContent = content;

            // Check for each section type and update if found
            if (this.ENCOUNTERS_SECTION.test(updatedContent)) {
                updatedContent = this.updateEncounterSection(
                    updatedContent,
                    currentScope,
                );
            }

            if (this.GROUPS_SECTION.test(updatedContent)) {
                updatedContent = this.updateGroupsSection(
                    updatedContent,
                    currentScope,
                );
            }

            if (this.NPCS_SECTION.test(updatedContent)) {
                updatedContent = this.updateNPCsSection(
                    updatedContent,
                    currentScope,
                );
            }

            if (this.PLACES_SECTION.test(updatedContent)) {
                updatedContent = this.updatePlacesSection(
                    updatedContent,
                    currentScope,
                );
            }

            console.log(`Content updated for ${file.path}`);
            return updatedContent;
        });
    }

    updateEncounterSection(content: string, currentScope: string): string {
        const match = this.ENCOUNTERS_SECTION.exec(content);
        if (!match) return content;

        const prefix = match[1];
        const suffix = match[2];
        const generated = this.generateEncounterContent(currentScope);

        return content.replace(
            this.ENCOUNTERS_SECTION,
            prefix + generated + suffix,
        );
    }

    updateGroupsSection(content: string, currentScope: string): string {
        const match = this.GROUPS_SECTION.exec(content);
        if (!match) return content;

        const prefix = match[1];
        const suffix = match[3];
        const scopePattern = this.scopeRegex(match[2] || currentScope);
        const generated = this.generateGroupsContent(
            scopePattern,
            currentScope,
        );

        return content.replace(
            this.GROUPS_SECTION,
            prefix + generated + suffix,
        );
    }

    updateNPCsSection(content: string, currentScope: string): string {
        const match = this.NPCS_SECTION.exec(content);
        if (!match) return content;

        const prefix = match[1];
        const suffix = match[3];
        const scopePattern = this.scopeRegex(match[2] || currentScope);
        const generated = this.generateNPCsContent(scopePattern, currentScope);

        return content.replace(this.NPCS_SECTION, prefix + generated + suffix);
    }

    updatePlacesSection(content: string, currentScope: string): string {
        const match = this.PLACES_SECTION.exec(content);
        if (!match) return content;

        const prefix = match[1];
        const suffix = match[3];
        const scopePattern = this.scopeRegex(match[2] || currentScope);
        const generated = this.generatePlacesContent(scopePattern, currentScope);

        return content.replace(
            this.PLACES_SECTION,
            prefix + generated + suffix,
        );
    }

    generateEncounterContent(currentScope: string): string {
        // Get scoped encounters from the API
        const encounters = this.campaignApi()
            .getAllEncounters(currentScope)
            .sort((a, b) => {
                const l1 = a.level || 0;
                const l2 = b.level || 0;
                if (l1 === l2) {
                    return a.name.localeCompare(b.name);
                }
                return l1 - l2;
            });

        const activeEncounters = [];
        const newEncounters = [];
        const otherEncounters = [];

        for (const e of encounters) {
            const status = e.status;
            if (status === "active") {
                activeEncounters.push(this.formatEncounterCard(e, true));
            } else if (status === "new") {
                newEncounters.push(this.formatEncounterCard(e, true));
            } else {
                otherEncounters.push(this.formatEncounterCard(e));
            }
        }

        let result = "\n";

        if (activeEncounters.length > 0) {
            result += "## Active Encounters\n\n";
            result += `<span class="flexTable">${activeEncounters.join("")}</span>\n\n`;
        }

        if (newEncounters.length > 0) {
            result += "## New Encounters\n\n";
            result += `<span class="flexTable">${newEncounters.join("")}</span>\n\n`;
        }

        if (otherEncounters.length > 0) {
            result += "## Other Encounters\n\n";
            result += `<span class="flexTable">${otherEncounters.join("")}</span>\n\n`;
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

    generateGroupsContent(scopePattern: RegExp, currentScope: string): string {
        // Get groups from the API (all scopes)
        const groups = this.campaignApi().getAllGroups();

        // Filter groups based on scopes
        const filteredGroups = groups
            .filter((group) => group.scope?.match(scopePattern))
            .sort((a, b) => a.name.localeCompare(b.name));

        const activeGroups = [];
        const defunctGroups = [];
        const otherGroups = [];

        for (const group of filteredGroups) {
            const status = group.state[currentScope]?.status;
            const statuses = status
                ? [status.toLowerCase()]
                : Object.values(group.state || {})
                    .map((s) => s.status?.toLowerCase())
                    .filter((s) => s);
            const text = this.formatGroupCard(group, currentScope);
            if (statuses.length === 0 || statuses.some((s) => s === "active")) {
                activeGroups.push(text);
            } else if (statuses.some((s) => s === "defunct")) {
                defunctGroups.push(text);
            } else {
                otherGroups.push(text);
            }
        }

        let result = "\n";

        if (activeGroups.length > 0) {
            result += "## Active Groups\n\n";
            result += `<span class="flexTable">${activeGroups.join("")}</span>\n\n`;
        }

        if (defunctGroups.length > 0) {
            result += "## Defunct Groups\n\n";
            result += `<span class="flexTable">${defunctGroups.join("")}</span>\n\n`;
        }

        if (otherGroups.length > 0) {
            result += "## Other Groups\n\n";
            result += `<span class="flexTable">${otherGroups.join("")}</span>\n\n`;
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

    generateNPCsContent(scopePattern: RegExp, currentScope: string): string {
        const npcs = this.campaignApi().getAllNPCs();

        // Filter NPCs based on scopes
        const filteredNPCs = npcs.filter((npc) =>
            npc.scope?.match(scopePattern),
        );

        const iffMap: Map<string, NPC[]> = new Map();
        for (const npc of filteredNPCs) {
            const iffKey = this.campaignApi().iffStatusIcon(npc.state[currentScope]?.iff);
            const iffList = iffMap.get(iffKey) || [];
            iffList.push(npc);
            iffMap.set(iffKey, iffList);
        }

        let result = "\n";

        if (iffMap.size > 0) {
            // Family / Pets
            const familySection = this.generateNPCGroup(
                iffMap,
                ["💖"],
                "Family / Pets",
                currentScope
            );
            if (familySection) result += familySection;

            // Friends
            const friendsSection = this.generateNPCGroup(
                iffMap,
                ["🩵"],
                "Friends",
                currentScope
            );
            if (friendsSection) result += friendsSection;

            // Allies / Employees
            const alliesSection = this.generateNPCGroup(
                iffMap,
                ["🍺", "💚"],
                "Allies / Employees",
                currentScope
            );
            if (alliesSection) result += alliesSection;

            // Enemies
            const enemiesSection = this.generateNPCGroup(
                iffMap,
                ["🔥"],
                "Enemies",
                currentScope
            );
            if (enemiesSection) result += enemiesSection;

            // Other
            const otherSection = this.generateNPCGroup(
                iffMap,
                ["👍", "👎", "🤝", "⬜️"],
                "Other",
                currentScope
            );
            if (otherSection) result += otherSection;
        } else {
            result += "No NPCs\n\n";
        }

        return result;
    }

    generateNPCGroup(
        iffMap: Map<string, NPC[]>,
        keys: string[],
        heading: string,
        currentScope: string,
    ): string {
        const iffNpcs: NPC[] = [];
        for (const key of keys) {
            const npcsForKey = iffMap.get(key) || [];
            iffNpcs.push(...npcsForKey);
        }

        if (iffNpcs.length > 0) {
            return (
                `## ${heading}\n\n` +
                `<span class="flexTable">${iffNpcs
                    .sort((a, b) => this.sortStatus(a, b, currentScope))
                    .map((npc) => this.formatNPCCard(npc, currentScope))
                    .join("")}</span>\n\n`
            );
        }

        return "";
    }

    generatePlacesContent(scopePattern: RegExp, currentScope: string): string {
        let result = "\n";

        const areas = this.campaignApi().getAllAreas();
        const filteredAreas = areas
            .filter((area) => area.scope?.match(scopePattern))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((area) => this.formatAreaCard(area, currentScope));

        result += "## Areas\n\n"
        if (filteredAreas.length > 0) {
            result += `<span class="flexTable">${filteredAreas.join("")}</span>\n\n`;
        } else {
            result += "No Areas\n\n";
        }

        const places = this.campaignApi().getAllPlaces();
        const filteredPlaces = places
            .filter((place) => place.scope?.match(scopePattern))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((place) => this.formatPlaceCard(place, currentScope));

        result += "## Places\n\n"
        if (filteredPlaces.length > 0) {
            result += `<span class="flexTable">${filteredPlaces.join("")}</span>\n\n`;
        } else {
            result += "No Places\n\n";
        }

        return result;
    }

    formatEncounterCard(encounter: Encounter, showLevel = false): string {
        // the id is the target URL, both the file name and the anchor (if any)
        const link = `[**${encounter.name}**](${encounter.id})`;
        const status = encounter.status;

        const references: Map<string, Map<string, CampaignEntity>> = new Map();
        const ids = encounter.tags || [];
        ids.push(
            ...this.campaignApi()
                .getLinks(encounter)
                .map((link) => link.entityRef),
        );
        for (const id of ids) {
            // find the unique entity (by path, or idTag rather than xref)
            const entity = this.campaignApi().getEntityById(id);
            if (entity) {
                this.groupByType(references, entity);
            }
        }

        const text = [`<span class="cell">${link}</span>`];
        const entityGroups = [];
        for (const [type, entities] of references) {
            const entityLinks = [];
            for (const entity of entities.values()) {
                const entityLink = `[${entity.name}](${entity.id})`;
                entityLinks.push(entityLink);
            }
            entityGroups.push(
                `<span>${this.campaignApi().typeIcon(type)} ${entityLinks.join(", ")}</span>`,
            );
        }
        text.push(`<span class="cellIndent">${entityGroups.join("; ")}</span>`);

        const level = showLevel
            ? `<span class="cellWidth center">${encounter.level ? encounter.level : ""}</span>`
            : "";

        const set = [
            `<span class="rowContainer">${level}`,
            `<span class="cellWidth" style="--cell-width: 4.5em;">${status}</span>`,
            `<span class="cellWide colContainer">${text.join("")}</span>`,
            '</span>',
        ];

        return set.join("");
    }

    formatGroupCard(group: Group, currentScope: string): string {
        const link = `<span class="cell">[**${group.name}**](${group.id})</span>`;
        const notesText = this.associatedNotes(group, currentScope);
        const set = [
            '<span class="rowContainer">',
            `<span class="cellWidth center" style="--cell-width: 3em;">${group.icon || ""}</span>`,
            `<span class="cellWide colContainer">${link}${notesText}</span>`,
            `<span class="cellWidth" style="--cell-width: 8em;">${group.subtype || ""}</span>`,
            `<span class="cellWidth" style="--cell-width: 8em;">${group.scope}</span>`,
            "</span>",
        ]
        return set.join("");
    }

    formatNPCCard(npc: NPC, currentScope: string): string {
        const iffKey = this.campaignApi().iffStatusIcon(npc.state[currentScope || "*"]?.iff || "");
        const status = this.campaignApi().statusIcon(npc.state[currentScope || "*"]?.status || "");

        const icons = this.campaignApi().getIcons(npc);
        const iconText = icons ? `<span class="icon"> (${icons})</span>` : "";
        const lastSeenText = this.campaignApi().getLastSeen(npc);
        const notesText = this.associatedNotes(npc, currentScope);

        const link = `<span class="cell">[**${npc.name}**](${npc.id})${iconText}</span>`;

        const set = [
            `<span class="rowContainer">`,
            `<span class="cellWidth center" style="--cell-width: 2em;">${lastSeenText}</span>`,
            `<span class="cellWidth">${status}</span>`,
            `<span class="cellWidth">${iffKey}</span>`,
            `<span class="cellWide colContainer">${link}${notesText}</span>`,
            "</span>",
        ];

        return set.join("");
    }

    formatAreaCard(area: Area, currentScope: string): string {
        const lastSeenText = this.campaignApi().getLastSeen(area);
        const subtypeText = area.subtype || "";
        const notesText = this.associatedNotes(area, currentScope);

        const groupAreaText = [];
        const groups = this.affiliatedGroups(area);
        if (groups) {
            groupAreaText.push(`${this.campaignApi().typeIcon('group')} ${groups}`);
        }

        const link = `<span class="cell">[**${area.name}**](${area.id}) — ${groupAreaText.join("; ")}</span>`;

        const set = [
            '<span class="rowContainer">',
            `<span class="cellWidth center" style="--cell-width: 2em;">${lastSeenText}</span>`,
            `<span class="cellWide colContainer">${link}${notesText}</span>`,
            `<span class="cellWidth" style="--cell-width: 8em;">${subtypeText}</span>`,
            '</span>'
        ];
        return set.join("");
    }

    formatPlaceCard(place: Place, currentScope: string): string {
        const lastSeenText = this.campaignApi().getLastSeen(place);
        const subtypeText = place.subtype || "";
        const notesText = this.associatedNotes(place, currentScope);

        const groupAreaText = [];
        if (place.area) {
            const area = this.campaignApi().getEntityById(place.area);
            if (area) {
                groupAreaText.push(`${this.campaignApi().typeIcon('area')} [${area.name}](${area.id})`);
            } else {
                console.warn("Area not found", place.id, place.name, place.area);
            }
        }

        const groups = this.affiliatedGroups(place);
        if (groups) {
            groupAreaText.push(`${this.campaignApi().typeIcon('group')} ${groups}`);
        }

        const link = `<span class="cell">[**${place.name}**](${place.id}) — ${groupAreaText.join("; ")}</span>`;

        const set = [
            '<span class="rowContainer">',
            `<span class="cellWidth center" style="--cell-width: 2em;">${lastSeenText}</span>`,
            `<span class="cellWide colContainer">${link}${notesText}</span>`,
            `<span class="cellWidth" style="--cell-width: 8em;">${subtypeText}</span>`,
            '</span>'
        ];
        return set.join("");
    }

    associatedNotes(entity: CampaignEntity, currentScope: string): string {
        const notes = entity.state[currentScope || "*"]?.notes || "";
        return notes
            ? `<span class="cellIndent notes">${notes}</span>`
            : "";
    }

    affiliatedGroups(entity: CampaignEntity): string {
        return (entity.tags || [])
            .filter((tag) => tag.match(/group/))
            .map((tag) => this.campaignApi().getEntityById(tag))
            .filter((group) => group)
            .map((link) => `[${link.name}](${link.id})`)
            .join(", ");
    }

    groupByType(
        map: Map<string, Map<string, CampaignEntity>>,
        entity: CampaignEntity,
    ): void {
        const type = entity.type;
        const entities = map.get(type) || new Map();
        entities.set(entity.id, entity);
        map.set(type, entities);
    }

    scopeRegex(root: string): RegExp {
        return this.utils().scopeRegex(root);
    }

    sortStatus(a: NPC, b: NPC, currentScope: string): number {
        const n1 = a.state[currentScope || "*"]?.status || "unknown";
        const idx1 = this.statusOrder.indexOf(n1);
        const n2 = b.state[currentScope || "*"]?.status || "unknown";
        const idx2 = this.statusOrder.indexOf(n2);
        if (idx1 === idx2) {
            return a.name.localeCompare(b.name);
        }
        return idx1 - idx2;
    }
}

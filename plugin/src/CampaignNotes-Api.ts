import type { Plugin, Reference, TFile } from "obsidian";
import {
    type Area,
    type CampaignEntity,
    type CleanLink,
    type Encounter,
    EncounterStatus,
    EntityType,
    type Group,
    type Item,
    type NPC,
    type Place,
} from "./@types";
import type { CampaignReferenceAPI } from "./@types/api";
import type { CampaignNotesIndex } from "./CampaignNotes-Index";

/**
 * A simple API for other plugins or scripts to access the campaign notes data
 */
export class CampaignReference implements CampaignReferenceAPI {
    plugin: Plugin;
    index: CampaignNotesIndex;

    constructor(plugin: Plugin, index: CampaignNotesIndex) {
        this.plugin = plugin;
        this.index = index;
    }

    /**
     * Get all areas
     */
    getAllAreas(scope = ""): Area[] {
        return this.index.getEntitiesByType(EntityType.AREA, scope);
    }

    /**
     * Get all encounters
     */
    getAllEncounters(scope = ""): Encounter[] {
        return this.index.getEntitiesByType(EntityType.ENCOUNTER, scope);
    }

    /**
     * Get active encounters
     */
    getActiveEncounters(scope = ""): Encounter[] {
        const encounters = this.getAllEncounters(scope);
        return encounters.filter((e) => {
            return e.status === EncounterStatus.ACTIVE;
        });
    }

    /**
     * Get all groups
     */
    getAllGroups(scope = ""): Group[] {
        return this.index.getEntitiesByType(EntityType.GROUP, scope);
    }

    /**
     * Get all items
     */
    getAllItems(scope = ""): Item[] {
        return this.index.getEntitiesByType(EntityType.ITEM, scope);
    }

    /**
     * Get all locations
     */
    getAllPlaces(scope = ""): Place[] {
        return this.index.getEntitiesByType(EntityType.PLACE, scope);
    }

    /**
     * Get all NPCs
     */
    getAllNPCs(scope = ""): NPC[] {
        return this.index.getEntitiesByType(EntityType.NPC, scope);
    }

    getBacklinks(filePath: string, scope: string): TFile[] {
        return this.index.getBacklinks(filePath, scope);
    }

    getLinks<T extends CampaignEntity>(entity: T): CleanLink[] {
        return this.index.getLinks(entity);
    }

    /**
     * Get entities by tag
     */
    getEntitiesByTag(tag: string, scope = ""): CampaignEntity[] {
        return this.index.getEntitiesByTag(tag, scope);
    }

    /**
     * Get entities by type
     */
    getEntitiesByType(type: EntityType, scope?: string): CampaignEntity[] {
        return this.index.getEntitiesByType(type, scope);
    }

    /**
     * Get an entity by ID
     */
    getEntityById(id: string): CampaignEntity | undefined {
        return this.index.getEntityById(id);
    }

    /**
     * Get all entities in a specific file
     */
    getEntitiesInFile(filePath: string): CampaignEntity[] {
        return this.index.getEntitiesByFile(filePath);
    }

    getIcons(entity: CampaignEntity): string {
        const state = entity.state['*'];
        if (state.icons) {
            return state.icons;
        }

        const icons = new Set<string>();
        if (entity.icon) {
            icons.add(entity.icon);
        }
        if (entity.type === EntityType.NPC) {
            const groupTags = entity.tags.filter((tag) =>
                tag.startsWith("group/"),
            );
            for (const tag of groupTags) {
                const group = this.index.getEntityById(tag);
                if (group?.icon) {
                    icons.add(group.icon);
                }
            }
        }
        state.icons = Array.from(icons).sort().join(" ");
        return state.icons;
    }

    getGeneratedIndexFiles(): TFile[] {
        return [...this.index.indexes.values()];
    }

    getLastSeen(entity: CampaignEntity): string {
        const state = entity.state['*'];
        if (state.lastSeen) {
            return state.lastSeen;
        }

        const lastSeen = this.getBacklinks(entity.file.path, entity.scope)
            .filter((f) => f.path.match(/sessions/))
            .sort((a, b) => a.path.localeCompare(b.path))
            .pop();

        state.lastSeen = lastSeen?.basename.match(/\d+/)?.[0] || "";
        return state.lastSeen;
    }

    /**
     * Rebuild the index
     */
    rebuildIndex(): Promise<void> {
        return this.index.rebuildIndex();
    }

    /* Convert iff status into an emoji */
    iffStatusIcon(iff: string): string {
        // ["family", "pet"], "friend", "ally", "enemy",
        // "positive", "neutral", "negative", "unknown"
        switch (iff) {
            case "family":
                return "💖";
            case "pet":
                return "💖";
            case "taproom":
                return "🍺";
            case "friend":
                return "🩵";
            case "ally":
                return "💚";
            case "enemy":
                return "🔥";
            case "positive":
                return "👍";
            case "negative":
                return "👎";
            case "neutral":
                return "🤝";
            default:
                return "⬜️";
        }
    }

    /* Convert status into an emoji */
    statusIcon(alive: string): string {
        switch (alive) {
            case "alive":
                return "🌱";
            case "dead":
                return "💀";
            case "undead":
                return "🧟‍♀️";
            case "ghost":
                return "👻";
            default:
                return "⬜️";
        }
    }

    typeIcon(type: string): string {
        switch (type) {
            case "area":
                return "🗺️";
            case "encounter":
                return "🎢";
            case "group":
                return "👥";
            case "item":
                return "🧸";
            case "place":
                return "🎠";
            case "npc":
                return "👤";
            case "pc":
                return "😇";
            default:
                return "⬜️";
        }
    }
}

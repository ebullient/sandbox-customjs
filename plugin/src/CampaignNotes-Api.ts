import type { CampaignNotesCache } from "CampaignNotes-Cache";
import type { Editor, Plugin, TFile } from "obsidian";
import type {
    Area,
    CampaignEntity,
    CleanLink,
    Encounter,
    EntityType,
    Group,
    Item,
    NPC,
    Place,
} from "./@types";
import type { CampaignReferenceAPI } from "./@types/api";
import type {
    EntityLinkOptions,
    EntitySelectorService,
} from "./CampaignNotes-EntitySelector";
import type { CampaignNotesIndex } from "./CampaignNotes-Index";

/**
 * A simple API for other plugins or scripts to access the campaign notes data
 */
export class CampaignReference implements CampaignReferenceAPI {
    plugin: Plugin;
    index: CampaignNotesIndex;
    cache: CampaignNotesCache;
    entitySelector: EntitySelectorService;

    constructor(
        plugin: Plugin,
        index: CampaignNotesIndex,
        cache: CampaignNotesCache,
        entitySelector: EntitySelectorService,
    ) {
        this.plugin = plugin;
        this.index = index;
        this.cache = cache;
        this.entitySelector = entitySelector;
    }

    /**
     * Get all areas
     */
    getAllAreas(scope = ""): Area[] {
        return this.index.getAllAreas(scope);
    }

    /**
     * Get all encounters
     */
    getAllEncounters(scope = ""): Encounter[] {
        return this.index.getAllEncounters(scope);
    }

    /**
     * Get all groups
     */
    getAllGroups(scope = ""): Group[] {
        return this.index.getAllGroups(scope);
    }

    /**
     * Get all items
     */
    getAllItems(scope = ""): Item[] {
        return this.index.getAllItems(scope);
    }

    /**
     * Get all locations
     */
    getAllPlaces(scope = ""): Place[] {
        return this.index.getAllPlaces(scope);
    }

    /**
     * Get all NPCs
     */
    getAllNPCs(scopePattern?: string): NPC[] {
        return this.index.getAllNPCs(scopePattern);
    }

    getBacklinks(filePath: string, scopePattern?: string): TFile[] {
        return this.cache.getBacklinks(filePath, scopePattern);
    }

    getLinks<T extends CampaignEntity>(entity: T): string[] {
        return this.cache.getLinks(entity);
    }

    /**
     * Get entities by tag
     */
    getEntitiesByTag(tag: string, scopePattern?: string): CampaignEntity[] {
        return this.index.getEntitiesByTag(tag, scopePattern);
    }

    /**
     * Get entities by type
     */
    getEntitiesByType(
        type: EntityType,
        scopePattern?: string,
    ): CampaignEntity[] {
        return this.index.getEntitiesByType(type, scopePattern);
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

    getGeneratedIndexFiles(): TFile[] {
        return this.index.getGeneratedIndexFiles();
    }

    getIcons(entity: CampaignEntity): string {
        return this.cache.getIcons(entity);
    }

    getLastSeen(entity: CampaignEntity, scopePattern?: string): string {
        return this.cache.getLastSeen(entity, scopePattern);
    }

    includeFile(file: TFile): boolean {
        return !this.index.skipFile(file);
    }

    /**
     * Rebuild the index
     */
    rebuildIndex(): Promise<void> {
        return this.index.rebuildIndex();
    }

    /**
     * Open the entity selector modal
     *
     * @param editor The editor instance (optional)
     * @param type Filter by entity type (optional)
     * @param scopePattern Filter by scope pattern (optional)
     * @param options Link formatting options (optional)
     */
    openEntitySelector(
        editor: Editor | null = null,
        type?: EntityType,
        scopePattern?: string,
        options: EntityLinkOptions = {},
    ): void {
        this.entitySelector.openEntitySelector(
            editor,
            type,
            scopePattern,
            options,
        );
    }
}

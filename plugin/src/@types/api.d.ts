import type { Editor, TFile } from "obsidian";
import type { Area, CampaignEntity, Encounter, EntityType, Group, Item, NPC, Place } from ".";

export interface EntityLinkOptions {
    useFirstName?: boolean;
    useCustomText?: string;
}

export interface CampaignReferenceAPI {
    /**
     * Get all encounters
     */
    getAllEncounters(scopePattern?: string): Encounter[];

    /**
     * Get all areas
     */
    getAllAreas(scopePattern?: string): Area[];

    /**
     * Get all groups
     */
    getAllGroups(scopePattern?: string): Group[];

    /**
     * Get all items
     */
    getAllItems(scopePattern?: string): Item[];

    /**
     * Get all NPCs
     */
    getAllNPCs(scopePattern?: string): NPC[];

    /**
     * Get all locations
     */
    getAllPlaces(scopePattern?: string): Place[];

    /**
     * Get all backlinks for the specified file path
     */
    getBacklinks(filePath: string, scopePattern?: string): TFile[];

    /**
     * Get entities by tag
     */
    getEntitiesByTag(tag: string, scopePattern?: string): CampaignEntity[];

    /**
     * Get entities by tag
     */
    getEntitiesByType(type: EntityType, scopePattern?: string): CampaignEntity[];

    /**
     * Get an entity by ID
     */
    getEntityById(id: string): CampaignEntity | undefined;

    /**
     * Get all entities in a specific file
     */
    getEntitiesInFile(filePath: string): CampaignEntity[];

    /**
     * Get generated index files
     */
    getGeneratedIndexFiles(): TFile[];

    /**
     * Get icons associated with the entity
     */
    getIcons(entity: CampaignEntity): string;

    /**
     * Find the last session for the entity
     * @param entity
     * @param scopePattern
     */
    getLastSeen(entity: CampaignEntity, scopePattern?: string): string;

    /**
     * Get all links from the specified entity
     */
    getLinks<T extends CampaignEntity>(entity: T): string[];

    includeFile(file: TFile): boolean;

    /**
     * Rebuild the index
     */
    rebuildIndex(): Promise<void>;

    /**
     * Open the entity selector modal
     *
     * @param editor The editor instance (optional)
     * @param type Filter by entity type (optional)
     * @param scopePattern Filter by scope pattern (optional)
     * @param options Link formatting options (optional)
     */
    openEntitySelector(
        editor: Editor | null,
        type?: EntityType,
        scopePattern?: string,
        options?: EntityLinkOptions,
    ): void;
}

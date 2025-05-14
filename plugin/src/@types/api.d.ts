import type { Reference, TFile } from "obsidian";
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
} from ".";

export interface CampaignReferenceAPI {
    /**
     * Get all NPCs
     */
    getAllNPCs(scope?: string): NPC[];

    /**
     * Get all groups
     */
    getAllGroups(scope?: string): Group[];

    /**
     * Get all locations
     */
    getAllPlaces(scope?: string): Place[];

    /**
     * Get all areas
     */
    getAllAreas(scope?: string): Area[];

    /**
     * Get all items
     */
    getAllItems(scope?: string): Item[];

    /**
     * Get all encounters
     */
    getAllEncounters(scope?: string): Encounter[];

    /**
     * Get active encounters
     */
    getActiveEncounters(scope?: string): Encounter[];

    /**
     * Get all backlinks for the specified file path
     */
    getBacklinks(filePath: string, scope?: string): TFile[];

    getLinks<T extends CampaignEntity>(entity: T): CleanLink[];

    /**
     * Get entities by tag
     */
    getEntitiesByTag(tag: string, scope?: string): CampaignEntity[];

    /**
     * Get entities by tag
     */
    getEntitiesByType(type: EntityType, scope?: string): CampaignEntity[];

    /**
     * Get an entity by ID
     */
    getEntityById(id: string): CampaignEntity | undefined;

    /**
     * Get all entities in a specific file
     */
    getEntitiesInFile(filePath: string): CampaignEntity[];

    getIcons(entity: CampaignEntity): string;

    getGeneratedIndexFiles(): TFile[];

    getLastSeen(entity: CampaignEntity): string;

    iffStatusIcon(iff: string): string;

    statusIcon(alive: string): string;

    typeIcon(type: string): string;

    /**
     * Rebuild the index
     */
    rebuildIndex(): Promise<void>;
}

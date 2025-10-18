import {
    addToMappedMap,
    lowerKebab,
    markdownLinkPath,
    scopeToRegex,
} from "CampaignNotes-utils";
import {
    type FrontMatterCache,
    type TAbstractFile,
    TFile,
    getAllTags,
} from "obsidian";
import {
    type Area,
    type CampaignEntity,
    type Encounter,
    EntityType,
    type Group,
    type GroupStatus,
    type Item,
    type NPC,
    type NPCStatus,
    type NPC_IFF,
    type PC,
    type Place,
} from "./@types";
import type { CampaignNotesSettings } from "./@types/settings";
import type CampaignNotesPlugin from "./main";

const generalTagPrefixes = ["group", "item", "place", "region", "type"];
const validEntityTypes: Set<string> = new Set(Object.values(EntityType));
const typeTagPrefix = "type/";

export const DEFAULT_SETTINGS: CampaignNotesSettings = {
    includeFolders: ["campaign-notes"],
    keepTagPrefix: [],
    campaignScopes: [],
    defaultScopePattern: ".*",
    debug: false,
};

export class CampaignNotesIndex {
    plugin: CampaignNotesPlugin;
    tagPrefixes: string[];

    // Main indexes
    entities: Map<string, CampaignEntity> = new Map();
    uniqueIndex: Map<string, CampaignEntity> = new Map();

    // Secondary indexes for quick lookup
    generatedIndex: Map<string, TFile> = new Map();

    filePathToEntities: Map<string, Map<string, CampaignEntity>> = new Map();
    tagToEntities: Map<string, Map<string, CampaignEntity>> = new Map();
    typeToEntities: Map<EntityType, Map<string, CampaignEntity>> = new Map();

    constructor(plugin: CampaignNotesPlugin) {
        this.plugin = plugin;
        this.tagPrefixes = Array.from(
            new Set([
                ...plugin.settings.campaignScopes,
                ...plugin.settings.keepTagPrefix,
                ...generalTagPrefixes,
            ]),
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // biome-ignore lint/suspicious/noExplicitAny: we're debugging; yes. any.
    logDebug(message: string, ...optionalParams: any[]): void {
        if (!this.plugin.settings || this.plugin.settings.debug) {
            console.debug(`(CN) ${message}`, ...optionalParams);
        }
    }

    clearIndex(): void {
        // Clear existing indexes
        this.uniqueIndex.clear();
        this.entities.clear();
        this.filePathToEntities.clear();
        this.typeToEntities.clear();
        this.tagToEntities.clear();
        this.generatedIndex.clear();
    }

    /**
     * Rebuild the entire index from scratch
     */
    async rebuildIndex(): Promise<void> {
        console.log("Rebuilding campaign notes index");
        this.clearIndex();

        // Get all markdown files in the included folders
        const files = this.getFilesInIncludedFolders();
        console.log(`Found ${files.length} files to index`);

        // Process each file
        for (const file of files) {
            await this.processFile(file);
        }

        console.log(`Indexed ${this.uniqueIndex.size} entities`, this);
    }

    /**
     * Get all entities in a specific file
     */
    getEntitiesByFile(filePath: string): CampaignEntity[] {
        const entities = this.filePathToEntities.get(filePath);
        return entities ? Array.from(entities.values()) : [];
    }

    /**
     * Get an entity by ID
     * This could be a url target or a tag
     */
    getEntityById(id: string): CampaignEntity | undefined {
        return this.entities.get(id);
    }

    /**
     * Get entities within a specific scope
     */
    getEntities(scopePattern: string): CampaignEntity[] {
        const scopeRegex = scopeToRegex(scopePattern);
        const result = Array.from(this.uniqueIndex.values()).filter((v) =>
            scopeRegex.test(v.scope),
        );
        return result;
    }

    /**
     * Get entities with a specific tag
     */
    getEntitiesByTag(tag: string, scopePattern: string): CampaignEntity[] {
        const entities = this.tagToEntities.get(tag);
        const values = entities ? Array.from(entities.values()) : [];
        if (scopePattern) {
            // Filter by scope if provided
            const scopeRegex = scopeToRegex(scopePattern);
            return values.filter((v) => scopeRegex.test(v.scope));
        }
        return values;
    }

    /**
     * Get entities of a specific type
     */
    getEntitiesByType<T extends CampaignEntity>(
        type: EntityType,
        scopePattern?: string,
    ): T[] {
        const entitiesOfType = this.typeToEntities.get(type);
        const values = entitiesOfType
            ? Array.from(entitiesOfType.values())
            : [];
        if (scopePattern) {
            // Filter by scope if provided
            const scopeRegex = scopeToRegex(scopePattern);
            return values.filter((v) => scopeRegex.test(v.scope)) as T[];
        }
        return values as T[];
    }

    /**
     * Get all markdown files in folders specified in settings
     */
    getFilesInIncludedFolders(): TFile[] {
        const { includeFolders } = this.plugin.settings;

        return this.plugin.app.vault
            .getMarkdownFiles()
            .filter((file) =>
                includeFolders.some((folder) => file.path.startsWith(folder)),
            );
    }

    /**
     * Get title of a file (without extension)
     */
    getFileTitle(file: TFile): string {
        const cache = this.plugin.app.metadataCache.getFileCache(file);
        const aliases = cache?.frontmatter?.aliases;
        const alias = aliases ? aliases[0] : file.basename;
        if (typeof alias === "string") {
            return alias;
        }
        return file.basename;
    }

    getScopes(): string[] {
        return this.plugin.settings.campaignScopes;
    }

    getEntityType(typeString: string): EntityType | undefined {
        if (validEntityTypes.has(typeString.toLowerCase())) {
            return typeString.toLowerCase() as EntityType;
        }
        return undefined;
    }

    /**
     * Determine all entity types for a file based on frontmatter and/or tags
     */
    getTypesForFile(
        frontmatter: FrontMatterCache | undefined,
        tags: string[],
    ): string[] {
        if (this.skipFileFrontmatter(frontmatter)) {
            return []; // Skip files marked as not indexable
        }

        const types: Set<string> = new Set();
        if (frontmatter?.area) {
            types.add("area");
        }
        if (frontmatter?.encounter) {
            types.add("encounter");
        }
        if (frontmatter?.group) {
            types.add("group");
        }
        if (frontmatter?.item) {
            types.add("item");
        }
        if (frontmatter?.place) {
            types.add("place");
        }
        if (frontmatter?.npc) {
            types.add("npc");
        }
        if (frontmatter?.pc) {
            types.add("pc");
        }

        for (const tag of tags) {
            // Check if the tag starts with the type prefix
            if (tag.startsWith(typeTagPrefix)) {
                const potentialType = tag.substring(typeTagPrefix.length);
                const entityType = potentialType.split("/")[0];
                if (validEntityTypes.has(entityType)) {
                    types.add(entityType);
                }
            }
        }

        return Array.from(types);
    }

    /**
     * Handle file created event
     */
    handleFileCreated(file: TAbstractFile): void {
        if (!(file instanceof TFile) || file.extension !== "md") {
            return;
        }
        // Check if file is in an included folder
        if (this.isFileInIncludedFolders(file)) {
            this.processFile(file);
        }
    }

    /**
     * Handle file deleted event
     */
    handleFileDeleted(file: TAbstractFile): void {
        if (!(file instanceof TFile) || file.extension !== "md") {
            return;
        }
        this.logDebug("File deleted", file);
        // Remove any entities for this file
        this.removeEntitiesForFile(file);
    }

    /**
     * Handle file modified event
     */
    handleFileModified(file: TAbstractFile): Promise<void> {
        if (!(file instanceof TFile) || file.extension !== "md") {
            return;
        }
        this.logDebug("File modified", file);
        // Remove any existing entities for this file
        this.removeEntitiesForFile(file);

        // Check if file is in an included folder
        if (this.isFileInIncludedFolders(file)) {
            // Re-process the file
            this.processFile(file);
        }
    }

    /**
     * Handle file renamed event
     */
    handleFileRenamed(file: TAbstractFile, oldPath: string): void {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        // Remove entities for old path
        this.removeEntitiesForFile(file, oldPath);

        // Check if the new location is in an included folder
        if (this.isFileInIncludedFolders(file)) {
            // Process the file with its new path
            this.processFile(file);
        }
    }

    /**
     * Check if a file is in one of the included folders
     */
    isFileInIncludedFolders(file: TFile): boolean {
        const { includeFolders } = this.plugin.settings;
        return includeFolders.some(
            (folder) =>
                file.path === folder || file.path.startsWith(`${folder}/`),
        );
    }

    /**
     * Process areas in a file
     */
    private processAreas(
        file: TFile,
        frontmatter: FrontMatterCache | undefined,
        tags: string[],
    ): void {
        this.processEntityFrontmatter<Place>(
            file,
            EntityType.AREA,
            frontmatter,
            tags,
            (entity, _fm) => {
                this.findSubType(entity, "type/area/");
                this.findIdTag(entity, "area/");
                if (!entity.idTag) {
                    this.findIdTag(entity, "place/");
                }
                if (!entity.idTag) {
                    this.findIdTag(entity, "region/");
                }
            },
        );
    }

    /**
     * Process encounters in a file
     */
    private processEncounters(
        file: TFile,
        frontmatter: FrontMatterCache | undefined,
        tags: string[],
    ): void {
        // Single encounter per note
        // Always scoped
        // Properties directly in frontmatter or file name
        // Extract encounter-specific data
        const encounterFM = frontmatter?.encounter;
        if (!encounterFM) {
            return;
        }
        const encounter = this.createBasicEntity(
            file,
            EntityType.ENCOUNTER,
            tags,
        ) as Partial<Encounter>;
        if (!encounter.scope) {
            this.logDebug("Encounter outside of scope", file, encounterFM);
            return;
        }
        encounter.status = encounterFM;

        const levelMatch = file.name.match(/^(\d+)-/);
        if (levelMatch) {
            encounter.level = Number(levelMatch[1]);
        }
        this.addEntityToIndexes(encounter as Encounter);
    }

    /**
     * Process a single file and add its entities to the index
     */
    private async processFile(file: TFile): Promise<void> {
        const metadata = this.plugin.app.metadataCache.getFileCache(file);
        if (!metadata) {
            return;
        }

        const frontmatter = metadata.frontmatter;
        if (frontmatter?.index === "generated") {
            this.generatedIndex.set(file.path, file);
            return; // Skip files marked as generated
        }
        if (this.skipFile(file)) {
            return; // Skip files marked as not indexable
        }

        const tags = (getAllTags(metadata) || []).map((tag) =>
            tag.startsWith("#") ? tag.substring(1) : tag,
        );

        // Extract types from frontmatter and/or tags
        const types = this.getTypesForFile(frontmatter, tags);
        if (types.length === 0) {
            return; // Skip files with no recognized types
        }

        // Process each type
        for (const type of types) {
            // Handle special case processing for different types of entities
            switch (type) {
                case "area":
                    this.processAreas(file, frontmatter, tags);
                    break;
                case "encounter":
                    this.processEncounters(file, frontmatter, tags);
                    break;
                case "group":
                    this.processGroups(file, frontmatter, tags);
                    break;
                case "place":
                    this.processPlaces(file, frontmatter, tags);
                    break;
                case "item":
                    this.processItems(file, frontmatter, tags);
                    break;
                case "npc":
                    this.processNPCs(file, frontmatter, tags);
                    break;
                case "pc":
                    this.processPCs(file, frontmatter, tags);
                    break;
                default:
                    // For any other types, just create a basic entity
                    this.createBasicEntity(file, EntityType.UNKNOWN, tags);
            }
        }
    }

    /**
     * Process groups in a file
     */
    private processGroups(
        file: TFile,
        frontmatter: FrontMatterCache | undefined,
        tags: string[],
    ): void {
        this.processEntityFrontmatter<Group>(
            file,
            EntityType.GROUP,
            frontmatter,
            tags,
            (entity, fm) => {
                this.findIdTag(entity, "group/");
                this.findSubType(entity, "type/group/");

                // there are some shortcuts to avoid complicated structures
                // for data entry on scoped groups.

                // biome-ignore lint/complexity/useLiteralKeys: convenience, untyped
                const entityStatus = entity["status"];
                this.deleteAttribute(entity, "status");

                // biome-ignore lint/complexity/useLiteralKeys: convenience, untyped
                const entityRenown = entity["renown"];
                this.deleteAttribute(entity, "renown");

                // Values in the frontmatter apply to all scopes
                const scope = entity.scope || "*";
                entity.state[scope] = entity.state[scope] || {};

                entity.state[scope].status =
                    entity.state[scope].status || entityStatus || fm?.status;
                entity.state[scope].renown =
                    entity.state[scope].renown || entityRenown || fm?.renown;

                // look for tags (these are aggregated for entity and frontmatter)
                // the tags include the scope and type: heist/renown/6, witchlight/renown/2
                for (const tag of entity.tags) {
                    const scopeRenown = tag.match(/([^/]+)\/renown\/(\d+)/);
                    if (scopeRenown) {
                        const state = this.setAttributeIfMissing(
                            entity.state,
                            scopeRenown[1],
                            {},
                        );
                        state.renown = state.renown || Number(scopeRenown[2]);
                    }
                    const scopeStatus = tag.match(/([^/]+)\/group\/(.*)/);
                    if (scopeStatus) {
                        const state = this.setAttributeIfMissing(
                            entity.state,
                            scopeStatus[1],
                            {},
                        );
                        state.status =
                            state.status || (scopeStatus[2] as GroupStatus);
                    }
                }
            },
        );
    }

    /**
     * Process items in a file
     */
    private processItems(
        file: TFile,
        frontmatter: FrontMatterCache | undefined,
        tags: string[],
    ): void {
        this.processEntityFrontmatter<Item>(
            file,
            EntityType.ITEM,
            frontmatter,
            tags,
            (_e, _fm) => {},
        );
    }

    private processNPCs(
        file: TFile,
        frontmatter: FrontMatterCache | undefined,
        tags: string[],
    ): void {
        this.processEntityFrontmatter<NPC>(
            file,
            EntityType.NPC,
            frontmatter,
            tags,
            (entity, fm) => {
                const scope = entity.scope || "*";
                entity.state[scope] = entity.state[scope] || {};

                // there are some shortcuts to avoid complicated structures
                // for data entry on scoped npcs.

                // biome-ignore lint/complexity/useLiteralKeys: not typed / partial
                const entityStatus = entity["status"];
                this.deleteAttribute(entity, "status");

                // biome-ignore lint/complexity/useLiteralKeys: not typed / partial
                const entityIff = entity["iff"];
                this.deleteAttribute(entity, "iff");

                entity.state[scope].iff =
                    entity.state[scope].iff || entityIff || fm?.iff;
                entity.state[scope].status =
                    entity.state[scope].status || entityStatus || fm?.status;

                // look for tags (these are aggregated for entity and frontmatter)
                // the tags include the scope and type: heist/iff/ally, witchlight/npc/dead
                for (const tag of entity.tags) {
                    const scopeStatus = tag.match(/([^/]+)\/npc\/(.*)/);
                    if (scopeStatus) {
                        const state = this.setAttributeIfMissing(
                            entity.state,
                            scopeStatus[1],
                            {},
                        );
                        state.status =
                            state.status || (scopeStatus[2] as NPCStatus);
                    }
                    const iffStatus = tag.match(/([^/]+)\/iff\/(.*)/);
                    if (iffStatus) {
                        const state = this.setAttributeIfMissing(
                            entity.state,
                            iffStatus[1],
                            {},
                        );
                        state.iff = state.iff || (iffStatus[2] as NPC_IFF);
                    }
                }
            },
        );
    }

    private processPCs(
        file: TFile,
        frontmatter: FrontMatterCache | undefined,
        tags: string[],
    ): void {
        this.processEntityFrontmatter<PC>(
            file,
            EntityType.PC,
            frontmatter,
            tags,
            (_e, _fm) => {},
        );
    }

    /**
     * Process locations in a file
     */
    private processPlaces(
        file: TFile,
        frontmatter: FrontMatterCache | undefined,
        tags: string[],
    ): void {
        this.processEntityFrontmatter<Place>(
            file,
            EntityType.PLACE,
            frontmatter,
            tags,
            (entity, _fm) => {
                this.findSubType(entity, "type/place/");
                this.findIdTag(entity, "place/");
                entity.area = entity.tags.find((t) => t.startsWith("area/"));
                if (!entity.area) {
                    entity.area = entity.tags.find((t) =>
                        t.startsWith("region/"),
                    );
                }
            },
        );
    }

    /**
     * Create a basic entity with common properties
     */
    private createBasicEntity(
        file: TFile,
        type: EntityType,
        tags: string[],
    ): CampaignEntity {
        const path = file.path;
        const entity: CampaignEntity = {
            id: markdownLinkPath(file.path),
            name: this.getFileTitle(file),
            filePath: file.path,
            type,
            tags,
        };
        entity.scope = path.split("/")[0];
        entity.state = entity.state || {};
        return entity;
    }

    private copyEntity<T extends CampaignEntity>(
        entity: Partial<T>,
    ): Partial<T> {
        return JSON.parse(JSON.stringify(entity)) as Partial<T>;
    }

    private finalizeEntity<T extends CampaignEntity>(
        entity: Partial<T>,
        frontmatter: FrontMatterCache | undefined,
        resolveProps?: (
            entity: Partial<T>,
            frontmatter: FrontMatterCache | undefined,
        ) => void,
    ): void {
        if (resolveProps) {
            resolveProps(entity, frontmatter);
        }

        const scope = entity.scope || "*";
        const _entityState = this.setAttribute(
            entity.state,
            scope,
            entity.state[scope] || {},
        );

        // biome-ignore lint/complexity/useLiteralKeys: partial/untyped
        const entityNotes = entity["notes"];
        this.deleteAttribute(entity, "notes");

        entity.state[scope].notes =
            entity.state[entity.scope].notes ||
            entityNotes ||
            frontmatter?.notes;

        // biome-ignore lint/complexity/useLiteralKeys: partial/untyped
        const remove: string[] = entity["remove"];
        this.deleteAttribute(entity, "remove");

        entity.tags = (entity.tags || []).filter(
            (tag) => !tag.startsWith(typeTagPrefix) && !remove?.includes(tag),
        );
    }

    private findIdTag(entity: Partial<CampaignEntity>, tagRoot: string): void {
        if (entity.idTag) {
            return; // already set
        }
        const tagName = lowerKebab(entity.name);
        entity.idTag = (entity.tags || []).find(
            (tag) => tag.startsWith(tagRoot) && tag.endsWith(tagName),
        );
    }

    private findSubType(
        entity: Partial<CampaignEntity>,
        tagRoot: string,
    ): void {
        const typeTags = entity.tags.filter((tag) => tag.startsWith(tagRoot));
        if (!entity.subtype) {
            if (typeTags.length === 0) {
                console.warn(
                    "No type tag found for",
                    tagRoot,
                    entity.name,
                    entity.tags,
                );
                return;
            }
            const typeTag = typeTags[0];
            entity.subtype = typeTag.substring(typeTag.lastIndexOf("/") + 1);
            if (typeTags.length > 1) {
                console.warn(
                    "Multiple type tags found for",
                    entity.name,
                    typeTags,
                    "using",
                    entity.subtype,
                );
            }
        }

        const end = `/${entity.subtype}`;
        for (const tag of typeTags) {
            if (!tag.endsWith(end)) {
                const i = entity.tags.indexOf(tag);
                entity.tags.splice(i, 1);
                this.logDebug("removed tag", tag, "from", entity.name);
            }
        }
    }

    private processEntityFrontmatter<T extends CampaignEntity>(
        file: TFile,
        type: EntityType,
        frontmatter: FrontMatterCache | undefined,
        tags: string[],
        resolveProps?: (
            entity: Partial<T>,
            frontmatter: FrontMatterCache | undefined,
        ) => void,
    ): void {
        // Create the base entity
        const init = this.createBasicEntity(file, type, tags) as Partial<T>;
        init.scope = frontmatter?.scope || init.scope;
        init.icon = frontmatter?.icon;

        if (frontmatter?.state) {
            init.state = { ...init.state, ...frontmatter.state };
        }

        // Check for the field in frontmatter
        const fieldValue = frontmatter?.[type.toLowerCase()];
        if (!fieldValue) {
            // No frontmatter value, just use file as single entity
            init.scopeStatePrefix = "state";
            init.idTag = frontmatter?.idTag;
            this.finalizeEntity(init, frontmatter, resolveProps);
            this.addEntityToIndexes(init as T);
            return;
        }

        const pageTitle = init.name;
        if (Array.isArray(fieldValue)) {
            let i = 0;
            for (const fm of fieldValue) {
                // Create a fresh copy of the entity for the array item
                const entity = this.copyEntity(init);
                entity.scopeStatePrefix = `${type}[${i++}].state`;
                this.processEntityValue<T>(
                    entity,
                    fm,
                    pageTitle,
                    frontmatter,
                    resolveProps,
                );
                this.addEntityToIndexes(entity as T);
            }
        } else {
            init.scopeStatePrefix = `${type}.state`;
            this.processEntityValue<T>(
                init,
                fieldValue,
                pageTitle,
                frontmatter,
                resolveProps,
            );
            this.addEntityToIndexes(init as T);
        }
    }

    /**
     * Process a frontmatter value that could be a string or object and update the entity
     * @param entity The base entity to update
     * @param value The frontmatter value (string or object)
     * @param file The source file
     * @param pageTitle The page title for comparison when generating IDs
     * @returns The updated entity with proper ID
     */
    private processEntityValue<T extends CampaignEntity>(
        entity: Partial<T>,
        value: string | Partial<T>,
        pageTitle: string,
        frontmatter: FrontMatterCache | undefined,
        resolveProps?: (
            entity: Partial<T>,
            frontmatter: FrontMatterCache | undefined,
        ) => void,
    ): void {
        // Handle either string or object values
        if (value && typeof value === "object") {
            // Merge properties from the value object
            // Combine tags from the parent and the value
            const tags = [...(entity.tags || []), ...(value.tags || [])];
            Object.assign(entity, value);
            entity.tags = Array.from(new Set(tags)); // Remove duplicates
        } else if (value && typeof value === "string") {
            // Just update the name if it's a string
            entity.name = value;
        }

        const scope = entity.scope || "*";
        const state = this.setAttribute(
            entity.state,
            scope,
            entity.state[scope] || {},
        );

        // biome-ignore lint/complexity/useLiteralKeys: partial/untyped
        const notes = entity["notes"];
        this.deleteAttribute(entity, "notes");

        state.notes = state.notes || notes || frontmatter?.notes;

        if (entity.anchor) {
            entity.id = markdownLinkPath(entity.filePath, entity.anchor);
        } else {
            // Update the ID based on name and page title
            const anchorText = entity.name === pageTitle ? "" : entity.name;
            entity.id = markdownLinkPath(entity.filePath, anchorText);
        }
        this.finalizeEntity(entity, frontmatter, resolveProps);
    }

    /**
     * Add an entity to all the appropriate indexes
     */
    private addEntityToIndexes(entity: CampaignEntity): void {
        this.logDebug("Add entity", entity.type, entity.id, entity);

        // Add to suggestions for fuzzy search and general retrieval
        this.uniqueIndex.set(entity.id, entity);

        // Add to main entity index for lookup by id
        this.entities.set(entity.id, entity);
        if (entity.idTag) {
            // this is an alternate identifier for the entity
            this.entities.set(entity.idTag, entity);
        }

        // Add to file path index
        addToMappedMap(
            this.filePathToEntities,
            entity.filePath,
            entity.id,
            entity,
        );
        addToMappedMap(this.typeToEntities, entity.type, entity.id, entity);

        // Add to tag indexes
        for (const tag of entity.tags) {
            if (this.tagPrefixes.find((prefix) => tag.startsWith(prefix))) {
                addToMappedMap(this.tagToEntities, tag, entity.id, entity);
            }
        }
    }

    /**
     * Remove all entities associated with a file
     */
    private removeEntitiesForFile(file: TFile, oldPath = ""): void {
        const path = oldPath || file.path;

        const entitiesMap = this.filePathToEntities.get(path);
        if (entitiesMap) {
            // Convert Map values to array for iteration
            const entities = Array.from(entitiesMap.values());

            for (const entity of entities) {
                if (entity.id) {
                    this.removeEntityFromIndexes(entity.id);
                } else {
                    console.warn(
                        `Found invalid entity for file ${path}`,
                        entity,
                    );
                }
            }

            // Also delete the file entry from the map
            this.filePathToEntities.delete(path);
        }
        this.generatedIndex.delete(file.path);
    }

    /**
     * Remove an entity from all indexes
     */
    private removeEntityFromIndexes(entityId: string): void {
        const entity = this.entities.get(entityId);
        if (!entity) {
            console.warn(
                `Entity with ID ${entityId} not found in index`,
                this.entities,
            );
            return;
        }
        this.logDebug("Remove entity from index", entity.type, entityId);

        // Remove from main index
        this.uniqueIndex.delete(entityId);
        this.entities.delete(entityId);
        if (entity.idTag) {
            this.entities.delete(entity.idTag);
        }

        // Remove from file path index
        const filePath = entity.filePath;
        const fileEntities = this.filePathToEntities.get(filePath);
        if (fileEntities) {
            fileEntities.delete(entity.id);
            if (fileEntities.size === 0) {
                this.filePathToEntities.delete(filePath);
            }
        }

        // Remove from type index
        const type = entity.type;
        const typeEntities = this.typeToEntities.get(type);
        if (typeEntities) {
            typeEntities.delete(entity.id);
            if (typeEntities.size === 0) {
                this.typeToEntities.delete(type);
            }
        }

        // Remove from tag indexes
        for (const tag of entity.tags) {
            const tagEntities = this.tagToEntities.get(tag);
            if (tagEntities) {
                tagEntities.delete(entity.id);
                if (tagEntities.size === 0) {
                    this.tagToEntities.delete(tag);
                }
            }
        }
    }

    fileIncluded(path: string): boolean {
        return this.plugin.settings.includeFolders.some((folder) =>
            path.startsWith(folder),
        );
    }

    fileExcluded(path: string): boolean {
        return !this.fileIncluded(path);
    }

    skipFile(file: TFile): boolean {
        const cache = this.plugin.app.metadataCache.getFileCache(file);
        return this.skipFileFrontmatter(cache?.frontmatter);
    }

    skipFileFrontmatter(frontmatter: FrontMatterCache | undefined): boolean {
        return (
            frontmatter?.index === false || frontmatter?.index === "generated"
        );
    }

    private setAttributeIfMissing<T>(
        obj: Record<string, T>,
        key: string,
        value: T,
    ): T {
        obj[key] = obj[key] || value;
        return obj[key];
    }

    private setAttribute<T>(obj: Record<string, T>, key: string, value: T): T {
        obj[key] = value;
        return value;
    }

    private deleteAttribute(obj: Record<string, unknown>, key: string): void {
        if (obj && key in obj) {
            delete obj[key];
        }
    }

    // --------------------------------

    /**
     * Get all areas
     */
    getAllAreas(scope = ""): Area[] {
        return this.getEntitiesByType(EntityType.AREA, scope);
    }

    /**
     * Get all encounters
     */
    getAllEncounters(scope = ""): Encounter[] {
        return this.getEntitiesByType(EntityType.ENCOUNTER, scope);
    }

    /**
     * Get all groups
     */
    getAllGroups(scope = ""): Group[] {
        return this.getEntitiesByType(EntityType.GROUP, scope);
    }

    /**
     * Get all items
     */
    getAllItems(scope = ""): Item[] {
        return this.getEntitiesByType(EntityType.ITEM, scope);
    }

    /**
     * Get all NPCs
     */
    getAllNPCs(scopePattern?: string): NPC[] {
        return this.getEntitiesByType(EntityType.NPC, scopePattern);
    }

    /**
     * Get all locations
     */
    getAllPlaces(scope = ""): Place[] {
        return this.getEntitiesByType(EntityType.PLACE, scope);
    }

    getGeneratedIndexFiles(): TFile[] {
        return [...this.generatedIndex.values()];
    }
}

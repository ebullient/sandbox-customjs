import {
    type FrontMatterCache,
    type LinkCache,
    Reference,
    type TAbstractFile,
    TFile,
    getAllTags,
} from "obsidian";
import {
    type CampaignEntity,
    type CampaignState,
    type CleanLink,
    type Encounter,
    EntityType,
    type Group,
    type Item,
    type NPC,
    NPCStatus,
    NPC_IFF,
    type PC,
    type Place,
} from "./@types";
import type { CampaignNotesSettings } from "./@types/settings";
import type CampaignNotesPlugin from "./main";

const generalTagPrefixes = ["group", "item", "place", "region", "type"];

export const DEFAULT_SETTINGS: CampaignNotesSettings = {
    includeFolders: ["campaign-notes"],
    keepTagPrefix: [],
    campaignScopes: [],
    debug: false,
};

const validEntityTypes: Set<string> = new Set(Object.values(EntityType));
const typeTagPrefix = "type/";

export class CampaignNotesIndex {
    plugin: CampaignNotesPlugin;
    tagPrefixes: string[];

    // Main indexes
    entities: Map<string, CampaignEntity> = new Map();

    // Secondary indexes for quick lookup
    backlinksIndex: Map<string, TFile[]> = new Map();
    indexes: Map<string, TFile> = new Map();

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
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    logDebug(message: string, ...optionalParams: any[]): void {
        if (!this.plugin.settings || this.plugin.settings.debug) {
            console.debug(`(CN) ${message}`, ...optionalParams);
        }
    }

    /**
     * Rebuild the entire index from scratch
     */
    async rebuildIndex(): Promise<void> {
        console.log("Rebuilding campaign notes index");

        // Clear existing indexes
        this.entities.clear();
        this.filePathToEntities.clear();
        this.typeToEntities.clear();
        this.tagToEntities.clear();
        this.backlinksIndex.clear();
        this.indexes.clear();

        // Get all markdown files in the included folders
        const files = this.getFilesInIncludedFolders();
        console.log(`Found ${files.length} files to index`);

        // Process each file
        for (const file of files) {
            await this.processFile(file);
        }

        console.log(`Indexed ${this.entities.size} entities`, this);
    }

    getBacklinks(filePath: string, scopePattern: string): TFile[] {
        const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) {
            return [];
        }
        const files =
            this.backlinksIndex.get(filePath) || this.findBacklinks(file);
        if (scopePattern) {
            // Filter by scope if provided
            const pathRegex = this.segmentFilterRegex(scopePattern);
            return files.filter((f) => pathRegex.test(f.path));
        }
        return files;
    }

    getLinks<T extends CampaignEntity>(entity: T): CleanLink[] {
        const cache = this.plugin.app.metadataCache.getFileCache(entity.file);
        if (!cache) {
            return []; // Skip files without metadata
        }
        const linkRefs = [];
        linkRefs.push(...(cache.links || []));
        linkRefs.push(...(cache.embeds || []));

        return Array.from(
            new Set(
                linkRefs
                    .filter((ref) => !ref.link.startsWith("#"))
                    .map((linkRef) => this.cleanLinkTarget(linkRef)),
            ),
        );
    }

    /**
     * Get entities of a specific type
     */
    getEntitiesByType<T extends CampaignEntity>(
        type: EntityType,
        scopePattern?: string,
    ): T[] {
        const entities = this.typeToEntities.get(type);
        const values = entities ? Array.from(entities.values()) : [];
        if (scopePattern) {
            // Filter by scope if provided
            const scopeRegex = this.scopeRegex(scopePattern);
            return values.filter((v) => scopeRegex.test(v.scope)) as T[];
        }
        return values as T[];
    }

    /**
     * Get entities with a specific tag
     */
    getEntitiesByTag(tag: string, scopePattern: string): CampaignEntity[] {
        const entities = this.tagToEntities.get(tag);
        const values = entities ? Array.from(entities.values()) : [];
        if (scopePattern) {
            // Filter by scope if provided
            const scopeRegex = this.scopeRegex(scopePattern);
            return values.filter((v) => scopeRegex.test(v.scope));
        }
        return values;
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
     */
    getEntityById(id: string): CampaignEntity | undefined {
        return this.entities.get(id);
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
     * Converts a name to lower kebab case.
     * @param {string} name The name to convert.
     * @returns {string} The name converted to lower kebab case.
     */
    lowerKebab = (name: string): string => {
        return (name || "")
            .replace(/([a-z])([A-Z])/g, "$1-$2") // separate on camelCase
            .replace(/[\s_]+/g, "-") // replace all spaces and low dash
            .replace(/[^0-9a-zA-Z_-]/g, "") // strip other things
            .toLowerCase(); // convert to lower case
    };

    /**
     * Cleans a link target by removing the title and extracting the anchor.
     * @param {LinkCache} linkRef The link reference to clean.
     * @returns {CleanLink} The cleaned link object.
     */
    cleanLinkTarget = (linkRef: LinkCache): CleanLink => {
        let link = linkRef.link;

        // remove/drop title: vaultPath#anchor "title" -> vaultPath#anchor
        const titlePos = link.indexOf(' "');
        if (titlePos >= 0) {
            link = link.substring(0, titlePos);
        }

        // the entityRef will still contain %20 and the anchor.
        // see markdownLinkPath
        const entityRef = link.replace(/ /g, "%20").trim();

        // extract anchor and decode spaces: vaultPath#anchor -> anchor and vaultPath
        const anchorPos = link.indexOf("#");
        const anchor =
            anchorPos < 0
                ? ""
                : link
                      .substring(anchorPos + 1)
                      .replace(/%20/g, " ")
                      .trim();

        link = (anchorPos < 0 ? link : link.substring(0, anchorPos))
            .replace(/%20/g, " ")
            .trim();

        return {
            entityRef,
            text: linkRef.displayText,
            anchor,
            link,
        };
    };

    /**
     * Converts a TFile to a markdown link path.
     * @param {TFile} tfile The TFile to convert.
     * @param {string} [anchor=""] The anchor to append to the path.
     * @returns {string} The markdown link path.
     */
    markdownLinkPath = (tfile: TFile, anchor = ""): string => {
        const hashAnchor = anchor ? `#${anchor}` : "";
        return (tfile.path + hashAnchor).replace(/ /g, "%20");
    };

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

    scopeRegex = (str: string): RegExp => {
        return new RegExp(`^${str}$`, "i");
    };

    segmentFilterRegex = (str: string): RegExp => {
        return new RegExp(`^${str}(\\/|$)`);
    };

    skipFile(file: TFile): boolean {
        const cache = this.plugin.app.metadataCache.getFileCache(file);
        return this.skipFileFrontmatter(cache?.frontmatter);
    }

    skipFileFrontmatter(frontmatter: FrontMatterCache | undefined): boolean {
        return (
            frontmatter?.index === false || frontmatter?.index === "generated"
        );
    }

    /**
     * Extract a single tag value
     * Example: extractTagValue(['#place/waterdeep', '#group/harpers'], 'place/') => 'waterdeep'
     */
    extractTagValue(tags: string[], prefix: string): string {
        for (const tag of tags) {
            if (tag.startsWith(prefix)) {
                return tag.substring(prefix.length);
            }
        }
        return "";
    }

    /**
     * Extract multiple tag values
     * Example: extractArrayTagValues(['#group/harpers', '#group/lords-alliance'], 'group/')
     *          => ['harpers', 'lords-alliance']
     */
    extractArrayTagValues(tags: string[], prefix: string): string[] {
        const values: string[] = [];

        for (const tag of tags) {
            if (tag.startsWith(prefix)) {
                values.push(tag.substring(prefix.length));
            }
        }

        return values;
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
        if (frontmatter?.index === 'generated') {
            this.indexes.set(file.path, file);
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

                if (fm?.status) {
                    entity.state["*"].status =
                        entity.state["*"].status || fm.status;
                }

                // biome-ignore lint/complexity/useLiteralKeys: convenience, untyped
                const entityStatus = entity["status"];

                if (entity.scope && entityStatus) {
                    entity.state[entity.scope] =
                        entity.state[entity.scope] || {};
                    const value =
                        entity.state[entity.scope].status || entityStatus;
                    if (value) {
                        entity.state[entity.scope].status = value;
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
                    entity.area = entity.tags.find((t) => t.startsWith("region/"));
                }
            },
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
            (entity, _fm) => {
                const scope = entity.scope || "*";

                // there are some shortcuts to avoid complicated structures
                // for data entry on scoped npcs.

                entity.state[scope] = entity.state[scope] || {};

                // biome-ignore lint/complexity/useLiteralKeys: not typed / partial
                const entityStatus = entity["status"];
                // biome-ignore lint/complexity/useLiteralKeys: not typed / partial
                const entityIff = entity["iff"];

                if (entityIff) {
                    entity.state[scope].iff =
                        entity.state[scope].iff || entityIff;
                }
                if (entityStatus) {
                    entity.state[scope].status =
                        entity.state[scope].status || entityStatus;
                }

                // look for tags (these are aggregated for entity and frontmatter)
                // the tags include the scope and type: heist/iff/ally, witchlight/npc/dead
                for (const tag of entity.tags) {
                    const scopeStatus = tag.match(/([^/]+)\/npc\/(.*)/);
                    if (scopeStatus) {
                        entity.state[scopeStatus[1]] =
                            entity.state[scopeStatus[1]] || {};
                        const state = entity.state[scopeStatus[1]];
                        state.status =
                            state.status || (scopeStatus[2] as NPCStatus);
                    }
                    const iffStatus = tag.match(/([^/]+)\/iff\/(.*)/);
                    if (iffStatus) {
                        entity.state[iffStatus[1]] =
                            entity.state[iffStatus[1]] || {};
                        const state = entity.state[iffStatus[1]];
                        state.iff = state.iff || (iffStatus[2] as NPC_IFF);
                    }
                }

                // set the default if otherwise missing
                entity.state[scope].status =
                    entity.state[scope].status || NPCStatus.ALIVE;
                entity.state[scope].iff =
                    entity.state[scope].iff || NPC_IFF.UNKNOWN;
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
     * Create a basic entity with common properties
     */
    private createBasicEntity(
        file: TFile,
        type: EntityType,
        tags: string[],
    ): CampaignEntity {
        const path = file.path;
        const entity: CampaignEntity = {
            file,
            id: this.markdownLinkPath(file),
            name: this.getFileTitle(file),
            type,
            tags,
        };
        const scope = path.split("/")[0];
        if (this.plugin.settings.campaignScopes.includes(scope)) {
            entity.scope = scope;
        }
        entity.state = entity.state || {};
        entity.state['*'] = entity.state['*'] || {};
        return entity;
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

    private findIdTag(entity: Partial<CampaignEntity>, tagRoot: string): void {
        if (entity.idTag) {
            return; // already set
        }
        const tagName = this.lowerKebab(entity.name);
        entity.idTag = (entity.tags || []).find(
            (tag) => tag.startsWith(tagRoot) && tag.endsWith(tagName),
        );
    }

    // Method to find backlinks for a file
    private findBacklinks(targetFile: TFile): TFile[] {
        const backlinks: TFile[] = [];
        const allFiles = this.plugin.app.vault.getMarkdownFiles();

        for (const tfile of allFiles) {
            const fileCache = this.plugin.app.metadataCache.getFileCache(tfile);

            if (
                tfile.path === targetFile.path ||
                this.skipFile(tfile) ||
                (!fileCache?.links && !fileCache?.embeds)
            ) {
                continue; // Skip the same file, and files w/o links or embeds
            }

            const links = [];
            links.push(...(fileCache.links || []));
            links.push(...(fileCache.embeds || []));

            for (const link of links) {
                if (link.link.match(/^(http|mailto|view-source)/)) {
                    continue; // Skip external links
                }
                const cleanedLink = this.cleanLinkTarget(link);
                const linkTarget =
                    this.plugin.app.metadataCache.getFirstLinkpathDest(
                        cleanedLink.link,
                        tfile.path,
                    );
                if (targetFile.path === linkTarget?.path) {
                    backlinks.push(tfile);
                    break; // No need to check other links in this file
                }
            }
        }

        this.backlinksIndex.set(targetFile.path, backlinks);
        return backlinks;
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
        init.icon = frontmatter?.icon;

        // Check for the field in frontmatter
        const fieldValue = frontmatter?.[type.toLowerCase()];
        if (!fieldValue) {
            // No frontmatter value, just use file as single entity
            this.finalizeEntity(init, frontmatter, resolveProps);
            this.addEntityToIndexes(init as T);
            return;
        }

        const pageTitle = init.name;
        if (Array.isArray(fieldValue)) {
            for (const fm of fieldValue) {
                // Create a fresh copy of the entity for the array item
                const entity = this.copyEntity(init);
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

    private copyEntity<T extends CampaignEntity>(
        entity: Partial<T>,
    ): Partial<T> {
        const fileRef = entity.file;
        entity.file = undefined;
        const copy = JSON.parse(JSON.stringify(entity)) as Partial<T>;
        entity.file = fileRef;
        copy.file = fileRef;
        return copy;
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
        if (typeof value === "object") {
            // Merge properties from the value object
            // Combine tags from the parent and the value
            const tags = [...(entity.tags || []), ...(value.tags || [])];
            Object.assign(entity, value);
            entity.tags = Array.from(new Set(tags)); // Remove duplicates
        } else {
            // Just update the name if it's a string
            entity.name = value;
        }

        // biome-ignore lint/complexity/useLiteralKeys: partial/untyped
        const notes = entity["notes"];
        if (notes) {
            const scope = entity.scope || "*";
            const state = entity.state[scope] || {} as CampaignState;
            state.notes = notes;
            (entity.state as Record<string, CampaignState>)[scope] = state;
        }

        if (entity.anchor) {
            entity.id = this.markdownLinkPath(entity.file, entity.anchor);
        } else {
            // Update the ID based on name and page title
            const anchorText = entity.name === pageTitle ? "" : entity.name;
            entity.id = this.markdownLinkPath(entity.file, anchorText);
        }
        this.finalizeEntity(entity, frontmatter, resolveProps);
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

        const globalState = entity.state["*"];
        if (globalState) {
            // Merge the '*' state with other states
            const stateKeys = Object.keys(entity.state).filter(
                (key) => key !== "*",
            );
            if (entity.scope) {
                stateKeys.push(entity.scope);
            }
            for (const key of stateKeys) {
                const state = {
                    ...globalState,
                    ...(entity.state[key] || {}),
                };
                // Type assertion needed to satisfy TypeScript when modifying indexed properties on generic type
                (entity.state as Record<string, CampaignState>)[key] = state;
            }
        }
        entity.tags = (entity.tags || []).filter(
            (tag) => !tag.startsWith(typeTagPrefix),
        );
    }

    /**
     * Add an entity to all the appropriate indexes
     */
    private addEntityToIndexes(entity: CampaignEntity): void {
        this.logDebug("Add entity", entity.type, entity.id, entity);

        // Add to main entity index
        this.entities.set(entity.id, entity);
        if (entity.idTag) {
            // this is an alternate identifier for the entity
            this.entities.set(entity.idTag, entity);
        }

        // Add to file path index
        const filePath = entity.file.path;
        const fileEntities = this.filePathToEntities.get(filePath) || new Map();
        fileEntities.set(entity.id, entity);
        this.filePathToEntities.set(filePath, fileEntities);

        // Add to type index
        const type = entity.type;
        const typeEntities = this.typeToEntities.get(type) || new Map();
        typeEntities.set(entity.id, entity);
        this.typeToEntities.set(type, typeEntities);

        // Add to tag indexes
        for (const tag of entity.tags) {
            if (this.tagPrefixes.find((prefix) => tag.startsWith(prefix))) {
                const tagEntities = this.tagToEntities.get(tag) || new Map();
                tagEntities.set(entity.id, entity);
                this.tagToEntities.set(tag, tagEntities);
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
        this.removeBacklinks(file.path);
        this.indexes.delete(file.path);
    }

    private removeBacklinks(filePath: string): void {
        this.backlinksIndex.delete(filePath);
        for (const [path, backlinks] of this.backlinksIndex.entries()) {
            const updatedBacklinks = backlinks.filter(
                (file) => file.path !== filePath,
            );
            this.backlinksIndex.set(path, updatedBacklinks);
        }
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
        this.entities.delete(entityId);
        if (entity.idTag) {
            this.entities.delete(entity.idTag);
        }

        // Remove from file path index
        const filePath = entity.file.path;
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
}

import {
    addToMappedArray,
    addToMappedMap,
    addToMappedNestedArray,
    cleanLinkTarget,
    entityToLink,
    markdownLinkPath,
    npcToIffGroup,
    scopeToRegex,
    segmentFilterRegex,
} from "CampaignNotes-utils";
import { type App, type Reference, TFile } from "obsidian";
import {
    type Area,
    type CampaignEntity,
    type CleanLink,
    type DataScope,
    type Encounter,
    EntityMap,
    EntityType,
    type Group,
    GroupStatus,
    type NPC,
    NPCStatus,
    type RelationshipCache,
    type StringMap,
} from "./@types";
import type { CampaignNotesIndex } from "./CampaignNotes-Index";

export class CampaignNotesCache {
    // Relationship caches
    index: CampaignNotesIndex;
    app: App;

    private npcStatusOrder = ["alive", "undead", "ghost", "dead", "unknown"];

    backlinksIndex: Map<string, TFile[]> = new Map();
    linksIndex: Map<string, CleanLink[]> = new Map();
    relationshipCache: Map<string, RelationshipCache> = new Map();

    constructor(app: App, index: CampaignNotesIndex) {
        this.app = app;
        this.index = index;
    }

    // Get or create scope cache
    getCache(scopePattern = "*"): RelationshipCache {
        const cache = this.relationshipCache.get(scopePattern) || {
            data: {},
            lists: {},
            timestamp: Date.now(),
        };
        this.relationshipCache.set(scopePattern, cache);
        return cache;
    }

    clearRelationshipCache(): void {
        this.relationshipCache.clear();
    }

    // Clear cache on demand or when index is rebuilt
    clearAll(): void {
        this.relationshipCache.clear();
        this.backlinksIndex.clear();
        this.linksIndex.clear();
    }

    precomputeRelationshipsForScope(scopePattern: string): void {
        this.index.logDebug(
            `Precomputing relationships for scope: ${scopePattern}`,
        );

        this.prepareScopeCache(scopePattern);

        const areas = this.getAreas(scopePattern);
        this.populateRelatedEntities(areas, scopePattern);

        const encounters = this.getEncounters(scopePattern);
        this.populateRelatedEntities(encounters, scopePattern);

        const places = this.getPlaces(scopePattern);
        this.populateRelatedEntities(places, scopePattern);

        const npcs = this.getNPCs(scopePattern);
        this.populateRelatedEntities(npcs, scopePattern);

        this.index.logDebug(
            `Precomputed relationships for scope: ${scopePattern}`,
            this.getCache(scopePattern),
        );
    }

    getActiveByType<T>(type: EntityType, dataScope: DataScope): T[] {
        const scopeCache = this.getCache(dataScope.pattern);
        const activeMap = scopeCache.data.activeByType?.get(dataScope.active);
        return activeMap?.get(type);
    }

    getAreas(scopePattern: string): Area[] {
        const scopeCache = this.getCache(scopePattern);
        return scopeCache.data.entityByType.get(EntityType.AREA);
    }

    getEncounters(scopePattern: string): Encounter[] {
        const scopeCache = this.getCache(scopePattern);
        return scopeCache.data.entityByType.get(EntityType.ENCOUNTER);
    }

    getGroups(scopePattern: string): Group[] {
        const scopeCache = this.getCache(scopePattern);
        return scopeCache.data.entityByType.get(EntityType.GROUP);
    }

    getGroupRenown(dataScope: DataScope): Group[] | undefined {
        const scopeCache = this.getCache(dataScope.pattern);
        const renownMap = scopeCache.data.groupRenown?.get(dataScope.active);
        return renownMap ? Array.from(renownMap.values()) : undefined;
    }

    getGroupStatus(
        dataScope: DataScope,
        groupId: string,
    ): GroupStatus | undefined {
        const scopeCache = this.getCache(dataScope.pattern);
        const statusMap = scopeCache.data.groupStatus?.get(dataScope.active);
        return statusMap?.get(groupId);
    }

    getNPCs(scopePattern: string): NPC[] {
        const scopeCache = this.getCache(scopePattern);
        return scopeCache.data.entityByType.get(EntityType.NPC);
    }

    getIffNpcs(dataScope: DataScope, iffGroup: string): NPC[] | undefined {
        const scopeCache = this.getCache(dataScope.pattern);
        const iffMap = scopeCache.data.npcIff?.get(dataScope.active);
        return iffMap?.get(iffGroup);
    }

    getNPCStatus(dataScope: DataScope, npcId: string): NPCStatus | undefined {
        const scopeCache = this.getCache(dataScope.pattern);
        const statusMap = scopeCache.data.npcStatus?.get(dataScope.active);
        return statusMap?.get(npcId);
    }

    getPlaces(scopePattern: string): Area[] {
        const scopeCache = this.getCache(scopePattern);
        return scopeCache.data.entityByType.get(EntityType.PLACE);
    }

    getRelatedOfType(
        scopePattern: string,
        entityId: string,
        type: EntityType,
    ): string[] | undefined {
        const related = this.getRelatedByType(scopePattern, entityId);
        if (related) {
            const relatedOfType = related.get(type);
            return relatedOfType
                ? Array.from(relatedOfType.values())
                : undefined;
        }
        return undefined;
    }

    getRelatedByType(
        scopePattern: string,
        entityId: string,
    ): Map<string, StringMap> | undefined {
        const cache = this.getCache(scopePattern);
        // Value relies on pre-warmed cache data
        // see precomputeRelationshipsForScope and populateRelatedEntities
        cache.data.related = cache.data.related || new Map();
        return cache.data.related.get(entityId);
    }

    private populateRelatedEntities(
        entityList: CampaignEntity[],
        scopePattern: string,
    ): void {
        const scopeCache = this.getCache(scopePattern);
        scopeCache.data.related = scopeCache.data.related || new Map();

        // Entity -> Groups relationship
        for (const entity of entityList) {
            const references: Map<string, StringMap> = new Map();
            const lastSeen = this.getLastSeen(entity, scopePattern);

            for (const tag of entity.tags) {
                const tagEntity = this.index.getEntityById(tag);
                if (tagEntity && tagEntity.id !== entity.id) {
                    addToMappedMap(
                        references,
                        tagEntity.type,
                        tagEntity.id,
                        entityToLink(tagEntity),
                    );
                    if (
                        lastSeen &&
                        entity.type === EntityType.NPC &&
                        tagEntity.type === EntityType.GROUP
                    ) {
                        this.updateLastSeen(tagEntity, lastSeen, scopePattern);
                    }
                }
            }
            for (const link of this.getLinks(entity)) {
                const linkEntity = this.index.getEntityById(link);
                if (linkEntity) {
                    addToMappedMap(
                        references,
                        linkEntity.type,
                        linkEntity.id,
                        entityToLink(linkEntity),
                    );
                }
            }
            if (
                entity.idTag &&
                (entity.type === EntityType.AREA ||
                    entity.type === EntityType.GROUP ||
                    entity.type === EntityType.PLACE)
            ) {
                const parentId = entity.idTag.split("/").slice(0, -1).join("/");
                const parentEntity = this.index.getEntityById(parentId);
                if (parentEntity) {
                    addToMappedMap(
                        references,
                        parentEntity.type,
                        parentEntity.id,
                        entityToLink(parentEntity),
                    );
                }
            }

            scopeCache.data.related.set(entity.id, references);
        }
    }

    prepareScopeCache(scopePattern: string): void {
        const scopeCache = this.getCache(scopePattern);
        const regex = scopeToRegex(scopePattern);

        scopeCache.data.activeByType =
            scopeCache.data.activeByType || new Map();
        scopeCache.data.entityByType =
            scopeCache.data.entityByType || new Map();
        scopeCache.data.groupRenown = scopeCache.data.groupRenown || new Map();
        scopeCache.data.groupStatus = scopeCache.data.groupStatus || new Map();
        scopeCache.data.npcIff = scopeCache.data.npcIff || new Map();
        scopeCache.data.npcStatus = scopeCache.data.npcStatus || new Map();

        // populate group/npc filtered indices
        const entities = this.index
            .getEntities(scopePattern)
            .sort((a, b) => a.name.localeCompare(b.name));

        for (const entity of entities) {
            addToMappedArray(scopeCache.data.entityByType, entity.type, entity);

            for (const scope of this.index.getScopes()) {
                if (!scope.match(regex)) {
                    // Skip scopes that don't match the pattern
                    continue;
                }

                switch (entity.type) {
                    case EntityType.GROUP: {
                        const group = entity as Group;
                        const groupState = group.state?.[scope];
                        if (groupState?.renown) {
                            addToMappedMap(
                                scopeCache.data.groupRenown,
                                scope,
                                group.id,
                                group,
                            );
                        }

                        const status = groupState
                            ? groupState.status || GroupStatus.ACTIVE
                            : group.state?.["*"].status || GroupStatus.UNKNOWN;

                        addToMappedMap(
                            scopeCache.data.groupStatus,
                            scope,
                            group.id,
                            status,
                        );
                        if (status !== GroupStatus.DEFUNCT) {
                            addToMappedNestedArray(
                                scopeCache.data.activeByType,
                                scope,
                                EntityType.GROUP,
                                group,
                            );
                        }
                        break;
                    }
                    case EntityType.NPC: {
                        const npc = entity as NPC;
                        const npcState = npc.state?.[scope];
                        addToMappedNestedArray(
                            scopeCache.data.npcIff,
                            scope,
                            npcToIffGroup(npcState?.iff),
                            npc,
                        );

                        const status =
                            (npc.state[scope || "*"]?.status as NPCStatus) ||
                            NPCStatus.ALIVE;
                        addToMappedMap(
                            scopeCache.data.npcStatus,
                            scope,
                            npc.id,
                            status,
                        );
                        if (status !== NPCStatus.DEAD) {
                            addToMappedNestedArray(
                                scopeCache.data.activeByType,
                                scope,
                                EntityType.NPC,
                                npc,
                            );
                        }
                        break;
                    }
                    default: {
                        addToMappedNestedArray(
                            scopeCache.data.activeByType,
                            scope,
                            entity.type,
                            entity,
                        );
                        break;
                    }
                }
            }
        }

        for (const value of scopeCache.data.npcIff.values()) {
            for (const iffKey of value.keys()) {
                const iffValue = value.get(iffKey);
                value.set(
                    iffKey,
                    iffValue?.sort((a, b) =>
                        this.sortNPCStatus(a, b, scopePattern),
                    ),
                );
            }
        }

        const sortedEncounters = scopeCache.data.entityByType
            .get(EntityType.ENCOUNTER)
            .sort((a: Encounter, b: Encounter) => {
                const l1 = a.level || 0;
                const l2 = b.level || 0;
                if (l1 === l2) {
                    return a.name.localeCompare(b.name);
                }
                return l1 - l2;
            });
        scopeCache.data.entityByType.set(
            EntityType.ENCOUNTER,
            sortedEncounters,
        );
    }

    private sortNPCStatus(a: NPC, b: NPC, currentScope: string): number {
        const n1 = a.state[currentScope || "*"]?.status || "alive";
        const idx1 = this.npcStatusOrder.indexOf(n1);
        const n2 = b.state[currentScope || "*"]?.status || "alive";
        const idx2 = this.npcStatusOrder.indexOf(n2);
        if (idx1 === idx2) {
            return a.name.localeCompare(b.name);
        }
        return idx1 - idx2;
    }

    // ------------------------------------------------------------

    getIcons(entity: CampaignEntity): string {
        const cache = this.getCache();
        cache.data.icons = cache.data.icons || new Map();

        let value = cache.data.icons.get(entity.id);
        if (value) {
            return value;
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
        value = Array.from(icons).sort().join(" ");
        cache.data.icons.set(entity.id, value);
        return value;
    }

    getLastSeen(entity: CampaignEntity, scopePattern?: string): string {
        const cache = this.getCache(scopePattern);
        const lastSeenMap = cache.data.lastSeen || new Map();
        cache.data.lastSeen = lastSeenMap;

        let value = lastSeenMap.get(entity.id);
        if (value) {
            return value;
        }

        const lastSeen = this.getBacklinks(entity.filePath, scopePattern)
            .filter((f) => f.path.match(/sessions/))
            .sort((a, b) => a.path.localeCompare(b.path))
            .pop();

        value = lastSeen?.basename.match(/\d+/)?.[0] || "";
        lastSeenMap.set(entity.id, value);
        return value;
    }

    updateLastSeen(
        entity: CampaignEntity,
        lastSeen: string,
        scopePattern?: string,
    ): void {
        const cache = this.getCache(scopePattern);
        const lastSeenMap = cache.data.lastSeen || new Map();
        cache.data.lastSeen = lastSeenMap;

        const value = lastSeenMap.get(entity.id);
        if (value) {
            const highest =
                lastSeen.localeCompare(value) > 0 ? lastSeen : value;
            lastSeenMap.set(entity.id, highest);
        } else {
            lastSeenMap.set(entity.id, lastSeen);
        }
    }

    // -------------------------------------------------------------

    getBacklinks(filePath: string, scopePattern?: string): TFile[] {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) {
            return [];
        }
        const files =
            this.backlinksIndex.get(filePath) || this.findBacklinks(file);

        if (scopePattern) {
            // Filter by scope if provided
            const pathRegex = segmentFilterRegex(scopePattern);
            return files.filter((f) => pathRegex.test(f.path));
        }
        return files;
    }

    getCleanLinks(filePath: string): CleanLink[] {
        return this.linksIndex.get(filePath) || this.findLinks(filePath);
    }

    /**
     * Cache outbound links for the file containing an entity
     * @param entity
     * @returns
     */
    getLinks<T extends CampaignEntity>(entity: T): string[] {
        const cleanLinks = this.getCleanLinks(entity.filePath);
        return cleanLinks.map((link) => link.mdLink);
    }

    private findLinks(filePath: string): CleanLink[] {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        const cache = this.app.metadataCache.getFileCache(file as TFile);
        if (!cache) {
            // Skip files without metadata
            this.linksIndex.set(file.path, []);
            return [];
        }

        const linkRefs: Reference[] = [];
        linkRefs.push(...(cache.links || []));
        linkRefs.push(...(cache.embeds || []));

        const cleanLinks = Array.from(
            new Set(
                linkRefs
                    .filter(
                        (ref) =>
                            !ref.link.startsWith("#") &&
                            !ref.link.match(/^(http|mailto|view-source)/),
                    )
                    .map((linkRef) => cleanLinkTarget(linkRef))
                    .map((linkRef) => {
                        const linkTarget =
                            this.app.metadataCache.getFirstLinkpathDest(
                                linkRef.path,
                                file.path,
                            );
                        linkRef.mdLink = markdownLinkPath(
                            linkTarget.path,
                            linkRef.anchor,
                        );
                        linkRef.path = linkTarget.path;
                        return linkRef;
                    }),
            ),
        );

        this.linksIndex.set(file.path, cleanLinks);
        return cleanLinks;
    }

    private findBacklinks(targetFile: TFile): TFile[] {
        const backlinks: TFile[] = [];
        const allFiles = this.app.vault.getMarkdownFiles();

        for (const tfile of allFiles) {
            const fileCache = this.app.metadataCache.getFileCache(tfile);
            if (
                tfile.path === targetFile.path ||
                this.index.fileExcluded(tfile.path) ||
                this.index.skipFileFrontmatter(tfile) ||
                (!fileCache?.links && !fileCache?.embeds)
            ) {
                // Skip the same file, a file outside of included folders,
                // and files w/o links or embeds
                continue;
            }

            const cleanLinks = this.getCleanLinks(tfile.path);
            for (const link of cleanLinks) {
                if (targetFile.path === link.path) {
                    backlinks.push(tfile);
                    break; // No need to check other links in this file
                }
            }
        }

        this.backlinksIndex.set(targetFile.path, backlinks);
        return backlinks;
    }

    removeAllLinks(filePath: string): void {
        this.linksIndex.delete(filePath);
        this.backlinksIndex.delete(filePath);
        for (const [path, backlinks] of this.backlinksIndex.entries()) {
            const updatedBacklinks = backlinks.filter(
                (file) => file.path !== filePath,
            );
            this.backlinksIndex.set(path, updatedBacklinks);
        }
    }
}

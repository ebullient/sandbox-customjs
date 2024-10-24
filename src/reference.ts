import {
    App,
    TFile,
} from "obsidian";
import { Conditions, SegmentFn, Utils } from "./_utils";
import { EngineAPI, MarkdownBuilder } from "./@types/jsengine.types";

type Tags = string | string[];
type NPCFrontMatter = string | Array<string|NPC> | NPC;

interface NPC {
    link: string;
    where: string;
    affiliation: string[];
    name?: string;
    status?: string;
    iff?: string;
    scope?: string;
}

interface Encounter {
    status?: string;
    link?: string;
    where?: string;
    affiliation?: string;
    level?: string;
}

export class Reference {
    app: App;

    constructor() {  // Constructor
        console.log("loading Reference");
        this.app = window.customJS.app;
    }

    utils = (): Utils => window.customJS.Utils;

    currentScope = () => {
        const current = this.app.workspace.getActiveFile();
        return current.path.split('/')[0];
    }

    /**
     * Render information about defined encounters
     * - value of encounter attribute (e.g. new, pending, active, complete)
     * - where tags: "place/usethis" or "region/usethis"
     * - affiliation tags: "group/usethis"
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string} tagReplace String to replace in tags for rendering
     * @returns Markdown Builder for the engine to render
     */
    encounterTable = (engine: EngineAPI, tagFn: SegmentFn = this.utils().lastSegment) => {
        const scope = this.currentScope();
        const pathRegex = this.utils().segmentFilterRegex(scope);
        const data: Encounter[] = this.utils().filesWithPath(pathRegex)
            .map((tfile: TFile) => {
                if (!this.utils().filterByPath(tfile, pathRegex)) {
                    return {};
                }
                const fm = this.utils().frontmatter(tfile);
                const encounterState = fm.encounter;
                if (!encounterState) {
                    return {};
                }
                const levelMatch = tfile.name.match(/(\d+)-.*/);
                const level = levelMatch ? levelMatch[1] : '';
                const fileTags = this.utils().fileTags(tfile);
                const affiliation: string[] = [];
                let where = 'region';
                fileTags.forEach(tag => {
                    if (tag.startsWith('place/')) {
                        where = tag.slice(6);
                    } else if (where == 'region' && tag.startsWith('region/')) {
                        where = tag.slice(7);
                    } else if (tag.startsWith('group/')) {
                        affiliation.push(tag.slice(6));
                    }
                });

                return {
                    status: encounterState,
                    link: this.utils().markdownLink(tfile),
                    affiliation: affiliation
                            .map(x => tagFn ? tagFn(x) : x)
                            .sort()
                            .join(", "),
                    level,
                    where: tagFn ? tagFn(where) : where,
                }
            })
            .filter(x => x.link);

        const markdownBuilder = engine.markdown.createBuilder();
        markdownBuilder.createHeading(2, 'Active');
        markdownBuilder.createTable(["Name", "Where", "Affiliation"],
            data.filter(x => x.status === 'active').map(x => [x.link, x.where, x.affiliation])
        );


        markdownBuilder.createHeading(2, 'New');
        markdownBuilder.createTable(["Level", "Name", "Where", "Affiliation"],
            data.filter(x => x.status === 'new').map(x => [x.level, x.link, x.where, x.affiliation])
        );

        markdownBuilder.createHeading(2, 'Other');
        markdownBuilder.createTable(["Status", "Name", "Where", "Affiliation"],
            data.filter(x => !x.status.match(/(active|new)/)).map(x => [x.status, x.link, x.where, x.affiliation])
        );

        return markdownBuilder;
    }

    /**
     * Unlike encounters, factions are not (as) scoped.
     * Allow a pathPattern for optional restriction to some paths
     * @param {EngineAPI} engine The engine to create markdown.
     * @returns Markdown Builder for the engine to render
     */
    factionTable = (engine: EngineAPI, pathPattern: RegExp): MarkdownBuilder => {
        const groups: string[][] = [];
        this.app.vault.getMarkdownFiles()
            .filter((tfile: TFile) => tfile !== this.app.workspace.getActiveFile())
            .forEach((tfile: TFile) => {
                if (pathPattern && !this.utils().filterByPath(tfile, pathPattern)) {
                    return false;
                }
                const fileTags = this.utils().fileTags(tfile);
                const groupTag = fileTags.find(t => t && t.startsWith('type/group'));
                if (groupTag) {
                    const result = [this.utils().markdownLink(tfile), groupTag.substring(11)];
                    if (!pathPattern) {
                        result.push(tfile.path.split('/')[0]);
                    }
                    groups.push(result);
                }
            });
        groups.sort((a, b) => {
            console.log(a, b);
            const n1 = a[0].replace(/\[(.*)\].*/, '$1').toLowerCase();
            const n2 = b[0].replace(/\[(.*)\].*/, '$1').toLowerCase();
            return n1.localeCompare(n2);
        });

        const header = pathPattern
            ? ["Name", "Type"]
            : ["Name", "Type", "Scope"];

        const markdownBuilder = engine.markdown.createBuilder();
        markdownBuilder.createTable(header, groups);
        return markdownBuilder;
    }

    /* Convert iff status into an emoji */
    iffStatus = (iff: string): string => {
        switch (iff) {
            case 'friend': return '🟩';
            case 'positive': return '⬆️';
            case 'negative': return '⬇️';
            case 'enemy': return '🟥';
            default: return '⬜️';
        }
    }

    itemsForTagRaw = (tag: Tags, type: string, scoped = false): string[] => {
        const tagRegexes = this.tagToRegexes(tag);
        const items: string[] = [];

        const makeLink = (tfile: TFile, name: string = '') => {
            const title = this.utils().fileTitle(tfile);
            name = name ? name : title; // use title if a name wasn't provided
            const anchor = title === name ? '' : name;
            const target = this.utils().markdownLinkPath(tfile, anchor);
            if (scoped) {
                const scope = tfile.path.slice(0, tfile.path.indexOf('/'));
                return this.utils().scopedListItem(scope, name, target);
            }
            return this.utils().markdownListItem(name, target)
        }

        const addNPC = (tfile: TFile, value: NPCFrontMatter) => {
            if (typeof value === "string") {
                items.push(makeLink(tfile, value));
            } else if (Array.isArray(value)) {
                value.forEach(s => addNPC(tfile, s));
            } else {
                items.push(makeLink(tfile, value.name));
            }
        }

        this.app.vault.getMarkdownFiles()
            .filter((tfile: TFile) => tfile !== this.app.workspace.getActiveFile())
            .forEach((tfile: TFile) => {
                const fileTags = this.utils().fileTags(tfile);
                const hasTag = tagRegexes.some(regex => fileTags.some(ftag => regex.test(ftag)));
                if (hasTag && this.matchType(tfile, fileTags, type)) {
                    const fm = this.utils().frontmatter(tfile);
                    if (type === 'npc' && fm.npc) {
                        addNPC(tfile, fm.npc);
                    } else if (type === 'location' && fm.location) {
                        items.push(makeLink(tfile, fm.location));
                    } else {
                        items.push(makeLink(tfile));
                    }
                }
            });

        items.sort(this.sortMarkdownLinks);
        return items;
    }

    itemsForTag = (engine: EngineAPI, tag: Tags, type: string, scoped = false) => {
        const items = this.itemsForTagRaw(tag, type, scoped);
        return engine.markdown.create(items.join("\n"));
    }

    linked = (engine: EngineAPI) => {
        return this.utils().scopedFilesWithConditions(engine, "[[]]");
    }

    linkedWithConditions = (engine: EngineAPI, conditions: Conditions) => {
        if (!Array.isArray(conditions)) {
            conditions = [conditions];
        }
        conditions.push("[[]]");
        return this.utils().scopedFilesWithConditions(engine, conditions);
    }

    logs = (engine: EngineAPI, conditions: Conditions) => {
        const conditionsFilter = this.utils().createFileConditionFilter(conditions);
        const files = this.utils().filesMatchingCondition((tfile: TFile) => {
            return this.utils().filterByPath(tfile, /sessions/) && conditionsFilter(tfile);
        });
        return engine.markdown.create(files
            .map(f => this.utils().scopedFileListItem(f))
            .join("\n"));
    }

    /**
     * Filter by the presence of 'type/' tags or frontmatter
     * @param {TFile} tfile The file to examine
     * @param {string[]} tags File tags
     * @param {string} type Type of page to match
     * @returns {boolean} true to include page
     */
    matchType = (tfile: TFile, tags: string[], type: string): boolean => {
        const frontmatter = this.utils().frontmatter(tfile);
        switch (type) {
            case 'area':
                return !!tags.find(t => t && t.startsWith('type/area'));
            case 'encounter':
                // has  encounter attribute: new / active / completed, etc.
                return !!frontmatter.encounter;
            case 'group':
                return !!tags.find(t => t && t.startsWith('type/group'));
            case 'item':
                return !!tags.find(t => t && t.startsWith('type/item'));
            case 'location':
                // include locations and areas
                return !!tags.find(t => t && (t.startsWith('type/location') || t.startsWith('type/area')));
            case 'npc':
                return !!tags.find(t => t && t.startsWith('type/npc'));
            case 'pc':
                return !!tags.find(t => t && t.startsWith('type/pc'));
        }
        // exclude all pages that don't match conditions above
        return false;
    }

    npcTable = (engine: EngineAPI, pathPattern: RegExp = undefined, whereTag = 'place/', relationships = ''): string => {
        const npcs: NPC[] = [];
        const iffTag = `${relationships}/iff/`;
        const statusTag = `${relationships}/npc/`

        // Add an NPC to the list
        const addNPC = (tfile: TFile, name: string, iff: string, status: string, where: string, affiliation: string[] = []) => {
            const title = this.utils().fileTitle(tfile);
            const link = title === name
                ? this.utils().markdownLink(tfile)
                : `[${name}](${this.utils().markdownLinkPath(tfile, name)})`; // section/anchor link

            const result: NPC = {
                link,
                affiliation,
                where: where.replace(/^\//, '')
            };
            if (relationships) {
                result.status = this.status(status);
                result.iff = this.iffStatus(iff);
            }
            if (!pathPattern) {
                result.scope = tfile.path.split('/')[0];
            }
            npcs.push(result);
        }

        // Read NPC frontmatter (optional, several forms)
        const readNPC = (tfile: TFile, value: NPCFrontMatter, iff: string, status: string, where: string, affiliation: string[]) => {
            if (typeof value === "string") {
                addNPC(tfile, value, iff, status, where, affiliation);
            } else if (Array.isArray(value)) {
                value.forEach(s => readNPC(tfile, s, iff, status, where, affiliation));
            } else {
                addNPC(tfile,
                    value.name,
                    value.iff || iff,
                    value.status || status,
                    value.where || where,
                    value.affiliation || affiliation
                )
            }
        }

        this.app.vault.getMarkdownFiles()
            .filter((tfile: TFile) => tfile !== this.app.workspace.getActiveFile())
            .forEach((tfile: TFile) => {
                if (pathPattern && !this.utils().filterByPath(tfile, pathPattern)) {
                    return;
                }
                const fileTags = this.utils().fileTags(tfile);
                const affiliation: string[] = [];
                let iff = 'unknown';
                let status = 'alive';
                let where = 'region';
                let isNpcType = false;

                // find base values using tags
                fileTags.forEach(tag => {
                    if (tag.startsWith(whereTag)) {
                        where = tag.slice(whereTag.length);
                    } else if (where == 'region' && tag.startsWith('region/')) {
                        where = tag.slice(7);
                    } else if (tag.startsWith('group/')) {
                        affiliation.push(tag.slice(6));
                    } else if (tag.startsWith('type/npc')) {
                        isNpcType = true;
                    }
                    if (relationships) {
                        if (tag.startsWith(iffTag)) {
                            iff = tag.slice(iffTag.length);
                        } else if (tag.startsWith(statusTag)) {
                            status = tag.slice(statusTag.length);
                            isNpcType = true;
                        }
                    }
                });

                const fm = this.utils().frontmatter(tfile);
                if (fm.npc) {
                    readNPC(tfile, fm.npc, iff, status, where, affiliation);
                } else if (isNpcType) {
                    addNPC(tfile, this.utils().fileTitle(tfile), iff, status, where, affiliation);
                }
            });

        npcs.sort((a, b) => this.sortMarkdownLinks(a.link, b.link));

        return engine.markdown.create(npcs.map(n =>
            '- <span class="npc">'
            + (relationships
                ? `<span class="status">${n.status}</span><span class="iff">${n.iff}</span>`
                : '')
            + `<span class="name">${n.link}</span>`
            + `<span class="affiliation">${n.affiliation.sort().join(", ")}</span>`
            + `<span class="where">${n.where}</span>`
            + (!pathPattern ? `<span class="scope">${n.scope}</span>` : '')
            + '</span>'
        ).join("\n"));
    };

    placesTable = (engine: EngineAPI, pathPattern: RegExp = undefined, whereTag = 'region/'): MarkdownBuilder => {
        const places: string[][] = [];
        this.app.vault.getMarkdownFiles()
            .filter((tfile: TFile) => tfile !== this.app.workspace.getActiveFile())
            .forEach((tfile: TFile) => {
                if (pathPattern && !this.utils().filterByPath(tfile, pathPattern)) {
                    return false;
                }
                const fileTags = this.utils().fileTags(tfile);
                const placeTag = fileTags.find(t => t && t.startsWith('type/location'));
                if (placeTag) {
                    const affiliation: string[] = [];
                    let where = 'unknown';
                    fileTags.forEach(tag => {
                        if (tag.startsWith(whereTag)) {
                            where = tag.slice(whereTag.length);
                        } else if (where == 'unknown' && tag.startsWith('region/')) {
                            where = tag.slice(7);
                        } else if (tag.startsWith('group/')) {
                            affiliation.push(tag.slice(6));
                        }
                    });
                    const fm = this.utils().frontmatter(tfile);
                    console.log(tfile.name, fm.location);
                    const link = fm.location
                        ? `[${fm.location}](${this.utils().markdownLinkPath(tfile)})`
                        : this.utils().markdownLink(tfile);

                    const result = [
                        link,
                        placeTag.replace(/type\/location\/?/, ''),
                        affiliation.sort().join(", "),
                        where
                    ];
                    if (!pathPattern) {
                        result.push(tfile.path.split('/')[0]);
                    }
                    places.push(result);
                }
            });

        places.sort((a, b) => this.sortMarkdownLinks(a[0], b[0]));

        const header = pathPattern
            ? ["Name", "Type", "Affiliation", "Where"]
            : ["Name", "Type", "Affiliation", "Where", "Scope"];

        console.log(header, places);
        const markdownBuilder = engine.markdown.createBuilder();
        markdownBuilder.createTable(header, places);
        return markdownBuilder;
    };

    relatedNotItems = (engine: EngineAPI, tags: Tags = []): string => {
        const current = this.app.workspace.getActiveFile();
        const tagRegexes = this.tagToRegexes(tags);

        const files = this.utils().filesMatchingCondition((tfile: TFile) => {
            const hasBacklink = this.utils().filterByLinkToFile(tfile, current);
            const fileTags = this.utils().fileTags(tfile);
            const hasTag = tagRegexes.some(regex => fileTags.some(ftag => regex.test(ftag)));
            const isType = fileTags.some(t => t && t.startsWith('type/'));
            if (hasBacklink && hasTag) {
                return !isType;
            }
            return hasBacklink || (hasTag && !isType);
        });
        return engine.markdown.create(files
            .map(f => this.utils().scopedFileListItem(f))
            .join("\n"));
    }

    relatedWithinScope = (engine: EngineAPI, scope: string, conditions: Conditions = []): string => {
        const pathRegex = this.utils().segmentFilterRegex(scope);
        const conditionsFilter = this.utils().createFileConditionFilter(conditions);

        const files = this.utils().filesMatchingCondition((tfile: TFile) => {
            return this.utils().filterByPath(tfile, pathRegex)
                && conditionsFilter(tfile);
        });
        return engine.markdown.create(files
            .map(f => this.utils().fileListItem(f))
            .join("\n"));
    }

    scopeRegex = (root: string): RegExp => {
        return this.utils().segmentFilterRegex(root);
    }

    sortMarkdownLinks = (a: string, b: string): number => {
        const n1 = a.replace(/\[(.*)\].*/, '$1').toLowerCase();
        const n2 = b.replace(/\[(.*)\].*/, '$1').toLowerCase();
        return n1.localeCompare(n2);
    }

    /* Convert iff status into an emoji */
    status = (alive: string): string => {
        switch (alive) {
            case 'alive': return '💙';
            case 'dead': return '💀';
            case 'undead': return '🧟‍♀️';
            default: return '⬜️';
        }
    }

    tagToRegexes = (tag: Tags): RegExp[] => {
        if (typeof tag === 'string') {
            tag = [tag];
        }
        return tag.map(this.utils().tagFilterRegex);
    }

    todos = (engine: EngineAPI, scope: string): string => {
        const pathRegex = this.utils().segmentFilterRegex(scope);
        const files = this.utils().filesMatchingCondition((tfile: TFile) => {
            return this.utils().filterByPath(tfile, pathRegex)
                && this.utils().filterByTag(tfile, "#todo");
        });
        return engine.markdown.create(files
            .map(f => this.utils().fileListItem(f))
            .join("\n"));
    }
}

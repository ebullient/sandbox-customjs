import type { Moment } from "moment";
import type {
    App,
    FrontMatterCache,
    LinkCache,
    TFile,
    TFolder,
    TagCache,
} from "obsidian";
import type { EngineAPI } from "./@types/jsengine.types";

export type CompareFn = () => number;
export type Conditions = string | string[];
export type FileCompareFn = (a: TFile, b: TFile) => number;
export type FileFilterFn = (a: TFile) => boolean;
export type FileGroupByFn = (a: TFile) => string;
export type FolderFilterFn = (a: TFolder) => boolean;
export type RenderFn = () => string;
export type SegmentFn = (tag: string) => string;
export type Tags = string | string[];

/**
 * Cache for push target files
 */
interface PushTargetCache {
    data: string[];
    timestamp: number;
}

interface CleanLink {
    link: string;
    text?: string;
    anchor?: string;
}

export class Utils {
    taskPattern: RegExp = /^([\s>]*- )\[(.)\] (.*)$/;
    completedPattern: RegExp = /.*\((\d{4}-\d{2}-\d{2})\)\s*$/;
    dailyNotePattern: RegExp = /^(\d{4}-\d{2}-\d{2}).md$/;
    lastSegment: SegmentFn = (x) => x.slice(x.lastIndexOf("/") + 1);

    pathConditionPatterns: RegExp[] = [
        /^\[.*?\]\((.*?\.md)\)$/, // markdown link
        /^\[\[(.*?)\|?([^\]]*)??\]\]$/, // wikilink
        /^(.*?\.md)$/, // file path
    ];

    app: App;
    private fileCache: PushTargetCache | null = null;
    private readonly cacheTTL = 5 * 60 * 1000; // Cache valid for 5 minutes

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded Utils");
    }

    allTags = (): string[] => {
        // use a set to avoid duplicates
        const allTags = new Set<string>();

        for (const f of this.app.vault.getMarkdownFiles()) {
            const tags = this.fileTags(f);
            for (const t of tags) {
                allTags.add(t);
            }
        }

        return [...allTags];
    };

    /**
     * Cleans a link reference by removing the title and extracting the anchor.
     * @param {LinkCache} linkRef Link reference returned from this.app.metadataCache.getFileCache(tfile).links().
     * @returns {Object} An object with link display text, the block or heading reference (if any), and plain link.
     */
    cleanLinkTarget = (linkRef: LinkCache): CleanLink => {
        let link = linkRef.link;
        // remove/drop title: vaultPath#anchor "title" -> vaultPath#anchor
        const titlePos = link.indexOf(' "');
        if (titlePos >= 0) {
            link = link.substring(0, titlePos);
        }
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
            text: linkRef.displayText,
            anchor,
            link,
        };
    };

    /**
     * Create a filter function to evaluate a list of conditions
     * - AND/OR logic can be specified at the beginning of the list
     * - #tag
     * - path/to/file.md, [[wikilink]], [markdown link](path/to/file.md)
     * @param {string|Array<string>} conditions
     * @returns {FileFilterFn} Function to apply to evaluate conditions
     */
    createFileConditionFilter = (
        inputConditions: string | string[],
    ): FileFilterFn => {
        let conditions = inputConditions;
        if (!Array.isArray(conditions)) {
            conditions = [conditions];
        }

        let logic = "OR";
        if (conditions[0].match(/^(AND|OR)$/i)) {
            logic = conditions[0].toUpperCase();
            conditions = conditions.slice(1);
        }

        const tags: string[] = [];
        const paths: string[] = [];

        for (const c of conditions) {
            if (!c) {
                // if this ends up being empty, skip it
                continue;
            }
            if (c.startsWith("#")) {
                tags.push(c);
            } else {
                paths.push(c);
            }
        }

        const files = paths
            ? paths.map((p) => this.stringConditionToTFile(p))
            : [];

        return (tfile: TFile) => {
            const tagMatch =
                tags.length > 0
                    ? this.filterByTag(tfile, tags, logic === "AND")
                    : false;

            const fileMatch =
                files.length > 0
                    ? this.filterByLinksToFiles(tfile, files, logic === "AND")
                    : false;

            if (logic === "AND") {
                // all conditions must be true
                return (
                    (tags.length === 0 || tagMatch) &&
                    (files.length === 0 || fileMatch)
                );
            }

            // Default: any condition can be true
            return tagMatch || fileMatch;
        };
    };

    /**
     * Generates a markdown list item with a markdown-style link for the given file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} A markdown list item with a markdown-style link for the file.
     */
    fileListItem = (tfile: TFile): string => {
        return `- ${this.markdownLink(tfile)}`;
    };

    /**
     * Retrieves a list of file paths for all Markdown files in the vault (used for prompts).
     * @returns {string[]} A list of file paths for all Markdown files in the vault.
     */
    filePaths = (): string[] => {
        return this.app.vault.getMarkdownFiles().map((x) => x.path);
    };

    /**
     * Retrieves all tags found in the frontmatter and body of the file without the leading hash.
     * @param {TFile} tfile The file to examine.
     * @returns {Array} A list of tags found in the frontmatter and body of the file without the leading hash.
     * @see removeLeadingHashtag
     */
    fileTags = (tfile: TFile): string[] => {
        const cache = this.app.metadataCache.getFileCache(tfile);
        if (!cache) {
            return [];
        }
        const tags = [];

        const normalizeTag = (t: TagCache | string) => {
            if (t != null) {
                if (typeof t === "string") {
                    tags.push(this.removeLeadingHashtag(t));
                } else {
                    tags.push(this.removeLeadingHashtag(t.tag));
                }
            }
        };

        if (cache.tags) {
            for (const t of cache.tags) {
                normalizeTag(t);
            }
        }
        if (cache.frontmatter?.tags) {
            for (const t of cache.frontmatter.tags) {
                normalizeTag(t);
            }
        }
        return tags;
    };

    /**
     * Generates a title using either the first alias or the file name (without the .md extension).
     * @param {TFile} tfile The file to examine.
     * @returns {string} A title using either the first alias or the file name (without the .md extension).
     */
    fileTitle = (tfile: TFile): string => {
        const cache = this.app.metadataCache.getFileCache(tfile);
        const aliases = cache?.frontmatter?.aliases;
        const alias = aliases ? aliases[0] : tfile.name.replace(".md", "");
        if (typeof alias === "string") {
            return alias;
        }
        return tfile.name.replace(".md", "");
    };

    /**
     * Retrieves a list of all files that have links to the target file.
     * @param {TFile} targetFile The target file to match.
     * @param {boolean} includeCurrent True if the current file should be included in the list (default: false).
     * @returns {TFile[]} A list of all files that have links to the target file.
     * @see filesMatchingCondition
     * @see filterByLinkToFile
     */
    filesLinkedToFile = (
        targetFile: TFile,
        includeCurrent = false,
    ): TFile[] => {
        return this.filesMatchingCondition(
            (tfile: TFile) => this.filterByLinkToFile(tfile, targetFile),
            includeCurrent,
        );
    };

    /**
     * Retrieves a list of all markdown files (excluding the current file) that match the provided filter function.
     * @param {FileFilterFn} fn Filter function that accepts TFile as a parameter.
     *      Should return true if the condition is met, and false if not (standard JS array filter behavior).
     * @param {boolean} includeCurrent True if the current file should be included in the list (default: false).
     * @returns {TFile[]} A list of all markdown files (excluding the current file) that match the provided filter function.
     */
    filesMatchingCondition = (
        fn: FileFilterFn,
        includeCurrent = false,
        sort: FileCompareFn = this.sortTFile,
    ): TFile[] => {
        const current = this.app.workspace.getActiveFile();
        return this.app.vault
            .getMarkdownFiles()
            .filter((tfile) => includeCurrent || tfile !== current)
            .filter((tfile) => fn(tfile))
            .sort(sort);
    };

    /**
     * Retrieves a list of all files with the specified tag.
     * @param {string | string[]} conditions Either a string or an array of strings.
     *      By default, the array will act as an OR.
     *      The first element of the array can change that behavior (AND|OR).
     * @param {boolean} includeCurrent True if the current file should be included in the list (default: false).
     * @returns {TFile[]} A list of all files satisfyng specified conditions
     * @see createFileConditionFilter
     * @see filesMatchingCondition
     */
    filesWithConditions = (
        conditions: string | string[],
        includeCurrent = false,
    ): TFile[] => {
        const conditionsFilter = this.createFileConditionFilter(conditions);
        return this.filesMatchingCondition(
            (tfile: TFile) => conditionsFilter(tfile),
            includeCurrent,
        );
    };

    /**
     * Retrieves a list of all files whose path matches the provided path pattern.
     * @param {RegExp} pathPattern The pattern to match against the file path.
     * @param {boolean} includeCurrent True if the current file should be included in the list (default: false).
     * @returns {TFile[]} A list of all files whose path matches the provided path pattern.
     * @see filesMatchingCondition
     * @see filterByPath
     */
    filesWithPath = (pathPattern: RegExp, includeCurrent = false): TFile[] => {
        return this.filesMatchingCondition(
            (tfile: TFile) => this.filterByPath(tfile, pathPattern),
            includeCurrent,
        );
    };

    /**
     * Checks if the file has a link to the target file.
     * @param {TFile} tfile The file to examine.
     * @param {TFile} targetFile The link target to match.
     * @returns {boolean} True if the file has a link to the target file.
     */
    filterByLinkToFile = (tfile: TFile, targetFile: TFile): boolean => {
        if (tfile.path === targetFile.path) {
            return false;
        }

        const fileCache = this.app.metadataCache.getFileCache(tfile);
        if (!fileCache?.links && !fileCache?.embeds) {
            return false;
        }

        const links = [];
        links.push(...(fileCache.links || []));
        links.push(...(fileCache.embeds || []));

        return links
            .filter((link) => !link.link.match(/^(http|mailto|view-source)/))
            .map((link) => this.cleanLinkTarget(link))
            .some((cleanedLink) => {
                const linkTarget = this.pathToFile(
                    cleanedLink.link,
                    tfile.path,
                );
                return targetFile.path === linkTarget?.path;
            });
    };

    /**
     * Checks if the file has a link to one of the target files.
     * @param {TFile} tfile The file to examine.
     * @param {TFile[]} targetFiles A list of possible link targets
     * @param {boolean} all True if links to all files should be present (AND);
     *      false (default) if links to any of the files should be present (OR).
     * @returns {boolean} True if the file has a link to one of the target files.
     */
    filterByLinksToFiles = (
        tfile: TFile,
        targetFiles: TFile[],
        all = false,
    ): boolean => {
        const fileCache = this.app.metadataCache.getFileCache(tfile);
        if (!fileCache?.links || !targetFiles || targetFiles.length === 0) {
            return false;
        }

        const links = fileCache.links
            .filter((link) => !link.link.match(/^(http|mailto|view-source)/))
            .map((link) => this.cleanLinkTarget(link)) // remove titles and anchor references
            .map((cleanedLink) =>
                this.pathToFile(cleanedLink.link, tfile.path),
            );

        return all
            ? targetFiles.every((t) =>
                  links.some((linkTarget) => t.path === linkTarget?.path),
              )
            : targetFiles.some((t) =>
                  links.some((linkTarget) => t.path === linkTarget?.path),
              );
    };

    /**
     * Checks if the file path matches the pattern.
     * @param {TFile} tfile The file to examine.
     * @param {RegExp} pathPattern The pattern to match against the file path.
     * @returns {boolean} True if the file path matches the pattern.
     */
    filterByPath = (tfile: TFile, pathPattern: RegExp): boolean => {
        return pathPattern.test(tfile.path);
    };

    /**
     * Checks if the required tags are present.
     * @param {TFile} tfile The file to examine.
     * @param {string|Array} tag A string or array of tag values.
     * @param {boolean} all True if all tags should be present (AND);
     *      false (default) if any of the tags should be present (OR).
     * @returns {boolean} True if the required tags are present.
     */
    filterByTag = (
        tfile: TFile,
        tag: string | string[],
        all = false,
    ): boolean => {
        const fileTags = this.fileTags(tfile);

        // for an array, use the "all" parameter
        if (Array.isArray(tag)) {
            const tagRegexes = tag.map(this.tagFilterRegex);
            if (all) {
                // AND: Every tag should be present in fileTags
                return tagRegexes.every((regex) =>
                    fileTags.some((ftag) => regex.test(ftag)),
                );
            }

            // OR: At least one tag should be present in fileTags
            return tagRegexes.some((regex) =>
                fileTags.some((ftag) => regex.test(ftag)),
            );
        }

        // single string: return true if tag is present
        const tagRegex = this.tagFilterRegex(tag);
        return fileTags.some((ftag) => tagRegex.test(ftag));
    };

    filterByTags = (tfile: TFile, tagRegexes: RegExp[]): boolean => {
        if (tagRegexes.length === 0) {
            return true;
        }
        const fileTags = this.fileTags(tfile);
        return fileTags.some((t) => tagRegexes.some((regex) => regex.test(t)));
    };

    /**
     * Creates a markdown list of all files contained within the current folder grouped by subdirectory.
     * @param {EngineAPI} engine The engine to create markdown.
     * @returns {string} A markdown list of all files contained within the current folder grouped by subdirectory.
     * @see filesWithPath
     * @see index
     */
    folderIndex = (engine: EngineAPI): string => {
        const current = this.app.workspace.getActiveFile();
        const path = current.parent.path;
        const list = this.filesWithPath(new RegExp(`^${path}`));
        return this.index(engine, list, path);
    };

    /**
     * Retrieve a list of folders that are children of the provided
     * folder and match the given conditions
     * @param {string} folder The initial folder path to filter.
     * @param {FolderFilterFn} fn Filter function that accepts TFolder as a parameter.
     *      Should return true if the condition is met, and false if not (standard JS array filter behavior).
     * @returns {TFolder[]} A list of all folders contained within the provided folder
     *      that match the given conditions.
     */
    foldersByCondition = (
        folder = "",
        fn: FolderFilterFn = (_: TFolder) => true,
    ): TFolder[] => {
        let folders = [];
        if (!folder || folder === "/") {
            folders = this.app.vault
                .getAllFolders(true)
                .filter((tfolder) => fn(tfolder));
        } else {
            const pathFilter = this.segmentFilterRegex(folder);
            folders = this.app.vault
                .getAllFolders(false)
                .filter((tfolder) => pathFilter.test(tfolder.path))
                .filter((tfolder) => fn(tfolder));
        }

        return folders.sort((a, b) => a.path.localeCompare(b.path));
    };

    /**
     * Retrieves the frontmatter of a file.
     * @param {TFile} tfile The file to examine.
     * @returns {Object} The frontmatter or an empty object.
     */
    frontmatter = (tfile: TFile): FrontMatterCache => {
        const cache = this.app.metadataCache.getFileCache(tfile);
        return cache?.frontmatter || {};
    };

    /**
     * Groups elements in a collection by the specified condition.
     * @param {Array} collection The collection to group.
     * @param {FileGroupByFn} fn The function that defines keys for an object.
     * @returns {Object} An object with keys generated by the function and array values that match the key.
     */
    groupBy = (
        collection: TFile[],
        fn: FileGroupByFn,
    ): Record<string, TFile[]> =>
        collection.reduce(
            (accumulator: Record<string, TFile[]>, currentElement, index) => {
                // Determine the key for the current element using the provided function
                const key = fn(currentElement);

                // Initialize the array for this key if it doesn't exist
                if (!accumulator[key]) {
                    accumulator[key] = [];
                }
                // Push the current element into the array for this key
                accumulator[key].push(currentElement);
                // Return the accumulator for the next iteration
                return accumulator;
            },
            {},
        );

    /**
     * Groups files by parent path, and then creates a simple sorted list of the files in each group.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {Array} fileList An array of TFiles to list.
     * @returns {string} A markdown list of files grouped by parent path
     */
    index = (
        engine: EngineAPI,
        fileList: TFile[],
        leadingPath = "",
    ): string => {
        const groups = this.groupBy(
            fileList,
            (tfile: TFile) => tfile.parent.path,
        );
        const keys = Object.keys(groups).sort();
        const result: string[] = [];
        for (const key of keys) {
            const value = groups[key].sort((a, b) => {
                if (this.isFolderNote(a)) {
                    return -1;
                }
                if (this.isFolderNote(b)) {
                    return 1;
                }
                return this.sortTFile(a, b);
            });
            const trim = key.replace(leadingPath, "");
            if (trim) {
                result.push(`\n**${key}**\n`);
            }
            for (const v of value) {
                const note = this.isFolderNote(v)
                    ? " <small>(index)</small>"
                    : "";
                result.push(`- ${this.markdownLink(v)}${note}`);
            }
        }
        return result == null || result.length === 0
            ? engine.markdown.create("None")
            : engine.markdown.create(result.join("\n"));
    };

    /**
     * Checks if the file is a folder note (same name as parent folder or README.md).
     * @param {TFile} tfile The file to examine.
     * @returns {boolean} True if the file is a folder note.
     */
    isFolderNote = (tfile: TFile): boolean => {
        // allow for GH-style README.md folder notes, too
        return (
            tfile.path === `${tfile.parent.path}/${tfile.parent.name}.md` ||
            tfile.path === `${tfile.parent.path}/README.md`
        );
    };

    /**
     * Creates a markdown list of files with the specified tag.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {RegExp} pathPattern A pattern that accepted paths should match.
     * @param {boolean} includeCurrent True if the current file should be included in the list (default: false).
     * @returns {string} A markdown list of files.
     * @see filesWithPath
     */
    listFilesWithPath = (
        engine: EngineAPI,
        pathPattern: RegExp,
        includeCurrent = false,
    ): string => {
        const files = this.filesWithPath(pathPattern);
        return files == null || files.length === 0
            ? engine.markdown.create("None")
            : engine.markdown.create(
                  files.map((f) => this.fileListItem(f)).join("\n"),
              );
    };

    /**
     * Creates a markdown list of files that link to the current file.
     * @param {EngineAPI} engine The engine to create markdown.
     * @returns {string} A markdown list of files that link to the current file.
     * @see filesLinkedToFile
     * @see markdownLink
     */
    listInboundLinks = (engine: EngineAPI): string => {
        const current = this.app.workspace.getActiveFile();
        const files = this.filesLinkedToFile(current);
        return files == null || files.length === 0
            ? engine.markdown.create("None")
            : engine.markdown.create(
                  files.map((f) => this.fileListItem(f)).join("\n"),
              );
    };

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
     * Generates a markdown link to the file.
     * @param {TFile} tfile The file to examine.
     * @param {string} displayText An optional display text for the link
     * @param {string} anchor An optional anchor to append to the path
     * @returns {string} A markdown link to the file.
     * @see markdownLinkPath
     * @see fileTitle
     */
    markdownLink = (tfile: TFile, text = "", anchor = ""): string => {
        let displayText = text;
        displayText = displayText || this.fileTitle(tfile);
        return `[${displayText}](/${this.markdownLinkPath(tfile, anchor)})`;
    };

    /**
     * Generates a path with spaces replaced by %20.
     * @param {TFile} tfile The file to examine.
     * @param {string} anchor An optional anchor to append to the path.
     * @returns {string} The path with spaces replaced by %20.
     */
    markdownLinkPath = (tfile: TFile, anchor = ""): string => {
        const hashAnchor = anchor ? `#${anchor}` : "";
        return (tfile.path + hashAnchor).replace(/ /g, "%20");
    };

    /**
     * Generates a markdown list item with the first path segment as a small prefix followed by a markdown link to the file.
     * @param {string} displayText Display text for link
     * @param {string} linkTarget link target
     * @returns {string} A markdown list item with a markdown link
     */
    markdownListItem = (displayText: string, link: string): string => {
        return `- [${displayText}](${link})`;
    };

    /**
     * Try to resolve the file for the given path
     * based on the starting file
     * @param {string} path
     * @param {string} startPath
     * @returns {TFile|null} TFile for the path if it exists
     */
    pathToFile = (path: string, startPath: string): TFile | null => {
        return this.app.metadataCache.getFirstLinkpathDest(path, startPath);
    };

    /**
     * Removes the leading # from a string if present.
     * @param {string} str The string to process.
     * @returns {string} The string with the leading # removed, if it was present.
     */
    removeLeadingHashtag = (str: string): string => {
        if (typeof str !== "string") {
            return str;
        }
        return str.charAt(0) === "#" ? str.substring(1) : str;
    };

    /**
     * Generates a markdown list item with the first path segment as a small prefix followed by a markdown link to the file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} A markdown list item with the first path segment as a small prefix followed by a markdown link to the file.
     */
    scopedFileListItem = (tfile: TFile): string => {
        const s1 = tfile.path.split("/")[0];
        return `- <small>(${s1})</small> ${this.markdownLink(tfile)}`;
    };

    /**
     * Creates a markdown list of files with the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} conditions The conditions to apply.
     * @returns {string} A markdown list of files with the first path segment as leading text.
     * @see filesWithConditions
     * @see scopedFileListItem
     */
    scopedFilesWithConditions = (
        engine: EngineAPI,
        conditions: string | string[],
    ): string => {
        const files = this.filesWithConditions(conditions);
        return files == null || files.length === 0
            ? engine.markdown.create("None")
            : engine.markdown.create(
                  files.map((f) => this.scopedFileListItem(f)).join("\n"),
              );
    };

    /**
     * Generates a markdown list item with small scope text
     * @param {string} scope Scope of the list item
     * @param {string} displayText Display text for link
     * @param {string} link Link target
     * @returns {string} A markdown list item with small text indicating the scope
     */
    scopedListItem = (
        scope: string,
        displayText: string,
        link: string,
    ): string => {
        return `- <small>(${scope})</small> [${displayText}](${link})`;
    };

    scopeRegex = (str: string): RegExp => {
        return new RegExp(`^${str}$`, "i");
    };

    /**
     * Create a regex to match a string by segments.
     * For example, given a/b, a/b/c would match but a/bd would not
     * @param {string} str
     * @returns {RegExp} Regular expression to match segmented strings
     */
    segmentFilterRegex = (str: string): RegExp => {
        return new RegExp(`^${str}(\\/|$)`);
    };

    /**
     * String condition describing a target file:
     * - [[]] current file
     * - wikilink, markdown link, or "***.md" path
     * @param {string} str
     * @returns {TFile|null|undefined} Return file if syntax recognized and file is found;
     *      return null if syntax recognized and file not found;
     *      return undefined if syntax not recognized
     */
    stringConditionToTFile = (str: string): TFile | null | undefined => {
        const current = this.app.workspace.getActiveFile();
        if (str === "[[]]") {
            return current;
        }
        for (const regexp of this.pathConditionPatterns) {
            const match = regexp.exec(str);
            if (match) {
                const result = this.pathToFile(match[1], current.path);
                if (result == null) {
                    console.error(
                        "Unable to find file used in condition",
                        str,
                        match[1],
                        "from",
                        current.path,
                    );
                }
                return result;
            }
        }
        console.error(
            `Unknown condition (not a markdown link, wiki link, or markdown file path): ${str}`,
        );
        return undefined;
    };

    /**
     * Compares the first segment of the path; if those are equal then compares by file name.
     * If a 'sort' field is present in the frontmatter, it is prepended to the filename
     * (not to the path).
     * This allows for a simple grouping of files by parent folder (see scoped* methods)
     * that are alphabetized by name beyond the highest-level folder.
     * @param {TFile} a The first file to compare.
     * @param {TFile} b The second file to compare.
     * @returns {number} A negative number if `a` should come before `b`, a positive number if `a` should come after `b`, or 0 if they are considered equal.
     */
    sortTFile = (a: TFile, b: TFile): number => {
        const p1 = a.path.split("/")[0].toLowerCase();
        const p2 = b.path.split("/")[0].toLowerCase();
        const p = p1.localeCompare(p2);

        return p === 0 ? this.sortTFileByName(a, b) : p;
    };

    /**
     * Compares by file name.
     * If a 'sort' field is present in the frontmatter, it is prepended to the filename
     * @param {TFile} a The first file to compare.
     * @param {TFile} b The second file to compare.
     * @returns {number} A negative number if `a` should come before `b`, a positive number if `a` should come after `b`, or 0 if they are considered equal.
     */
    sortTFileByName = (a: TFile, b: TFile): number => {
        const sort1 = this.frontmatter(a).sort || "";
        const sort2 = this.frontmatter(b).sort || "";
        const n1 = sort1 + this.fileTitle(a).toLowerCase();
        const n2 = sort2 + this.fileTitle(b).toLowerCase();
        return n1.localeCompare(n2);
    };

    /**
     * Sorts files by their last modified time (mtime) in descending order.
     * This means the most recently modified files will appear first.
     * @param {TFile} a The first file to compare.
     * @param {TFile} b The second file to compare.
     * @returns {number} A negative number if `a` was modified after `b`,
     *                   a positive number if `a` was modified before `b`,
     *                   or 0 if they were modified at the same time.
     */
    sortTFileByMtime = (a: TFile, b: TFile): number => {
        let diff = b.stat.mtime - a.stat.mtime;
        if (diff === 0) {
            diff = b.stat.ctime - a.stat.ctime;
            if (diff === 0) {
                diff = this.sortTFileByName(a, b);
            }
        }
        return diff;
    };

    /**
     * Looks for daily notes within the chronicles directory.
     * If the note is for a day within the provided range, adds its tags
     * to the collected list (all tags, not a set).
     * @param {Moment} begin The beginning date (inclusive).
     * @param {Moment} end The ending date (inclusive).
     * @returns {Array} A list of tags found in daily notes for the date range.
     */
    tagsForDates = async (begin: Moment, end: Moment): Promise<string[]> => {
        const tagsByFile = this.tagsForDatesByFile(begin, end, []);
        return Array.from(tagsByFile.values()).flat();
    };

    /**
     * Returns tags grouped by file for daily notes within the chronicles directory.
     * @param {Moment} begin The beginning date (inclusive).
     * @param {Moment} end The ending date (inclusive).
     * @param {string | string[]} conditions Additional conditions to filter files (currently unused but kept for future extensibility).
     * @returns {Map<TFile, string[]>} A map of TFile to tags for that file.
     */
    tagsForDatesByFile = (
        begin: Moment,
        end: Moment,
        conditions: string | string[],
    ): Map<TFile, string[]> => {
        const result = new Map<TFile, string[]>();

        const files = this.app.vault
            .getMarkdownFiles()
            .filter(
                (f) =>
                    f.path.includes("chronicles") &&
                    f.name.match(/^\d{4}-\d{2}-\d{2}\.md$/),
            )
            .filter((f) => {
                const day = window.moment(f.name.replace(".md", ""));
                return (
                    day.isSameOrAfter(begin, "day") &&
                    day.isSameOrBefore(end, "day")
                );
            });

        for (const file of files) {
            const tags = this.fileTags(file);
            result.set(file, tags);
        }

        return result;
    };

    /**
     * Create a filter matching nested tags
     * @param {String} tag
     * @returns Regular expression to match nested/segmented tags
     * @see segmentFilterRegex
     */
    tagFilterRegex = (tag: string): RegExp => {
        const cleanedTag = this.removeLeadingHashtag(tag);
        return this.segmentFilterRegex(cleanedTag);
    };

    /**
     * Show a file suggester modal to let the user choose from a list of files
     * Replaces tp.system.suggester() functionality
     */
    async showFileSuggester(
        files: string[],
        placeholder = "Choose file",
    ): Promise<string | null> {
        return new Promise((resolve, reject) => {
            let submitted = false;

            const modal = new (class extends window.customJS.obsidian
                .SuggestModal<string> {
                getSuggestions(query: string): string[] {
                    return files.filter((file) =>
                        file.toLowerCase().includes(query.toLowerCase()),
                    );
                }

                renderSuggestion(file: string, el: HTMLElement) {
                    el.createEl("div", { text: file });
                }

                selectSuggestion(
                    value: string,
                    evt: MouseEvent | KeyboardEvent,
                ) {
                    submitted = true;
                    this.close();
                    resolve(value);
                }

                onChooseSuggestion(
                    file: string,
                    evt: MouseEvent | KeyboardEvent,
                ) {
                    // This is called after selectSuggestion
                }

                onClose() {
                    if (!submitted) {
                        resolve(null);
                    }
                }
            })(this.app);

            modal.setPlaceholder(placeholder);
            modal.open();
        });
    }

    /**
     * Get the current active selection or empty string
     * Provides consistent selection handling across commands
     */
    getActiveSelection(): { text: string; hasSelection: boolean } {
        const activeView = this.app.workspace.getActiveViewOfType(
            window.customJS.obsidian.MarkdownView,
        );

        if (!activeView?.editor) {
            return { text: "", hasSelection: false };
        }

        const hasSelection = activeView.editor.somethingSelected();
        const text = hasSelection ? activeView.editor.getSelection() : "";

        return { text, hasSelection };
    }

    /**
     * Get cached list of files that can be push targets.
     * Pre-finds matched headings to avoid re-searching when cache is stale.
     * Moved from Templates class to Utils for reusability
     */
    getCachedPushTargets = async (): Promise<string[]> => {
        const now = Date.now();

        if (this.fileCache && now - this.fileCache.timestamp < this.cacheTTL) {
            console.log("Using cached files");
            return this.fileCache.data;
        }

        console.log("Refreshing file cache");
        const files = this.filesMatchingCondition((file) => {
            const isAssets = file.path.contains("assets/");
            const isConversation = file.path.contains("conversations/");
            const isChronicles = file.path.contains("chronicles/");
            const isWeekly = file.path.contains("_week.md");
            const isNotArchived = !file.path.contains("archives/");
            let hasRelevantHeadings = false;

            if (isAssets) {
                return false;
            }

            if (isNotArchived) {
                const fileHeadings = this.app.metadataCache.getCache(
                    file.path,
                )?.headings;
                hasRelevantHeadings = fileHeadings
                    ? fileHeadings
                          .filter((x) => x.level === 2)
                          .some((x) => x.heading.match(/(Log|Task)/))
                    : false;
            }

            return (
                isConversation ||
                (isChronicles && isWeekly) ||
                (!isChronicles && isNotArchived && hasRelevantHeadings)
            );
        }, false).map((f) => f.path);

        this.fileCache = { data: files, timestamp: now };
        return files;
    };
}

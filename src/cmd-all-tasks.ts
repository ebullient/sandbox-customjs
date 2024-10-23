import { App, FrontMatterCache, HeadingCache, TFile } from "obsidian";
import { CompareFn, Utils } from "./_utils";
import { AreaPriority } from "./priority";

interface FileCacheInfo {
    file: TFile;
    taskHeading: HeadingCache;
    frontmatter: FrontMatterCache;
}

export class AllTasks {
    RENDER_TASKS = /([\s\S]*?<!--\s*ALL TASKS BEGIN\s*-->)[\s\S]*?(<!--\s*ALL TASKS END\s*-->[\s\S]*?)/i;

    targetFile = "all-tasks.md";

    ignoreFiles = [
        this.targetFile,
    ];

    includePaths = [
        'demesne/',
        'quests/'
    ];

    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded AllTasks");
    }

    utils = (): Utils => window.customJS.Utils;

    /**
     * Find all "Tasks" sections in the specified paths.
     * Replace the TASKS section of of the "All Tasks" file with the
     * list of embedded sections sorted by status and priority
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    async invoke(): Promise<void> {
        console.log("Finding all tasks");
        const ap = window.customJS.AreaPriority;

        const allTasks = this.app.vault.getFileByPath(this.targetFile);
        if (!allTasks) {
            console.log(`${this.targetFile} file not found`);
            return;
        }

        // Find all markdown files that are not in the ignore list
        const text = this.app.vault.getMarkdownFiles()
            .filter(x => this.includePaths.some(p => x.path.startsWith(p)))
            .filter(x => !this.ignoreFiles.includes(x.path))
            .map(file => this.getFileCacheInfo(file))
            .filter(cacheInfo => cacheInfo.taskHeading && cacheInfo.frontmatter.status != "ignore")
            .sort((a, b) => this.sortProjects(ap, a, b))
            .map(cacheInfo => {
                const priority = ap.filePriority(cacheInfo.file);
                const status = ap.fileStatus(cacheInfo.file);
                const role = ap.fileRole(cacheInfo.file);
                const title = this.utils().fileTitle(cacheInfo.file);
                const linkPath = this.utils().markdownLinkPath(cacheInfo.file, cacheInfo.taskHeading.heading);
                console.log("task section", title, linkPath, cacheInfo);
                return `\n#### <span class="project-status">[${status}&nbsp;${priority}&nbsp;${role}](${linkPath})</span> ${title}\n\n![invisible-embed](${linkPath})\n`;
            })
            .join("\n");


        await this.app.vault.process(allTasks, (source) => {
            const match = this.RENDER_TASKS.exec(source);
            if (match) {
                source = match[1];
                source += text;
                source += match[2];
            }
            return source;
        });
    }

    /**
     * @param {TFile} file to inspect
     * @returns {FileCacheInfo} containing the file, taskHeading, and frontmatter
     */
    getFileCacheInfo(file: TFile): FileCacheInfo {
        const cache = this.app.metadataCache.getFileCache(file);
        return {
            file: file,
            taskHeading: cache.headings?.find(x => x.heading.endsWith("Tasks")),
            frontmatter: cache.frontmatter || {}
        };
    }

    /**
     * Sorts projects based on priority, status, group, and name.
     * @param {FileCacheInfo} a The first project to compare.
     * @param {FileCacheInfo} b The second project to compare.
     * @returns {number} A negative number if a should come before b,
     *      a positive number if a should come after b, or
     *      0 if they are considered equal.
     */
    sortProjects = (ap: AreaPriority, a: FileCacheInfo, b: FileCacheInfo): number => {
        return ap.testPriority(a.frontmatter, b.frontmatter,
            () => ap.test(a.frontmatter, b.frontmatter, ap.status, 'status',
                () => this.testGroup(a.frontmatter, b.frontmatter,
                    () => ap.testName(a.file, b.file))));
    };

    /**
     * Compares two files based on their group and a fallback function.
     * @param {FrontMatterCache} fm1 The frontmatter of the first file.
     * @param {FrontMatterCache} fm2 The frontmatter of the second file.
     * @param {CompareFn} fallback The fallback function to use if the group values are equal.
     * @returns {number} A negative number if tfile1 should come before tfile2,
     *      a positive number if tfile1 should come after tfile2, or
     *      the result of the fallback function if they are considered equal.
     */
    testGroup = (fm1: FrontMatterCache, fm2: FrontMatterCache, fallback: CompareFn): number => {
        const test1 = fm1.group;
        const test2 = fm2.group;

        if (test1 == test2) {
            return fallback();
        }

        // Handle cases where either test1 or test2 is undefined
        if (test1 === undefined) {
            return 1; // if test1 is undefined, it moves toward the beginning
        } else if (test2 === undefined) {
            return -1; // if test2 is undefined, it moves toward the end
        }

        // Compare the values (as strings) if both are defined
        return test1.localeCompare(test2);
    }
}

import type { App, FrontMatterCache, HeadingCache, TFile } from "obsidian";
import type { TaskIndex } from "./@types/taskIndex.types";
import type { Utils } from "./_utils";

interface FileCacheInfo {
    file: TFile;
    taskHeading: HeadingCache;
    frontmatter: FrontMatterCache;
}

export class AllTasks {
    RENDER_TASKS =
        /([\s\S]*?<!--\s*ALL TASKS BEGIN\s*-->)[\s\S]*?(<!--\s*ALL TASKS END\s*-->[\s\S]*?)/i;

    targetFile = "all-tasks.md";

    ignoreFiles = [this.targetFile];

    includePaths = ["demesne/", "quests/"];

    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded AllTasks");
    }

    utils = (): Utils => window.customJS.Utils;
    taskIndex = (): TaskIndex => window.taskIndex.api;

    /**
     * Find all "Tasks" sections in the specified paths.
     * Replace the TASKS section of of the "All Tasks" file with the
     * list of embedded sections sorted by sphere, role, and name
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     */
    async invoke(): Promise<void> {
        console.log("Finding all tasks");
        const ar = window.customJS.AreaRelated;

        const allTasks = this.app.vault.getFileByPath(this.targetFile);
        if (!allTasks) {
            console.log(`${this.targetFile} file not found`);
            return;
        }

        // Find all markdown files that are not in the ignore list
        const projectsWithTasks = this.app.vault
            .getMarkdownFiles()
            .filter((x) => this.includePaths.some((p) => x.path.startsWith(p)))
            .filter((x) => !this.ignoreFiles.includes(x.path))
            .map((file) => this.getFileCacheInfo(file))
            .filter((cacheInfo) => cacheInfo.taskHeading)
            .sort((a, b) => this.sortProjects(a, b));

        // Group by sphere
        const bySphere = new Map<string, FileCacheInfo[]>();
        for (const cacheInfo of projectsWithTasks) {
            const sphere = cacheInfo.frontmatter.sphere || "(no sphere)";
            if (!bySphere.has(sphere)) {
                bySphere.set(sphere, []);
            }
            bySphere.get(sphere).push(cacheInfo);
        }

        // Generate text with sphere headings
        const parts: string[] = [];
        for (const [sphere, projects] of bySphere) {
            parts.push(`\n### ${sphere}\n`);

            for (const cacheInfo of projects) {
                const role = ar.fileRole(cacheInfo.file);
                const title = this.utils().fileTitle(cacheInfo.file);
                const linkPath = this.utils().markdownLinkPath(
                    cacheInfo.file,
                    cacheInfo.taskHeading.heading,
                );
                console.log("task section", title, linkPath, cacheInfo);
                parts.push(
                    `\n#### <span class="project-status">[${role}](${linkPath})</span> ${title}\n\n![invisible-embed](${linkPath})\n`,
                );
            }
        }

        const text = parts.join("");

        await this.app.vault.process(allTasks, (src) => {
            let source = src;
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
            taskHeading: cache.headings?.find((x) =>
                x.heading.endsWith("Tasks"),
            ),
            frontmatter: cache.frontmatter || {},
        };
    }

    /**
     * Sorts projects based on sphere, role, group, and name.
     * @param {FileCacheInfo} a The first project to compare.
     * @param {FileCacheInfo} b The second project to compare.
     * @returns {number} A negative number if a should come before b,
     *      a positive number if a should come after b, or
     *      0 if they are considered equal.
     */
    sortProjects = (a: FileCacheInfo, b: FileCacheInfo): number => {
        // First sort by sphere
        const sphereA = a.frontmatter.sphere || "(no sphere)";
        const sphereB = b.frontmatter.sphere || "(no sphere)";
        const sortSphere = sphereA.localeCompare(sphereB);
        if (sortSphere !== 0) {
            return sortSphere;
        }

        // Then sort by role
        const sortRole = this.taskIndex().compareRoles(
            a.frontmatter.role,
            b.frontmatter.role,
        );
        if (sortRole !== 0) {
            return sortRole;
        }

        // Finally by name
        return a.file.name.localeCompare(b.file.name);
    };
}

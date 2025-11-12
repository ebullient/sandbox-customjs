import type { Moment } from "moment";
import type { App, HeadingCache, TFile } from "obsidian";
import * as CommonPatterns from "./taskindex-CommonPatterns";
import * as LogParser from "./taskindex-LogParser";

/**
 * Task processing engine for collection, filtering, and formatting operations
 * Consolidates logic from tasks.ts and cmd-all-tasks.ts
 */

interface FileCacheInfo {
    file: TFile;
    taskHeading: HeadingCache | undefined;
    sphere: string;
    role: string;
}

export class TaskEngine {
    private taskPaths = ["demesne/", "quests/"];

    constructor(private app: App) {}

    /**
     * Get tasks from a specific file
     */
    async getFileTasks(file: TFile): Promise<string[]> {
        const tasks: string[] = [];
        const content = await this.app.vault.cachedRead(file);
        const lines = content.split("\n");

        for (const line of lines) {
            if (CommonPatterns.isTaskLine(line)) {
                tasks.push(line);
            }
        }

        return tasks;
    }

    /**
     * Find all completed tasks within a date range
     * Groups by sphere and returns formatted markdown
     */
    async findCompletedTasksInRange(
        begin: Moment,
        end: Moment,
        tagFilter?: string | string[],
        matchAll = false,
        removeTriageTags = false,
        excludeFile?: TFile,
    ): Promise<string> {
        const startDate = begin.format("YYYY-MM-DD");
        const endDate = end.format("YYYY-MM-DD");

        // Get all quest/project files
        const files = this.app.vault
            .getMarkdownFiles()
            .filter((f) => {
                if (excludeFile && f.path === excludeFile.path) {
                    return false;
                }
                if (
                    f.path.includes("archive") ||
                    f.path.includes("-test") ||
                    f.path.includes("all-tasks.md")
                ) {
                    return false;
                }
                return this.taskPaths.some((p) => f.path.startsWith(p));
            })
            .filter((f) => {
                return tagFilter
                    ? LogParser.fileMatchesTag(
                          this.app,
                          f,
                          tagFilter as string,
                          matchAll,
                      )
                    : true;
            });

        // Parse all completed tasks from all files
        const allTasks: LogParser.CompletedTask[] = [];
        for (const file of files) {
            const tasks = await LogParser.parseCompletedTasksFromFile(
                this.app,
                file,
            );
            allTasks.push(...tasks);
        }

        // Filter by date range
        const tasksInRange = LogParser.filterTasksByDateRange(
            allTasks,
            startDate,
            endDate,
        );

        // Group by sphere and generate markdown
        const groupedTasks = LogParser.groupTasksBySphere(
            tasksInRange,
            removeTriageTags,
        );

        return LogParser.generateMarkdown(groupedTasks, startDate, endDate);
    }

    /**
     * Generate completed tasks for a week (Monday-Sunday)
     * Used by weekly planning files
     */
    async generateWeeklyTasks(current: TFile): Promise<string> {
        const titledate = current.name.replace(".md", "").replace("_week", "");
        const begin = window.moment(titledate).day(1); // Monday
        const end = begin.clone().add(6, "d");

        return this.findCompletedTasksInRange(
            begin,
            end,
            undefined,
            false,
            false,
            current,
        );
    }

    /**
     * Generate completed tasks for a fixed date range with optional tag filter
     * Used by retrospective/review files
     */
    async generateFixedWeekTasks(
        current: TFile,
        startDate: string,
        tag?: string | string[],
        all = false,
    ): Promise<string> {
        const begin = window.moment(startDate); // exact day
        const end = begin.clone().add(6, "d");

        return this.findCompletedTasksInRange(
            begin,
            end,
            tag,
            all,
            true, // Remove triage tags for cleaner retrospectives
            current,
        );
    }

    /**
     * Find all files with "Tasks" sections
     * Used for generating all-tasks.md
     */
    getProjectsWithTaskSections(
        includePaths: string[] = this.taskPaths,
        ignoreFiles: string[] = ["all-tasks.md"],
    ): FileCacheInfo[] {
        return this.app.vault
            .getMarkdownFiles()
            .filter((f) => includePaths.some((p) => f.path.startsWith(p)))
            .filter((f) => !ignoreFiles.includes(f.path))
            .map((file) => this.getFileCacheInfo(file))
            .filter((info) => info.taskHeading !== undefined)
            .sort((a, b) => this.sortProjects(a, b));
    }

    /**
     * Generate markdown for all-tasks.md file
     * Embeds task sections grouped by sphere
     */
    generateAllTasksMarkdown(projects: FileCacheInfo[]): string {
        // Group by sphere
        const bySphere = new Map<string, FileCacheInfo[]>();
        for (const project of projects) {
            const sphere = project.sphere || "(no sphere)";
            if (!bySphere.has(sphere)) {
                bySphere.set(sphere, []);
            }
            bySphere.get(sphere)?.push(project);
        }

        // Generate text with sphere headings
        const parts: string[] = [];
        for (const [sphere, sphereProjects] of bySphere) {
            parts.push(`\n### ${sphere}\n`);

            for (const info of sphereProjects) {
                const role = info.role;
                const title = this.getFileTitle(info.file);
                const linkPath = this.getMarkdownLinkPath(
                    info.file,
                    info.taskHeading?.heading || "Tasks",
                );

                parts.push(
                    `\n#### <span class="project-status">[${role}](${linkPath})</span> ${title}\n\n![invisible-embed](${linkPath})\n`,
                );
            }
        }

        return parts.join("");
    }

    /**
     * Get file cache info including task heading and frontmatter
     */
    private getFileCacheInfo(file: TFile): FileCacheInfo {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter || {};

        return {
            file: file,
            taskHeading: cache?.headings?.find((h) =>
                h.heading.endsWith("Tasks"),
            ),
            sphere: frontmatter.sphere || "(no sphere)",
            role: frontmatter.role || "??",
        };
    }

    /**
     * Sort projects by sphere, role, and name
     */
    private sortProjects(a: FileCacheInfo, b: FileCacheInfo): number {
        // First by sphere
        const sortSphere = a.sphere.localeCompare(b.sphere);
        if (sortSphere !== 0) {
            return sortSphere;
        }

        // Then by role (using TaskIndex API if available)
        if (window.taskIndex?.api?.compareRoles) {
            const sortRole = window.taskIndex.api.compareRoles(a.role, b.role);
            if (sortRole !== 0) {
                return sortRole;
            }
        }

        // Finally by name
        return a.file.name.localeCompare(b.file.name);
    }

    /**
     * Get display title for a file (from frontmatter aliases or basename)
     */
    private getFileTitle(file: TFile): string {
        const cache = this.app.metadataCache.getFileCache(file);
        const aliases = cache?.frontmatter?.aliases;
        if (aliases && Array.isArray(aliases) && aliases.length > 0) {
            return aliases[0];
        }
        return file.basename;
    }

    /**
     * Generate markdown link path with section anchor
     */
    private getMarkdownLinkPath(file: TFile, heading: string): string {
        const anchor = heading.replace(/\s/g, "%20");
        return `${file.path}#${anchor}`;
    }
}

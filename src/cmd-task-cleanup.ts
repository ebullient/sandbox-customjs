import type { Moment } from "moment";
import type { App, HeadingCache, TFile } from "obsidian";

export class TaskCleanup {
    taskPattern = /^([\s>]*- )\[(.)\] (.*)$/;
    completedPattern = /\(((\d{4})-\d{2}-\d{2})\)/;
    dailyNotePattern = /((\d{4})-\d{2}-\d{2})\.md/;
    archiveLinkPattern = /^- \[.*-log-(\d{4})\]\(.*\)$/;

    done = /^[\s>]*- (✔️|〰️) .*$/;
    list = /^[\s>]*- .*$/;

    app: App;

    constructor() {
        // Constructor
        this.app = window.customJS.app;
        console.log("loaded TaskCleanup");
    }

    /**
     * Clean up (remove task nature of) old tasks in markdown files.
     * @returns {Promise<void>}
     */
    async invoke(): Promise<void> {
        console.log("Cleaning up old tasks");
        const monthMoment = window.moment().startOf("month");

        console.log(
            "Cleaning up tasks before",
            monthMoment.format("(YYYY-MM-"),
        );

        // Map each file to the result of a cached read
        const promises = this.app.vault
            .getMarkdownFiles()
            .filter(
                (file) =>
                    !file.name.match(this.dailyNotePattern) &&
                    !file.path.startsWith("assets"),
            )
            .filter(
                (file) => this.app.metadataCache.getFileCache(file)?.headings,
            )
            .map((file) => {
                const fileCache = this.app.metadataCache.getFileCache(file);
                const logHeading = fileCache.headings.find((x) =>
                    x.heading.endsWith("Log"),
                );
                return logHeading
                    ? this.updateTasks(file, logHeading, monthMoment)
                    : Promise.resolve();
            });

        // wait for updates to all relevant files
        await Promise.all(promises);
    }

    /**
     * Extract the area name from the file's frontmatter aliases.
     * @param {TFile} file The file to extract the area name from.
     * @returns {string} The first alias from frontmatter, or the basename if no aliases exist.
     */
    extractAreaName = (file: TFile): string => {
        const fileCache = this.app.metadataCache.getFileCache(file);
        const aliases = fileCache?.frontmatter?.aliases;
        if (aliases && Array.isArray(aliases) && aliases.length > 0) {
            return aliases[0];
        }
        return file.basename;
    };

    /**
     * Check if a line is an archive link.
     * @param {string} line The line to check.
     * @returns {boolean} True if the line is an archive link.
     */
    isArchiveLink = (line: string): boolean =>
        this.archiveLinkPattern.test(line);

    /**
     * Create or update an archive file with log entries from a specific year.
     * @param {string} areaName The name of the area (from aliases).
     * @param {string} year The year for the archive.
     * @param {string[]} logEntries The log entries to archive.
     * @param {string} basename The basename of the source file.
     * @param {string} sourceFilePath The path to the source file (relative from vault root).
     * @returns {Promise<void>}
     */
    createOrUpdateArchive = async (
        areaName: string,
        year: string,
        logEntries: string[],
        basename: string,
        sourceFilePath: string,
    ): Promise<void> => {
        const archiveFileName = `${basename}-log-${year}.md`;
        const archivePath = `Ω-archives/area-logs/${archiveFileName}`;

        const frontmatter = [
            "---",
            "type: archive",
            `source: ${sourceFilePath}`,
            `period: ${year}`,
            "---",
        ].join("\n");

        const heading = `# ${areaName} - ${year} log`;
        const content = logEntries.join("\n");

        const existingFile = this.app.vault.getFileByPath(archivePath);

        if (existingFile) {
            // File exists, insert entries after H1
            await this.app.vault.process(existingFile, (source) => {
                const lines = source.split("\n");
                const h1Index = lines.findIndex((line) =>
                    line.startsWith("# "),
                );
                if (h1Index !== -1) {
                    lines.splice(h1Index + 1, 0, "", content);
                }
                return lines.join("\n");
            });
        } else {
            // Create new file
            const fullContent = [frontmatter, heading, "", content, ""].join(
                "\n",
            );

            await this.app.vault.create(archivePath, fullContent);
        }
    };

    /**
     * Update tasks in the Log section of the specified file if the file is older than the specified month.
     * Relies on marked completed tasks: `- [x] task (YYYY-MM-DD)` or `- [-] task (YYYY-MM-DD)`
     * @param {TFile} file The file to update.
     * @param {HeadingCache} logHeading The log heading object containing position information.
     * @param {moment} monthMoment The moment object representing the start of the month.
     * @returns {Promise<void>}
     */
    updateTasks = async (
        file: TFile,
        logHeading: HeadingCache,
        monthMoment: Moment,
    ): Promise<void> => {
        const now = window.moment();
        const currentYear = now.year();
        const shouldArchive = now.month() >= 1; // February or later
        const areaName = this.extractAreaName(file);

        let archiveParams: {
            year: string;
            logEntries: string[];
        } | null = null;

        await this.app.vault.process(file, (source) => {
            const split = source.split("\n");
            let i = logHeading.position.start.line + 1;

            // Track archive range
            let archiveStart: number | null = null;
            let archiveEnd: number | null = null;
            let archiveYear: string | null = null;

            for (; i < split.length; i++) {
                if (split[i].startsWith("#") || split[i] === "---") {
                    break;
                }

                // Check if we hit an existing archive link
                if (this.isArchiveLink(split[i])) {
                    if (archiveStart !== null) {
                        archiveEnd = i - 1;
                    }
                    break;
                }

                if (split[i].match(this.list)) {
                    if (split[i].match(this.done)) {
                        break;
                    }
                    const taskMatch = this.taskPattern.exec(split[i]);
                    if (taskMatch) {
                        let completedMatch = this.completedPattern.exec(
                            taskMatch[3],
                        );
                        if (!completedMatch) {
                            // get date from daily note reference
                            completedMatch = this.dailyNotePattern.exec(
                                taskMatch[3],
                            );
                        }
                        const mark = taskMatch[2];
                        const completed = completedMatch
                            ? window.moment(completedMatch[1])
                            : null;

                        // Track first previous year task for archiving
                        if (shouldArchive && completedMatch) {
                            const year = completedMatch[2];
                            if (
                                year < currentYear.toString() &&
                                archiveStart === null
                            ) {
                                archiveStart = i;
                                archiveYear = year;
                            }
                        }

                        // Cleanup old tasks
                        if (completed?.isBefore(monthMoment)) {
                            if (mark === "x") {
                                split[i] = `${taskMatch[1]} ✔️ ${taskMatch[3]}`;
                            } else {
                                split[i] =
                                    `${taskMatch[1]} 〰️ ~~${taskMatch[3]}~~`;
                            }
                        }
                    }
                }
            }

            // Close archive range if we reached end
            if (archiveStart !== null && archiveEnd === null) {
                archiveEnd = i - 1;
            }

            // Collect archive parameters if we found old tasks
            if (
                archiveStart !== null &&
                archiveEnd !== null &&
                archiveYear !== null
            ) {
                const logEntries = split.slice(archiveStart, archiveEnd + 1);
                archiveParams = { year: archiveYear, logEntries };

                // Replace lines with archive link
                const archiveLink = `- [${file.basename}-log-${archiveYear}](Ω-archives/area-logs/${file.basename}-log-${archiveYear}.md)`;
                split.splice(
                    archiveStart,
                    archiveEnd - archiveStart + 1,
                    archiveLink,
                );
            }

            return split.join("\n");
        });

        // Create archive after file update completes
        if (archiveParams) {
            await this.createOrUpdateArchive(
                areaName,
                archiveParams.year,
                archiveParams.logEntries,
                file.basename,
                file.path,
            );
        }
    };
}

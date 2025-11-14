import type { Moment } from "moment";
import type { App, HeadingCache, TFile } from "obsidian";
import * as CommonPatterns from "./taskindex-CommonPatterns";

/**
 * Validation issue types
 */
export type ValidationIssueType =
    | "date-order"
    | "duplicate-line"
    | "broken-archive-link";

export interface ValidationIssue {
    type: ValidationIssueType;
    file: TFile;
    lineNumber: number;
    message: string;
    line?: string;
}

type ProcessLogFn = (
    file: TFile,
    logHeading: HeadingCache,
    monthMoment: Moment,
) => Promise<void>;

/**
 * Archives completed tasks from quest/area Log sections
 * Denatures old completed tasks (removes task checkbox) and moves previous years to archive files
 * Also validates Log sections for data integrity issues
 */
export class TaskArchiver {
    constructor(
        private app: App,
        private readonly minArchiveLines: number = 50,
    ) {}

    /**
     * Clean up old tasks across all quest/area files
     * - Denatures tasks older than start of current month (converts to emoji)
     * - Archives tasks from previous years to separate files (February+)
     */
    async cleanupAllQuests(): Promise<void> {
        return await this.iterateAllQuests(this.cleanupQuestLog.bind(this));
    }

    async validateAllQuests(): Promise<void> {
        return await this.iterateAllQuests(this.validateQuestLog.bind(this));
    }

    async iterateAllQuests(logFn: ProcessLogFn): Promise<void> {
        console.log("Cleaning up old tasks in quest/area files");
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
                    !file.name.match(CommonPatterns.DAILY_NOTE_REGEX) &&
                    !file.path.startsWith("assets"),
            )
            .filter((file) => {
                const cache = this.app.metadataCache.getFileCache(file);
                return cache?.headings?.some((h) => h.heading.endsWith("Log"));
            })
            .map((file) => {
                const cache = this.app.metadataCache.getFileCache(file);
                const logHeading = cache?.headings?.find((h) =>
                    h.heading.endsWith("Log"),
                );
                return logHeading
                    ? logFn(file, logHeading, monthMoment)
                    : Promise.resolve();
            });

        // Wait for updates to all relevant files
        await Promise.all(promises);
    }

    /**
     * Extract the area name from the file's frontmatter aliases
     */
    private extractAreaName(file: TFile): string {
        const cache = this.app.metadataCache.getFileCache(file);
        const aliases = cache?.frontmatter?.aliases;
        if (aliases && Array.isArray(aliases) && aliases.length > 0) {
            return aliases[0];
        }
        return file.basename;
    }

    /**
     * Create or update an archive file with log entries from a specific year
     */
    private async createOrUpdateArchive(
        areaName: string,
        year: string,
        logEntries: string[],
        basename: string,
        sourceFilePath: string,
    ): Promise<void> {
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
    }

    /**
     * Update tasks in the Log section of the specified file
     * - Converts old completed tasks to emoji (✔️ for done, 〰️ for cancelled)
     * - Collects previous year tasks for archiving (if February or later)
     */
    private async cleanupQuestLog(
        file: TFile,
        logHeading: HeadingCache,
        monthMoment: Moment,
    ): Promise<void> {
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
            let archiving = false;
            const currentYearString = currentYear.toString();

            for (; i < split.length; i++) {
                const line = split[i];

                // Stop at next heading or frontmatter
                if (line.startsWith("#") || line === "---") {
                    break;
                }

                // Check if we hit an existing archive link
                if (CommonPatterns.isArchiveLink(line)) {
                    console.log(
                        "QuestArchiver: existing archive link encountered",
                        file.path,
                        line.trim(),
                    );
                    if (archiveStart !== null) {
                        archiveEnd = i - 1;
                    }
                    break;
                }

                // Only interested in list entries inside the Log section
                if (!CommonPatterns.LIST_ITEM_REGEX.test(line)) {
                    continue;
                }

                const completionDate =
                    CommonPatterns.extractCompletionDate(line);
                const year =
                    completionDate &&
                    CommonPatterns.extractYear(completionDate);
                const completedMoment =
                    completionDate && window.moment(completionDate);

                // Track first previous-year task for archiving, even if already denatured
                if (shouldArchive && year && year < currentYearString) {
                    if (!archiving) {
                        archiveStart = i;
                        archiveYear = year;
                        archiving = true;
                    }
                    archiveEnd = i;
                } else if (archiving) {
                    // Encountered a newer entry after archive block; stop scanning
                    break;
                }

                // Convert checkbox tasks older than current month to emoji entries
                if (
                    completedMoment?.isBefore(monthMoment) &&
                    CommonPatterns.isTaskLine(line)
                ) {
                    const parsed = CommonPatterns.parseTaskLine(line);
                    if (parsed) {
                        split[i] =
                            parsed.status === "x"
                                ? `${parsed.indent}- ✔️ ${parsed.text}`
                                : `${parsed.indent}- 〰️ ~~${parsed.text}~~`;
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

                // Check threshold BEFORE modifying the file
                if (logEntries.length <= this.minArchiveLines) {
                    console.log(
                        "QuestArchiver: skip archive (below threshold)",
                        file.path,
                        `year=${archiveYear}`,
                        `${logEntries.length} lines`,
                    );
                    // Don't set archiveParams, don't modify file
                } else {
                    archiveParams = { year: archiveYear, logEntries };

                    // Replace lines with archive link
                    const archiveLink = `- [${file.basename}-log-${archiveYear}](Ω-archives/area-logs/${file.basename}-log-${archiveYear}.md)`;
                    split.splice(
                        archiveStart,
                        archiveEnd - archiveStart + 1,
                        archiveLink,
                    );
                }
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
            console.log(
                "QuestArchiver: archived log segment",
                file.path,
                `year=${archiveParams.year}`,
                `${archiveParams.logEntries.length} lines`,
            );
        }
    }

    private async validateQuestLog(
        file: TFile,
        logHeading: HeadingCache,
        _monthMoment: Moment,
    ): Promise<void> {
        const content = await this.app.vault.read(file);
        const lines = content.split("\n");

        let i = logHeading.position.start.line + 1;
        const seenLines = new Set<string>();
        let previousDate: string | null = null;

        for (; i < lines.length; i++) {
            const line = lines[i];

            // Stop at next heading or frontmatter
            if (line.startsWith("#") || line === "---") {
                break;
            }

            // Skip empty lines
            if (!line.trim()) {
                continue;
            }

            // Check for broken archive links
            if (CommonPatterns.isArchiveLink(line)) {
                const archivePath = line.match(/\((.*?)\)/)?.[1];
                if (archivePath) {
                    const archiveFile =
                        this.app.vault.getFileByPath(archivePath);
                    if (!archiveFile) {
                        console.log(
                            `🔗 Broken archive link: ${file.path}:${i + 1} - ${archivePath}`,
                        );
                    }
                }
                break; // Archive link marks end of current content
            }

            // Only check outermost list items (no leading whitespace)
            if (!line.match(/^- /)) {
                continue;
            }

            // Check for duplicate lines
            const normalizedLine = line.trim();
            if (seenLines.has(normalizedLine)) {
                console.log(
                    `🔄 Duplicate line: ${file.path}:${i + 1} - ${normalizedLine}`,
                );
            }
            seenLines.add(normalizedLine);

            // Check for date order violations (only on outermost tasks)
            const completionDate = CommonPatterns.extractCompletionDate(line);
            if (completionDate) {
                if (previousDate && completionDate > previousDate) {
                    console.log(
                        `📅 Date order violation: ${file.path}:${i + 1} - ${completionDate} after ${previousDate}`,
                    );
                }
                previousDate = completionDate;
            }
        }
    }
}

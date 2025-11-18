import { type FuzzyMatch, FuzzySuggestModal, type TFile } from "obsidian";
import type { DatedFileEntry } from "./@types";
import type { TaskIndexPlugin } from "./taskindex-Plugin";

/**
 * Modal for selecting dated files (daily, weekly, monthly, yearly notes)
 * Provides quick access to recent dated files and a full list
 */
export class DatedFileModal extends FuzzySuggestModal<DatedFileEntry> {
    // Regex patterns for identifying dated files
    patterns = {
        daily: /^chronicles\/(\d{4})\/(\d{4}-\d{2}-\d{2})\.md$/,
        weekly: /^chronicles\/(\d{4})\/(\d{4}-\d{2}-\d{2})_week\.md$/,
        monthly: /^chronicles\/(\d{4})\/(\d{4}-\d{2})_month\.md$/,
        yearly: /^chronicles\/(\d{4})\/(\d{4})\.md$/,
        journalDaily:
            /^chronicles\/journal\/(\d{4})\/journal-(\d{4}-\d{2}-\d{2})\.md$/,
        journalWeekly:
            /^chronicles\/journal\/(\d{4})\/journal-(\d{4}-\d{2}-\d{2})_week\.md$/,
    };

    constructor(private plugin: TaskIndexPlugin) {
        super(plugin.app);
        this.setPlaceholder("Choose dated file");
    }

    getItems(): DatedFileEntry[] {
        const today = window.moment();

        // Build quick access entries
        const quickAccess = this.buildQuickAccessEntries(today);

        // Gather all dated files
        const datedFiles = this.gatherDatedFiles();

        // Sort by date (most recent first)
        datedFiles.sort((a, b) => {
            const dates = b.date.localeCompare(a.date);
            if (dates === 0) {
                return a.type.localeCompare(b.type);
            }
            return dates;
        });

        // Combine quick access + dated files
        return [...quickAccess, ...datedFiles];
    }

    getItemText(entry: DatedFileEntry): string {
        return entry.displayText;
    }

    renderSuggestion(item: FuzzyMatch<DatedFileEntry>, el: HTMLElement): void {
        const entry = item.item;

        el.createEl("span", {
            text: `${entry.icon || " "} `,
            cls: "dated-icon",
        });

        el.createEl("span", {
            text: entry.displayText,
            cls: "dated-date",
        });

        // Show type if present
        if (entry.type) {
            el.createEl("span", {
                text: entry.type,
                cls: "dated-type",
            });
        }
    }

    onChooseItem(
        entry: DatedFileEntry,
        _evt: MouseEvent | KeyboardEvent,
    ): void {
        // Open the file
        this.app.workspace.openLinkText(entry.file.path, "", true, {
            state: { mode: "source" },
        });
    }

    /**
     * Build quick access entries for today, yesterday, this week, this month, this year
     */
    buildQuickAccessEntries(today: moment.Moment): DatedFileEntry[] {
        const entries: DatedFileEntry[] = [];
        const formatPath = (pattern: string, date: moment.Moment) =>
            date.format(pattern);

        // Today (daily note)
        const todayPath = formatPath(
            "[chronicles/]YYYY/YYYY-MM-DD[.md]",
            today,
        );
        const todayFile = this.app.vault.getFileByPath(todayPath);
        if (todayFile) {
            entries.push({
                displayText: "Today",
                file: todayFile,
                date: today.format("YYYY-MM-DD"),
                icon: "📅",
            });
        }

        // Today (journal)
        const todayJournalPath = formatPath(
            "[chronicles/journal/]YYYY/[journal-]YYYY-MM-DD[.md]",
            today,
        );
        const todayJournalFile = this.app.vault.getFileByPath(todayJournalPath);
        if (todayJournalFile) {
            entries.push({
                displayText: "Today",
                file: todayJournalFile,
                date: today.format("YYYY-MM-DD"),
                icon: "✍️",
                type: "journal",
            });
        }

        // Yesterday (daily note)
        const yesterday = today.clone().subtract(1, "day");
        const yesterdayPath = formatPath(
            "[chronicles/]YYYY/YYYY-MM-DD[.md]",
            yesterday,
        );
        const yesterdayFile = this.app.vault.getFileByPath(yesterdayPath);
        if (yesterdayFile) {
            entries.push({
                displayText: "Yesterday",
                file: yesterdayFile,
                date: yesterday.format("YYYY-MM-DD"),
                icon: "📅",
            });
        }

        // Yesterday (journal)
        const yesterdayJournalPath = formatPath(
            "[chronicles/journal/]YYYY/[journal-]YYYY-MM-DD[.md]",
            yesterday,
        );
        const yesterdayJournalFile =
            this.app.vault.getFileByPath(yesterdayJournalPath);
        if (yesterdayJournalFile) {
            entries.push({
                file: yesterdayJournalFile,
                date: yesterday.format("YYYY-MM-DD"),
                icon: "✍️",
                displayText: "Yesterday",
                type: "journal",
            });
        }

        // This week (weekly note - Monday-based)
        const monday = today.clone().startOf("isoWeek");
        const weekPath = formatPath(
            "[chronicles/]YYYY/YYYY-MM-DD[_week.md]",
            monday,
        );
        const weekFile = this.app.vault.getFileByPath(weekPath);
        if (weekFile) {
            entries.push({
                file: weekFile,
                date: monday.format("YYYY-MM-DD"),
                icon: "🗓️",
                displayText: "This Week",
            });
        }

        // This week (journal)
        const weekJournalPath = formatPath(
            "[chronicles/journal/]YYYY/[journal-]YYYY-MM-DD[_week.md]",
            monday,
        );
        const weekJournalFile = this.app.vault.getFileByPath(weekJournalPath);
        if (weekJournalFile) {
            entries.push({
                file: weekJournalFile,
                date: monday.format("YYYY-MM-DD"),
                icon: "📖",
                displayText: "This Week",
                type: "journal",
            });
        }

        // This month (monthly note)
        const monthPath = formatPath(
            "[chronicles/]YYYY/YYYY-MM[_month.md]",
            today,
        );
        const monthFile = this.app.vault.getFileByPath(monthPath);
        if (monthFile) {
            entries.push({
                file: monthFile,
                date: today.format("YYYY-MM"),
                icon: "🗓️",
                displayText: "This Month",
            });
        }

        // This year (yearly note)
        const yearPath = formatPath("[chronicles/]YYYY/YYYY[.md]", today);
        const yearFile = this.app.vault.getFileByPath(yearPath);
        if (yearFile) {
            entries.push({
                file: yearFile,
                date: today.format("YYYY"),
                icon: "🗓️",
                displayText: "This Year",
            });
        }

        return entries;
    }

    /**
     * Gather all dated files from the vault
     */
    gatherDatedFiles(): DatedFileEntry[] {
        const files = this.app.vault.getMarkdownFiles();
        const entries: DatedFileEntry[] = [];
        const excludeYears = this.plugin.settings.excludeYears;

        for (const file of files) {
            const entry = this.matchDatedFile(file);
            if (entry) {
                // Check if year should be excluded
                const year = Number.parseInt(entry.date.substring(0, 4), 10);
                if (!excludeYears.includes(year)) {
                    entries.push(entry);
                }
            }
        }

        return entries;
    }

    /**
     * Match a file against dated file patterns
     * Returns a DatedFileEntry if it matches, undefined otherwise
     */
    private matchDatedFile(file: TFile): DatedFileEntry | undefined {
        const path = file.path;

        // Daily note
        let match = this.patterns.daily.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: date,
                file,
                date,
                icon: "📅",
                type: "daily",
            };
        }

        // Weekly note
        match = this.patterns.weekly.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: date,
                file,
                date,
                icon: "🗓️",
                type: "weekly",
            };
        }

        // Monthly note
        match = this.patterns.monthly.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: date,
                file,
                date: `${date}-01`,
                icon: "🗓️",
                type: "monthly",
            };
        }

        // Yearly note
        match = this.patterns.yearly.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: date,
                file,
                date: `${date}-01-01`,
                icon: "🗓️",
                type: "yearly",
            };
        }

        // Daily journal
        match = this.patterns.journalDaily.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: date,
                file,
                date,
                icon: "✍️",
                type: "journal",
            };
        }

        // Weekly journal
        match = this.patterns.journalWeekly.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: date,
                file,
                date,
                icon: "📖",
                type: "weekly journal",
            };
        }

        // Work summary - build pattern from config
        const workPattern = this.buildWorkSummaryPattern();
        match = workPattern.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: date,
                file,
                date,
                icon: "📓",
                type: "work summary",
            };
        }

        return undefined;
    }

    /**
     * Build a regex pattern for work summaries from the configured pattern
     * Example: "chronicles/work/YYYY/YYYY-MM-DD_work.md" ->
     *   /^chronicles\/work\/(\d{4})\/(\d{4}-\d{2}-\d{2})_work\.md$/
     */
    private buildWorkSummaryPattern(): RegExp {
        const workSummaryPattern = this.plugin.settings.workSummaryPattern;

        // Escape the pattern and replace moment format tokens with regex
        const pattern = workSummaryPattern
            .replace(/\//g, "\\/")
            .replace(/\./g, "\\.")
            .replace(/YYYY-MM-DD/g, "(\\d{4}-\\d{2}-\\d{2})")
            .replace(/YYYY-MM/g, "(\\d{4}-\\d{2})")
            .replace(/YYYY/g, "(\\d{4})");

        return new RegExp(`^${pattern}$`);
    }
}

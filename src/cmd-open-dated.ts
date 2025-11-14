import type { App, TFile } from "obsidian";
import type { Utils } from "./_utils";

interface DatedConfig {
    excludeYears: number[];
    workSummaryPattern?: string;
}

interface DatedFileEntry {
    displayText: string;
    file: TFile;
    date: string;
}

export class OpenDated {
    app: App;
    configFile = "assets/config/open-dated-config.yaml";

    // Default values (fallback if config file can't be loaded)
    excludeYears: number[] = [];
    workSummaryPattern = "chronicles/work/YYYY/YYYY-MM-DD_work.md";

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
        // Work summary pattern will be built from config
    };

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded OpenDated");
    }

    utils = (): Utils => window.customJS.Utils;

    /**
     * Load configuration from YAML file
     */
    async loadConfig(): Promise<void> {
        try {
            const configFile = this.app.vault.getFileByPath(this.configFile);
            if (!configFile) {
                console.warn(
                    `Missing config file ${this.configFile}, using defaults`,
                );
                return;
            }

            const configText = await this.app.vault.cachedRead(configFile);
            const config = window.customJS.obsidian.parseYaml(
                configText,
            ) as DatedConfig;

            if (config.excludeYears) {
                this.excludeYears = config.excludeYears;
            }
            if (config.workSummaryPattern) {
                this.workSummaryPattern = config.workSummaryPattern;
            }

            console.log(
                "Loaded open-dated configuration from",
                this.configFile,
            );
        } catch (error) {
            console.error("Failed to load open-dated configuration:", error);
            console.log("Using default configuration");
        }
    }

    /**
     * Open a dated file selector
     */
    async invoke(): Promise<void> {
        await this.loadConfig();

        const today = window.moment();

        // Build quick access entries
        const quickAccess = this.buildQuickAccessEntries(today);

        // Gather all dated files
        const datedFiles = this.gatherDatedFiles();

        // Sort by date (most recent first)
        datedFiles.sort((a, b) => b.date.localeCompare(a.date));

        // Combine quick access + dated files
        const allChoices = [
            ...quickAccess.map((e) => e.displayText),
            ...datedFiles.map((e) => e.displayText),
        ];

        // Show file suggester
        const choice = await this.utils().showFileSuggester(
            allChoices,
            "Choose dated file",
        );

        if (!choice) {
            return; // User cancelled
        }

        // Find the selected entry
        let selectedFile: TFile | undefined;

        // Check if it's a quick access item
        const quickEntry = quickAccess.find((e) => e.displayText === choice);
        if (quickEntry) {
            selectedFile = quickEntry.file;
        } else {
            // It's a regular dated file
            const datedEntry = datedFiles.find((e) => e.displayText === choice);
            if (datedEntry) {
                selectedFile = datedEntry.file;
            }
        }

        if (!selectedFile) {
            console.warn("Could not find selected file:", choice);
            return;
        }

        // Open the file
        await this.app.workspace.openLinkText(selectedFile.path, "", true, {
            state: { mode: "source" },
        });
    }

    /**
     * Build quick access entries for today, yesterday, this week, this month, this year
     */
    private buildQuickAccessEntries(today: moment.Moment): DatedFileEntry[] {
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
                displayText: "📅 Today",
                file: todayFile,
                date: today.format("YYYY-MM-DD"),
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
                displayText: "📅 Yesterday",
                file: yesterdayFile,
                date: yesterday.format("YYYY-MM-DD"),
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
                displayText: "📅 This Week",
                file: weekFile,
                date: monday.format("YYYY-MM-DD"),
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
                displayText: "📅 This Month",
                file: monthFile,
                date: today.format("YYYY-MM"),
            });
        }

        // This year (yearly note)
        const yearPath = formatPath("[chronicles/]YYYY/YYYY[.md]", today);
        const yearFile = this.app.vault.getFileByPath(yearPath);
        if (yearFile) {
            entries.push({
                displayText: "📅 This Year",
                file: yearFile,
                date: today.format("YYYY"),
            });
        }

        return entries;
    }

    /**
     * Gather all dated files from the vault
     */
    private gatherDatedFiles(): DatedFileEntry[] {
        const files = this.app.vault.getMarkdownFiles();
        const entries: DatedFileEntry[] = [];

        for (const file of files) {
            const entry = this.matchDatedFile(file);
            if (entry) {
                // Check if year should be excluded
                const year = Number.parseInt(entry.date.substring(0, 4), 10);
                if (!this.excludeYears.includes(year)) {
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
                displayText: `${date} (daily)`,
                file,
                date,
            };
        }

        // Weekly note
        match = this.patterns.weekly.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: `${date} (weekly)`,
                file,
                date,
            };
        }

        // Monthly note
        match = this.patterns.monthly.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: `${date} (monthly)`,
                file,
                date,
            };
        }

        // Yearly note
        match = this.patterns.yearly.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: `${date} (yearly)`,
                file,
                date,
            };
        }

        // Daily journal
        match = this.patterns.journalDaily.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: `${date} (journal)`,
                file,
                date,
            };
        }

        // Weekly journal
        match = this.patterns.journalWeekly.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: `${date} (journal weekly)`,
                file,
                date,
            };
        }

        // Work summary - build pattern from config
        const workPattern = this.buildWorkSummaryPattern();
        match = workPattern.exec(path);
        if (match) {
            const date = match[2];
            return {
                displayText: `${date} (work summary)`,
                file,
                date,
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
        // Escape the pattern and replace moment format tokens with regex
        const pattern = this.workSummaryPattern
            .replace(/\//g, "\\/")
            .replace(/\./g, "\\.")
            .replace(/YYYY-MM-DD/g, "(\\d{4}-\\d{2}-\\d{2})")
            .replace(/YYYY-MM/g, "(\\d{4}-\\d{2})")
            .replace(/YYYY/g, "(\\d{4})");

        return new RegExp(`^${pattern}$`);
    }
}

import { type App, MarkdownView, SuggestModal, type TFile } from "obsidian";
import {
    getDateFromPath,
    WEEKLY_NOTE_REGEX,
    YEARLY_NOTE_REGEX,
} from "./taskindex-CommonPatterns";

/**
 * Context information about a note file
 */
export interface NoteContext {
    path: string;
    date?: string;
    isAssets: boolean;
    isDaily: boolean;
    isWeekly: boolean;
    isYearly: boolean;
    asTask: boolean;
}

/**
 * Selection information from the active editor
 */
export interface ActiveSelection {
    text: string;
    hasSelection: boolean;
}

/**
 * Build a context object describing properties of a note based on its path.
 */
export function getNoteContext(path: string): NoteContext {
    const date = getDateFromPath(path);
    const isAssets = path.includes("assets/");
    const isDaily = Boolean(date);
    const isWeekly = WEEKLY_NOTE_REGEX.test(path);
    const isYearly = YEARLY_NOTE_REGEX.test(path);
    const asTask = !isDaily || isWeekly;

    return {
        path,
        date,
        isAssets,
        isDaily,
        isWeekly,
        isYearly,
        asTask,
    };
}

/**
 * Get the current active selection from the editor.
 * Returns empty text and hasSelection=false if no editor or no selection.
 */
export function getActiveSelection(app: App): ActiveSelection {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);

    if (!activeView?.editor) {
        return { text: "", hasSelection: false };
    }

    const hasSelection = activeView.editor.somethingSelected();
    const text = hasSelection ? activeView.editor.getSelection() : "";

    return { text, hasSelection };
}

/**
 * Get the title of a file (first alias or basename without extension)
 */
export function getFileTitle(app: App, file: TFile): string {
    const cache = app.metadataCache.getFileCache(file);
    const aliases = cache?.frontmatter?.aliases;
    if (Array.isArray(aliases) && aliases.length > 0) {
        const alias = aliases[0];
        if (typeof alias === "string") {
            return alias;
        }
    }
    return file.basename;
}

/**
 * Modal for selecting from a list of file paths
 */
class FileSuggesterModal extends SuggestModal<string> {
    private files: string[];
    private onSelect: (value: string | null) => void;
    private submitted = false;

    constructor(
        app: App,
        files: string[],
        placeholder: string,
        onSelect: (value: string | null) => void,
    ) {
        super(app);
        this.files = files;
        this.onSelect = onSelect;
        this.setPlaceholder(placeholder);
    }

    getSuggestions(query: string): string[] {
        return this.files.filter((file) =>
            file.toLowerCase().includes(query.toLowerCase()),
        );
    }

    renderSuggestion(file: string, el: HTMLElement): void {
        el.createEl("div", { text: file });
    }

    // Use selectSuggestion instead of onChooseSuggestion for proper timing
    selectSuggestion(value: string, _evt: MouseEvent | KeyboardEvent): void {
        this.submitted = true;
        this.close();
        this.onSelect(value);
    }

    onChooseSuggestion(_file: string, _evt: MouseEvent | KeyboardEvent): void {
        // Called after selectSuggestion - nothing to do here
    }

    onClose(): void {
        if (!this.submitted) {
            this.onSelect(null);
        }
    }
}

/**
 * Show a file suggester modal to let the user choose from a list of files.
 * Returns the selected file path or null if cancelled.
 */
export function showFileSuggester(
    app: App,
    files: string[],
    placeholder = "Choose file",
): Promise<string | null> {
    return new Promise((resolve) => {
        const modal = new FileSuggesterModal(app, files, placeholder, resolve);
        modal.open();
    });
}

/**
 * Check if a file path should be excluded based on year.
 * Uses getDateFromPath for consistency, falling back to directory year pattern.
 */
function isYearExcluded(path: string, excludeYears: number[]): boolean {
    if (excludeYears.length === 0) {
        return false;
    }

    // Try to get year from date in path (e.g., "2024-01-15" → 2024)
    const dateFromPath = getDateFromPath(path);
    if (dateFromPath) {
        const year = Number.parseInt(dateFromPath.substring(0, 4), 10);
        return excludeYears.includes(year);
    }

    // Fallback: extract year from directory structure (e.g., "/2024/")
    const yearMatch = path.match(/\/(\d{4})\//);
    if (yearMatch) {
        const year = Number.parseInt(yearMatch[1], 10);
        return excludeYears.includes(year);
    }

    return false;
}

/**
 * Get list of files that can be push targets.
 * Uses the quest index for quest/area files, plus weekly and conversation files.
 * Filters out excluded years from settings.
 */
export function getPushTargets(app: App, current: TFile): string[] {
    const allFiles = app.vault.getMarkdownFiles();
    const excludeYears = window.taskIndex?.api?.getExcludeYears() ?? [];

    // Get recent weekly files (sorted by date, limited to 5)
    const weeklyFiles = allFiles
        .filter((file) => {
            return (
                file.path.endsWith("_week.md") &&
                file.path.includes("chronicles/") &&
                !file.path.includes("journal") &&
                file !== current &&
                !isYearExcluded(file.path, excludeYears)
            );
        })
        .sort((a, b) => {
            const d1 = getDateFromPath(a.path);
            const d2 = getDateFromPath(b.path);
            if (d1 && d2) {
                return d2.localeCompare(d1); // descending
            }
            return d1 ? -1 : d2 ? 1 : 0;
        })
        .slice(0, 5)
        .map((f) => f.path);

    // Get conversation files (exclude by year)
    const conversationFiles = allFiles
        .filter((file) => {
            return (
                file !== current &&
                file.path.includes("conversations/") &&
                !/^\/?(?:assets|[^/]*?archives)\//.test(file.path) &&
                !isYearExcluded(file.path, excludeYears)
            );
        })
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((f) => f.path);

    // Get quest/area files from the index (already validated)
    const questFiles = window.taskIndex?.api
        ? window.taskIndex.api
              .getQuestPaths()
              .filter((path) => path !== current.path)
        : [];

    return [...weeklyFiles, ...conversationFiles, ...questFiles];
}

/**
 * Get conversation files matching the chronicles/conversations path pattern
 */
export function getConversationFiles(app: App, current: TFile): string[] {
    const pattern = /^chronicles\/conversations(\/|$)/;

    return app.vault
        .getMarkdownFiles()
        .filter((file) => file !== current && pattern.test(file.path))
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((f) => f.path);
}

import type { App, TFile } from "obsidian";
import type { NoteContext, Utils } from "./_utils";

/**
 * Information about a line or selection in a file
 */
interface LineInfo {
    title: string;
    path: string;
    context: NoteContext;
    heading: string | undefined;
    text: string | undefined;
    mark: string | undefined;
    selectedLines?: string[];
}

interface DatedConfig {
    excludeYears: number[];
}

interface SourceAtttribution {
    pretty: string;
    fromAssets: boolean;
    fromDaily: boolean;
    fromYearly: boolean;
    fromReminders: boolean;
    date: string;
}

export class PushText {
    app: App;
    configFile = "assets/config/open-dated-config.yaml";
    excludeYears: number[] = [];

    private readonly pushOptions = {
        header: ["Section", "Log item", "Tasks item"],
        item: ["Log item", "Tasks item"],
    };

    private readonly patterns = {
        dated: /^.*?(\d{4}-\d{2}-\d{2}).*$/,
        completed: /.*\((\d{4}-\d{2}-\d{2})\)\s*$/,
        dailyNote: /(\d{4}-\d{2}-\d{2})\.md/,
        yearlyNote: /(\d{4})\.md/,
        listItem: /^\s*-\s*(?:\[.\]\s*)?(.*)$/,
        heading: /^#+\s*/,
        // Task-specific patterns
        task: /^(\s*-\s*)\[(.)\]\s(.*)$/,
        completedMark: /[x-]/,
    };
    constructor() {
        this.app = window.customJS.app;
        console.log("loaded PushText");
    }

    /**
     * Lazy-load utils function - important for dynamic updates
     */
    utils = (): Utils => window.customJS.Utils;

    /**
     * Load configuration from YAML file (shared with cmd-open-dated)
     */
    async loadConfig(): Promise<void> {
        try {
            const configFile = this.app.vault.getFileByPath(this.configFile);
            if (!configFile) {
                // No config file, use defaults (no exclusions)
                return;
            }

            const configText = await this.app.vault.cachedRead(configFile);
            const config = window.customJS.obsidian.parseYaml(
                configText,
            ) as DatedConfig;

            if (config.excludeYears) {
                this.excludeYears = config.excludeYears;
            }
        } catch (error) {
            console.error("Failed to load dated configuration:", error);
        }
    }

    /**
     * Ensure we're in source mode, preserving selection if possible.
     * If in reading mode with text selected, capture it and re-select after switching.
     */
    private async ensureSourceMode(): Promise<void> {
        const activeView = this.app.workspace.getActiveViewOfType(
            window.customJS.obsidian.MarkdownView,
        );
        if (!activeView) {
            console.log("ensureSourceMode: No active view");
            return;
        }

        const leaf = activeView.leaf;
        const viewState = leaf.getViewState();
        const currentMode = viewState.state?.mode;

        console.log("ensureSourceMode: Current mode:", currentMode);

        // Already in source mode
        if (currentMode === "source") {
            console.log("ensureSourceMode: Already in source mode");
            return;
        }

        // In reading mode (preview) - try to preserve selection
        let selectedText = "";
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
            selectedText = domSelection.toString().trim();
            console.log(
                "ensureSourceMode: Captured selection:",
                `"${selectedText.substring(0, 50)}${selectedText.length > 50 ? "..." : ""}"`,
                `(${selectedText.length} chars)`,
            );
        } else {
            console.log("ensureSourceMode: No selection to preserve");
        }

        // Switch to source mode
        console.log("ensureSourceMode: Switching to source mode...");
        await leaf.setViewState({
            ...viewState,
            state: { ...viewState.state, mode: "source" },
        });

        // Show notice to user
        new window.customJS.obsidian.Notice("Switching to edit mode...");

        // Try to restore selection if we had one
        if (selectedText) {
            const activeView = this.app.workspace.getActiveViewOfType(
                window.customJS.obsidian.MarkdownView,
            );
            if (!activeView?.editor) {
                console.warn(
                    "ensureSourceMode: No editor available after mode switch",
                );
                return;
            }

            const content = activeView.editor.getValue();
            const index = content.indexOf(selectedText);

            if (index === -1) {
                console.warn(
                    "ensureSourceMode: Could not find selected text in editor content",
                );
                return;
            }

            console.log(
                "ensureSourceMode: Found text at index",
                index,
                "- restoring selection",
            );

            // Convert character index to line/ch positions
            const lines = content.substring(0, index).split("\n");
            const startLine = lines.length - 1;
            const startCh = lines[lines.length - 1].length;

            const selectedLines = selectedText.split("\n");
            const endLine = startLine + selectedLines.length - 1;
            const endCh =
                selectedLines.length === 1
                    ? startCh + selectedText.length
                    : selectedLines[selectedLines.length - 1].length;

            console.log(
                "ensureSourceMode: Setting selection from",
                `L${startLine}:${startCh}`,
                "to",
                `L${endLine}:${endCh}`,
            );

            activeView.editor.setSelection(
                { line: startLine, ch: startCh },
                { line: endLine, ch: endCh },
            );

            console.log("ensureSourceMode: Selection restored");
        }
    }

    /**
     * Push text from current location to target file
     */
    async invoke(): Promise<void> {
        await this.loadConfig();
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            console.log("No active file");
            return;
        }

        // Switch to source mode if needed, preserving selection
        await this.ensureSourceMode();

        try {
            // Get cached push target files
            const allFiles = await this.utils().getPushTargets(activeFile);

            // Filter out excluded years
            const files = this.filterExcludedFiles(allFiles);

            if (files.length === 0) {
                console.log("No push target files found");
                return;
            }

            // Show file suggester
            const choice = await this.utils().showFileSuggester(
                files,
                "Choose target file",
            );

            if (!choice) {
                return; // User cancelled
            }
            const targetContext = this.getPushContext(choice);

            // Get current selection/text
            // Analyze the current line/selection
            const selection = this.utils().getActiveSelection();
            const lineInfo = await this.findLine(activeFile, selection);

            // Check for weekly file involvement (either source or target)
            const isWeeklyInvolved =
                lineInfo.context.isWeekly || targetContext.isWeekly;

            // Perform the appropriate push operation based on context
            if (lineInfo.selectedLines && lineInfo.selectedLines.length > 1) {
                await this.pushMultipleLinesAsBlob(targetContext, lineInfo);
            } else if (lineInfo.heading) {
                await this.pushHeader(targetContext, lineInfo);
            } else if (lineInfo.text) {
                if (isWeeklyInvolved) {
                    await this.pushWeeklyTask(targetContext, lineInfo);
                } else {
                    await this.pushText(targetContext, lineInfo);
                }
            } else {
                console.warn(
                    "No content to push - no heading, text, or selection found",
                );
                new window.customJS.obsidian.Notice("No content to push");
            }
        } catch (error) {
            console.error("Error in PushText:", error);
        }
    }

    /**
     * Find the current line or selection in the active file and extract relevant information.
     */
    private async findLine(
        activeFile: TFile,
        selection: { text: string; hasSelection: boolean },
    ): Promise<LineInfo> {
        const activeView = this.app.workspace.getActiveViewOfType(
            window.customJS.obsidian.MarkdownView,
        );

        let line: string | undefined;
        let selectedLines: string[] | undefined;

        const fileContent = await this.app.vault.read(activeFile);
        const lines = fileContent.split("\n");
        const title = this.utils().fileTitle(activeFile);

        if (selection.hasSelection) {
            selectedLines = selection.text
                .split("\n")
                .filter((line) => line.trim() !== "");

            if (selectedLines.length > 0) {
                line = selectedLines[0];
            }
        } else if (activeView?.editor) {
            const cursor = activeView.editor.getCursor("from").line;
            line = lines[cursor];
        }

        let heading: string | undefined;
        let text: string | undefined;
        let mark: string | undefined;

        if (!line) {
            // No line selected or found - nothing to push
            console.log("No line to push");
            return {
                title,
                path: activeFile.path,
                context: this.getPushContext(activeFile.path),
                heading: undefined,
                text: undefined,
                mark: undefined,
                selectedLines: undefined,
            };
        }

        if (line.match(/^\s*- .*/)) {
            // Extract text and mark from a task item
            const taskMatch = this.patterns.task.exec(line);
            if (taskMatch) {
                mark = taskMatch[2];
                text = taskMatch[3].trim();
            } else {
                // Not a task, just a list item
                text = line.replace(/^\s*- (.*)/, "$1").trim();
            }
        } else if (line.startsWith("#")) {
            // Extract text from a heading
            heading = line.replace(/#+ /, "").trim();
        } else {
            // Plain text - use it directly
            text = line.trim();
        }

        return {
            title,
            path: activeFile.path,
            context: this.getPushContext(activeFile.path),
            heading,
            text,
            mark,
            selectedLines,
        };
    }

    /**
     * Handle pushing multiple selected lines as a blob to the specified file.
     * Uses regex to mark list items as complete and maintains order.
     */
    private async pushMultipleLinesAsBlob(
        targetContext: NoteContext,
        lineInfo: LineInfo,
    ): Promise<void> {
        if (!lineInfo.selectedLines) {
            return;
        }

        const targetFile = this.app.vault.getFileByPath(
            targetContext.path,
        ) as TFile;
        if (!targetFile) {
            console.log(`Target file not found: ${targetContext.path}`);
            return;
        }

        const type = await this.utils().showFileSuggester(
            this.pushOptions.item,
            "Choose item type",
        );

        if (!type) {
            return;
        }

        const source = this.getSourceAttribution(lineInfo.path, lineInfo.title);
        const target = targetContext;

        const originalText = lineInfo.selectedLines.join("\n");
        let processedText = originalText;

        if (type === "Tasks item") {
            const from =
                target.isDaily || source.fromAssets || source.fromYearly
                    ? ""
                    : ` from [${source.pretty}](${lineInfo.path})`;
            processedText = processedText.replace(
                /^(\s*)-\s*(?:\[.\]\s*)?(.+)$/gm,
                `$1- [ ] $2${from}`,
            );
            processedText = processedText.replace(
                /^(?!\s*-\s)(.+)$/gm,
                `- [ ] $1${from}`,
            );
        } else {
            const task = target.asTask ? "[x] " : "";
            const from =
                source.fromDaily || source.fromAssets || source.fromYearly
                    ? ""
                    : `[${source.pretty}](${lineInfo.path}): `;

            if (task) {
                // Only add completion date if line doesn't already have one
                processedText = processedText.replace(
                    /^(\s*)-\s*(?:\[.\]\s*)?(.+)$/gm,
                    (_match, indent, text) => {
                        const completed = this.hasCompletionDate(text)
                            ? ""
                            : ` (${source.date})`;
                        return `${indent}- ${task}${from}${text}${completed}`;
                    },
                );
                processedText = processedText.replace(
                    /^(?!\s*-\s)(.+)$/gm,
                    (_match, text) => {
                        const completed = this.hasCompletionDate(text)
                            ? ""
                            : ` (${source.date})`;
                        return `- ${task}${from}${text}${completed}`;
                    },
                );
            } else {
                processedText = processedText.replace(
                    /^(\s*)-\s*(?:\[.\]\s*)?(.+)$/gm,
                    `$1- ${from}$2`,
                );
                processedText = processedText.replace(
                    /^(?!\s*-\s)(.+)$/gm,
                    `- ${from}$1`,
                );
            }
        }

        await this.addToSection(
            targetFile,
            type === "Tasks item" ? "Tasks" : "Log",
            processedText,
        );
    }

    /**
     * PATTERN 1: Push conversation header references
     *
     * Purpose: Reference what happened in a conversation on a specific day
     * Source: Conversation files with dated headings like "## 2023-10-11 Foundation materials review"
     * Target: Weekly/Daily notes or project logs
     *
     * Creates links to conversation sections, using "interesting" part or file title
     * if no interesting part exists.
     */
    private async pushHeader(
        targetContext: NoteContext,
        lineInfo: LineInfo,
    ): Promise<void> {
        const targetFile = this.app.vault.getFileByPath(
            targetContext.path,
        ) as TFile;
        if (!targetFile) {
            console.log(`Target file not found: ${targetContext.path}`);
            return;
        }

        const type = await this.utils().showFileSuggester(
            this.pushOptions.header,
            "Choose push type",
        );
        if (!type) {
            return;
        }

        const { date, interesting } = this.parseConversationHeading(
            lineInfo.heading || "",
        );
        const source = this.getSourceAttribution(lineInfo.path, lineInfo.title);
        const linkText =
            lineInfo.path === targetContext.path ? "⤴" : source.pretty;
        const lineText = interesting || lineInfo.title; // Use file title if no interesting part
        const anchor = this.createAnchor(lineInfo.heading || "");

        console.log(
            "PUSH HEADER",
            lineInfo,
            date,
            interesting,
            linkText,
            lineText,
        );

        if (type === "Section") {
            await this.createNewSection(
                targetFile,
                lineInfo.heading || "",
                lineInfo.title,
                lineInfo.path,
                anchor,
            );
        } else if (type === "Tasks item") {
            const addThis = `- [ ] [${linkText}](${lineInfo.path}#${anchor}): ${lineText}`;
            await this.addToSection(targetFile, "Tasks", addThis);
        } else {
            // Log item - create completed reference to conversation
            const hasDate = this.hasCompletionDate(lineText);
            const task = targetContext.asTask ? "[x] " : "";
            const prefix = source.fromDaily
                ? ""
                : `[${linkText}](${lineInfo.path}#${anchor}): `;
            const completed = task && !hasDate ? ` (${date})` : "";

            const addThis = `- ${task}${prefix}${lineText}${completed}`;
            console.log("pushHeader: Log", addThis);
            await this.addToSection(targetFile, "Log", addThis);
        }
    }

    /**
     * PATTERN 2: Weekly planning workflow
     *
     * Purpose: Use weekly file as planning/staging area for project tasks
     *
     * Forward (Project → Weekly):
     * - Source: Project task "- [ ] Implement user authentication"
     * - Target: Weekly Tasks section
     * - Output: "- [ ] [_Project Name_](path/to/project): Implement user authentication"
     *
     * Return (Weekly → Project):
     * - If completed: Goes to project Log as "- [x] Implement user authentication (2025-09-25)"
     * - If incomplete: Returns to project Tasks as "- [ ] Implement user authentication"
     * - Preserves completion date if already present
     */
    private async pushWeeklyTask(
        targetContext: NoteContext,
        lineInfo: LineInfo,
    ): Promise<void> {
        const targetFile = this.app.vault.getFileByPath(
            targetContext.path,
        ) as TFile;
        if (!targetFile) {
            console.log(`Target file not found: ${targetContext.path}`);
            return;
        }

        const source = this.getSourceAttribution(lineInfo.path, lineInfo.title);
        const isTargetWeekly = targetContext.isWeekly;
        const isSourceWeekly = lineInfo.context.isWeekly;
        const isForward = !source.fromDaily && isTargetWeekly; // Project → Weekly
        const isReturn = isSourceWeekly && !targetContext.isWeekly; // Weekly → Project

        console.log(
            "PUSH WEEKLY TASK",
            `"${lineInfo.path}" → "${targetContext.path}"`,
            `forward: ${isForward}, return: ${isReturn}`,
        );

        if (isForward) {
            // Project → Weekly: Add task to weekly Tasks section with project link
            const addThis = `- [ ] [${source.pretty}](${lineInfo.path}): ${lineInfo.text}`;
            await this.addToSection(targetFile, "Tasks", addThis);

            // Delete the source line from the project file (move, not copy)
            const sourceFile = this.app.vault.getFileByPath(
                lineInfo.path,
            ) as TFile;
            if (sourceFile) {
                await this.deleteCurrentLine(sourceFile);
            }
        } else if (isReturn) {
            // Weekly → Project: Check if completed and route appropriately
            if (!lineInfo.mark || !lineInfo.text) {
                console.warn(
                    "Could not parse task line - missing mark or text:",
                    lineInfo,
                );
                return;
            }

            const cleanText = lineInfo.text.replace(/^\[.*?\]\(.*?\):\s*/, "");
            const isCompleted = this.isTaskCompleted(lineInfo.mark);
            const hasDate = this.hasCompletionDate(cleanText);

            if (isCompleted) {
                // Completed: Add to project Log section
                const completionDate = hasDate
                    ? "" // Already has date, don't add weekly reference
                    : ` (${this.getBestDate(cleanText, lineInfo.path)})`;

                const addThis = `- [${lineInfo.mark}] ${cleanText}${completionDate}`;
                console.log("task completed", completionDate, addThis);

                await this.addToSection(targetFile, "Log", addThis);
            } else {
                // Not completed: Return to project Tasks section
                const addThis = `- [${lineInfo.mark}] ${cleanText}`;
                await this.addToSection(targetFile, "Tasks", addThis);
            }

            // Delete the source line from the weekly file (move, not copy)
            const sourceFile = this.app.vault.getFileByPath(
                lineInfo.path,
            ) as TFile;
            if (sourceFile) {
                await this.deleteCurrentLine(sourceFile);
            }
        } else {
            console.warn(
                "Weekly task push: Could not determine direction",
                lineInfo.path,
                "→",
                targetContext.path,
            );
        }
    }

    /**
     * PATTERN 3: Push daily progress items
     *
     * Purpose: Track "what I did" progress from daily notes to project tracking
     * Source: Daily notes with accomplishment lines like "- Haus Manager: Fixed NPE for team sync"
     * Target: Project files
     *
     * Output:
     * - Log item: "- [x] ... ([_2025-09-17_](chronicles/2025/2025-09-17.md))" (completed, with source link)
     * - Task item: "- [ ] ... from [_Daily Note_](path)" (unchecked, for future work)
     */
    private async pushText(
        targetContext: NoteContext,
        lineInfo: LineInfo,
    ): Promise<void> {
        const targetFile = this.app.vault.getFileByPath(
            targetContext.path,
        ) as TFile;
        if (!targetFile) {
            console.log(`Target file not found: ${targetContext.path}`);
            return;
        }

        const source = this.getSourceAttribution(lineInfo.path, lineInfo.title);
        const date = this.getBestDate(lineInfo.text, lineInfo.path);
        const isProjectToDaily =
            !lineInfo.context.isDaily && targetContext.isDaily;

        let type: string | undefined;
        if (isProjectToDaily) {
            type = "Log item";
        } else {
            type = await this.utils().showFileSuggester(
                this.pushOptions.item,
                "Choose item type",
            );
            if (!type) {
                return;
            }
        }

        console.log(
            "PUSH TEXT",
            `"${lineInfo.path}"`,
            `"${lineInfo.text}"`,
            `"${date}"`,
        );

        if (type === "Tasks item") {
            // Create unchecked task with source attribution
            await this.addToSection(
                targetFile,
                "Tasks",
                `- [ ] ${lineInfo.text}`,
            );
        } else {
            // Create log entry (completed if going to project file)
            const task = targetContext.asTask ? "[x] " : "";
            const from =
                source.fromDaily || source.fromAssets || source.fromYearly
                    ? ""
                    : `[${source.pretty}](${lineInfo.path}): `;
            const text = source.fromDaily
                ? lineInfo.text.replace(
                      / #(self|work|home|community|family)/g,
                      "",
                  )
                : lineInfo.text;
            const hasDate = this.hasCompletionDate(text);
            const completed = task && !hasDate ? ` (${date})` : "";

            const addThis = `- ${task}${from}${text}${completed}`;
            if (isProjectToDaily) {
                await this.appendToDailyNote(targetFile, addThis);
            } else {
                await this.addToSection(targetFile, "Log", addThis);
            }
        }
    }

    // === HELPER METHODS ===

    /**
     * Filter out files from excluded years and archive paths
     * Extracts year from path patterns like chronicles/YYYY/...
     */
    private filterExcludedFiles(files: string[]): string[] {
        const excludePatterns: RegExp[] = [/^Ω-archives.*/];

        return files
            .filter((path) => !excludePatterns.some((r) => r.test(path)))
            .filter((path) => {
                if (this.excludeYears.length === 0) {
                    return true;
                }

                // Extract year from path (e.g., chronicles/2023/... -> 2023)
                const yearMatch = path.match(/\/(\d{4})\//);
                if (!yearMatch) {
                    return true; // Keep files without year in path
                }

                const year = Number.parseInt(yearMatch[1], 10);
                return !this.excludeYears.includes(year);
            });
    }

    /**
     * Delete the current line or selection from the source file
     */
    private async deleteCurrentLine(_sourceFile: TFile): Promise<void> {
        const activeView = this.app.workspace.getActiveViewOfType(
            window.customJS.obsidian.MarkdownView,
        );

        if (!activeView?.editor) {
            console.warn("No active editor to delete line from");
            return;
        }

        const selection = this.utils().getActiveSelection();

        if (selection.hasSelection) {
            // Delete the selected lines
            activeView.editor.replaceSelection("");
        } else {
            // Delete the current line
            const cursor = activeView.editor.getCursor("from");
            const line = cursor.line;
            const lineContent = activeView.editor.getLine(line);

            // Replace the entire line with empty string
            activeView.editor.replaceRange(
                "",
                { line, ch: 0 },
                { line, ch: lineContent.length },
            );

            // If the line isn't the last line, also delete the newline
            const lastLine = activeView.editor.lastLine();
            if (line < lastLine) {
                activeView.editor.replaceRange(
                    "",
                    { line, ch: 0 },
                    { line: line + 1, ch: 0 },
                );
            }
        }
    }

    /**
     * Cache and return the date embedded in a file path, if present.
     */
    private getCachedPathDate = (path: string): string | undefined => {
        return this.utils().getNoteDate(path);
    };

    /**
     * Build context information about a file path (daily/weekly, etc.)
     */
    private getPushContext = (path: string): NoteContext => {
        return this.utils().getNoteContext(path);
    };

    /**
     * Get formatted source attribution for push operations
     */
    private getSourceAttribution = (
        path: string,
        title: string,
    ): SourceAtttribution => {
        const pathDate = this.getCachedPathDate(path);
        const fromDaily = Boolean(pathDate);
        const fromYearly = !fromDaily && path.match(/\/\d{4}\.md$/) !== null;
        const fromReminders = path.includes("Reminders.md");
        const fromAssets = path.includes("assets") || path.endsWith("_gh.md");
        const pretty = path.includes("conversations")
            ? `**${title}**`
            : `_${title}_`;
        const date = pathDate || window.moment().format("YYYY-MM-DD");

        return {
            pretty,
            fromAssets,
            fromDaily,
            fromReminders,
            fromYearly,
            date,
        };
    };

    /**
     * Get the most appropriate date from various sources
     * Priority: line text date > source file date > current date
     */
    private getBestDate = (
        lineText: string | undefined,
        sourcePath: string,
    ): string => {
        // First try to extract date from the line text itself
        const lineDate = lineText?.match(this.patterns.dated);
        if (lineDate) {
            return lineDate[1];
        }

        // Then try the source file path (for daily notes)
        const sourceDate = this.getCachedPathDate(sourcePath);
        if (sourceDate) {
            return sourceDate;
        }

        // Fall back to current date
        return window.moment().format("YYYY-MM-DD");
    };

    /**
     * Extract date and interesting text from conversation heading
     * Example: "## 2023-10-11 Foundation materials review" →
     *   date: "2023-10-11", interesting: "Foundation materials review"
     */
    private parseConversationHeading = (
        heading: string,
    ): {
        date: string;
        interesting: string;
    } => {
        const date = heading.replace(/^.*?(\d{4}-\d{2}-\d{2}).*$/, "$1") || "";
        const interesting = heading
            .replace(/\s*\d{4}-\d{2}-\d{2}\s*/, "")
            .trim();
        return { date, interesting };
    };

    /**
     * Create URL anchor from heading text
     */
    private createAnchor = (heading: string): string => {
        return heading
            .replace(/\s+/g, " ")
            .replace(/:/g, "")
            .replace(/ /g, "%20");
    };

    /**
     * Check if text already has a completion date
     * Uses same pattern as tasks.ts: /\((\d{4}-\d{2}-\d{2})\)/
     */
    private hasCompletionDate = (text: string): boolean => {
        return this.patterns.completed.test(text);
    };

    /**
     * Check if task mark indicates completion
     * Uses same logic as tasks.ts: mark.match(/[x-]/)
     */
    private isTaskCompleted = (mark: string): boolean => {
        return this.patterns.completedMark.test(mark);
    };

    /**
     * Create a new section with heading and embed
     * Used for "Section" type pushes
     */
    private createNewSection = async (
        targetFile: TFile,
        heading: string,
        title: string,
        sourcePath: string,
        anchor: string,
    ): Promise<void> => {
        const addThis = [
            `## ${heading} ${title}`,
            `![invisible-embed](${sourcePath}#${anchor})`,
            "",
        ].join("\n");

        const fileCache = this.app.metadataCache.getFileCache(targetFile);

        if (!fileCache?.headings) {
            console.warn(
                `No metadata cache or headings found for ${targetFile.path}`,
            );
            return;
        }

        const headings = fileCache.headings.filter((x) => x.level === 2);

        await this.app.vault.process(targetFile, (content) => {
            const split = content.split("\n");
            if (headings?.[0]) {
                split.splice(headings[0].position.start.line, 0, addThis);
            } else {
                split.push("", addThis);
            }
            return split.join("\n");
        });
    };

    /**
     * Append content to the end of a daily note, skipping trailing blank lines.
     */
    private appendToDailyNote = async (
        file: TFile,
        content: string,
    ): Promise<void> => {
        await this.app.vault.process(file, (fileContent) => {
            const lines = fileContent.split("\n");
            while (
                lines.length > 0 &&
                lines[lines.length - 1].trim().length === 0
            ) {
                lines.pop();
            }

            lines.push(content);
            return `${lines.join("\n")}\n`;
        });
    };

    /**
     * Add text to a specified section in a file.
     */
    private async addToSection(
        file: TFile,
        sectionName: string,
        content: string,
    ): Promise<void> {
        const fileCache = this.app.metadataCache.getFileCache(file);

        if (!fileCache?.headings) {
            console.warn(
                `No metadata cache or headings found for ${file.path}`,
            );
            return;
        }

        const headings = fileCache.headings
            .filter((x) => x.level >= 2)
            .filter((x) => x.heading.contains(sectionName));

        if (headings[0]) {
            await this.app.vault.process(file, (fileContent) => {
                const split = fileContent.split("\n");
                split.splice(headings[0].position.start.line + 1, 0, content);
                return split.join("\n");
            });
        } else {
            console.warn(`Section "${sectionName}" not found in ${file.path}`);
        }
    }
}

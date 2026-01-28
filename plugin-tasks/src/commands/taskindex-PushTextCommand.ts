import { type App, MarkdownView, Notice, type TFile } from "obsidian";
import {
    DATE_IN_PATH_REGEX,
    getDateFromPath,
    HEADING_PREFIX_REGEX,
    hasCompletionDate,
    isTaskCompleted,
    TASK_REGEX,
} from "../taskindex-CommonPatterns";
import {
    type ActiveSelection,
    getActiveSelection,
    getFileTitle,
    getNoteContext,
    getPushTargets,
    type NoteContext,
    showFileSuggester,
} from "../taskindex-NoteUtils";

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

interface SourceAttribution {
    pretty: string;
    fromAssets: boolean;
    fromDaily: boolean;
    fromYearly: boolean;
    fromReminders: boolean;
    date: string;
}

/**
 * Command to push text from current location to a target file.
 * Replaces the CustomJS PushText class from cmd-push-text.ts
 *
 * Supports three main patterns:
 * 1. Push conversation headers - Reference conversation sections
 * 2. Weekly planning workflow - Bidirectional task movement
 * 3. Daily progress tracking - Move accomplishments to project logs
 */
export class PushTextCommand {
    private readonly pushOptions = {
        header: ["Section", "Log item", "Tasks item"],
        item: ["Log item", "Tasks item"],
    };

    constructor(private app: App) {}

    async execute(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice("No active file");
            return;
        }

        // Switch to source mode if needed, preserving selection
        await this.ensureSourceMode();

        try {
            // Get push target files (already filtered by excluded years)
            const files = getPushTargets(this.app, activeFile);

            if (files.length === 0) {
                new Notice("No push target files found");
                return;
            }

            // Show file suggester
            const choice = await showFileSuggester(
                this.app,
                files,
                "Choose target file",
            );

            if (!choice) {
                return; // User cancelled
            }

            const targetContext = getNoteContext(choice);
            console.log("[PushText] Target context:", targetContext);

            // Get current selection/text and analyze it
            const selection = getActiveSelection(this.app);
            const lineInfo = await this.findLine(activeFile, selection);
            console.log("[PushText] Line info:", {
                title: lineInfo.title,
                path: lineInfo.path,
                context: lineInfo.context,
                heading: lineInfo.heading,
                text: lineInfo.text,
                mark: lineInfo.mark,
                selectedLinesCount: lineInfo.selectedLines?.length,
            });

            // Check for weekly file involvement (either source or target)
            const isWeeklyInvolved =
                lineInfo.context.isWeekly || targetContext.isWeekly;
            console.log("[PushText] Weekly involved:", isWeeklyInvolved);

            // Perform the appropriate push operation based on context
            if (lineInfo.selectedLines && lineInfo.selectedLines.length > 1) {
                console.log("[PushText] Route: pushMultipleLinesAsBlob");
                await this.pushMultipleLinesAsBlob(targetContext, lineInfo);
            } else if (lineInfo.heading) {
                console.log("[PushText] Route: pushHeader");
                await this.pushHeader(targetContext, lineInfo);
            } else if (lineInfo.text) {
                if (isWeeklyInvolved) {
                    console.log("[PushText] Route: pushWeeklyTask");
                    await this.pushWeeklyTask(targetContext, lineInfo);
                } else {
                    console.log("[PushText] Route: pushText");
                    await this.pushText(targetContext, lineInfo);
                }
            } else {
                console.log("[PushText] Route: no content");
                new Notice("No content to push");
            }
        } catch (error) {
            console.error("Error in PushTextCommand:", error);
            new Notice("Error pushing text");
        }
    }

    /**
     * Ensure we're in source mode, preserving selection if possible.
     */
    private async ensureSourceMode(): Promise<void> {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            return;
        }

        const leaf = activeView.leaf;
        const viewState = leaf.getViewState();
        const currentMode = viewState.state?.mode;

        // Already in source mode
        if (currentMode === "source") {
            return;
        }

        // In reading mode - try to preserve selection
        let selectedText = "";
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
            selectedText = domSelection.toString().trim();
        }

        // Switch to source mode
        await leaf.setViewState({
            ...viewState,
            state: { ...viewState.state, mode: "source" },
        });

        new Notice("Switching to edit mode...");

        // Try to restore selection if we had one
        if (selectedText) {
            const newView =
                this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!newView?.editor) {
                return;
            }

            const content = newView.editor.getValue();
            const index = content.indexOf(selectedText);

            if (index === -1) {
                return;
            }

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

            newView.editor.setSelection(
                { line: startLine, ch: startCh },
                { line: endLine, ch: endCh },
            );
        }
    }

    /**
     * Find the current line or selection and extract relevant information.
     */
    private async findLine(
        activeFile: TFile,
        selection: ActiveSelection,
    ): Promise<LineInfo> {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

        let line: string | undefined;
        let selectedLines: string[] | undefined;

        const fileContent = await this.app.vault.read(activeFile);
        const lines = fileContent.split("\n");
        const title = getFileTitle(this.app, activeFile);

        if (selection.hasSelection) {
            selectedLines = selection.text
                .split("\n")
                .filter((l) => l.trim() !== "");

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
            return {
                title,
                path: activeFile.path,
                context: getNoteContext(activeFile.path),
                heading: undefined,
                text: undefined,
                mark: undefined,
                selectedLines: undefined,
            };
        }

        if (line.match(/^\s*- .*/)) {
            // Extract text and mark from a task item
            const taskMatch = TASK_REGEX.exec(line);
            if (taskMatch) {
                mark = taskMatch[2];
                text = taskMatch[3].trim();
            } else {
                // Not a task, just a list item
                text = line.replace(/^\s*- (.*)/, "$1").trim();
            }
        } else if (line.startsWith("#")) {
            // Extract text from a heading
            heading = line.replace(HEADING_PREFIX_REGEX, "").trim();
        } else {
            // Plain text - use it directly
            text = line.trim();
        }

        return {
            title,
            path: activeFile.path,
            context: getNoteContext(activeFile.path),
            heading,
            text,
            mark,
            selectedLines,
        };
    }

    /**
     * Handle pushing multiple selected lines as a blob to the specified file.
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
            new Notice(`Target file not found: ${targetContext.path}`);
            return;
        }

        const type = await showFileSuggester(
            this.app,
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
                        const completed = hasCompletionDate(text)
                            ? ""
                            : ` (${source.date})`;
                        return `${indent}- ${task}${from}${text}${completed}`;
                    },
                );
                processedText = processedText.replace(
                    /^(?!\s*-\s)(.+)$/gm,
                    (_match, text) => {
                        const completed = hasCompletionDate(text)
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

        if (target.isDaily) {
            await this.appendToDailyNote(targetFile, processedText);
        } else {
            await this.addToSection(
                targetFile,
                type === "Tasks item" ? "Tasks" : "Log",
                processedText,
            );
        }
    }

    /**
     * PATTERN 1: Push conversation header references
     */
    private async pushHeader(
        targetContext: NoteContext,
        lineInfo: LineInfo,
    ): Promise<void> {
        const targetFile = this.app.vault.getFileByPath(
            targetContext.path,
        ) as TFile;
        if (!targetFile) {
            new Notice(`Target file not found: ${targetContext.path}`);
            return;
        }

        const type = await showFileSuggester(
            this.app,
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
        const lineText = interesting || lineInfo.title;
        const anchor = this.createAnchor(lineInfo.heading || "");

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
            const hasDate = hasCompletionDate(lineText);
            const task = targetContext.asTask ? "[x] " : "";
            const prefix = source.fromDaily
                ? ""
                : `[${linkText}](${lineInfo.path}#${anchor}): `;
            const completed = task && !hasDate ? ` (${date})` : "";

            const addThis = `- ${task}${prefix}${lineText}${completed}`;

            if (targetContext.isDaily) {
                await this.appendToDailyNote(targetFile, addThis);
            } else {
                await this.addToSection(targetFile, "Log", addThis);
            }
        }
    }

    /**
     * PATTERN 2: Weekly planning workflow
     */
    private async pushWeeklyTask(
        targetContext: NoteContext,
        lineInfo: LineInfo,
    ): Promise<void> {
        const targetFile = this.app.vault.getFileByPath(
            targetContext.path,
        ) as TFile;
        if (!targetFile) {
            new Notice(`Target file not found: ${targetContext.path}`);
            return;
        }

        const source = this.getSourceAttribution(lineInfo.path, lineInfo.title);
        const isTargetWeekly = targetContext.isWeekly;
        const isSourceWeekly = lineInfo.context.isWeekly;
        const isForward = !source.fromDaily && isTargetWeekly;
        const isReturn = isSourceWeekly && !targetContext.isWeekly;

        if (isForward) {
            // Project → Weekly: Add task to weekly Tasks section with project link
            const addThis = `- [ ] [${source.pretty}](${lineInfo.path}): ${lineInfo.text}`;
            await this.addToSection(targetFile, "Tasks", addThis);

            // Delete the source line from the project file (move, not copy)
            const sourceFile = this.app.vault.getFileByPath(
                lineInfo.path,
            ) as TFile;
            if (sourceFile) {
                await this.deleteCurrentLine();
            }
        } else if (isReturn) {
            // Weekly → Project: Check if completed and route appropriately
            if (!lineInfo.mark || !lineInfo.text) {
                console.warn("Could not parse task line:", lineInfo);
                return;
            }

            // Strip project prefix if it links to the target file
            const targetBasePath = targetContext.path.replace(/\.md$/, "");
            const prefixPattern = new RegExp(
                `^\\[.*?\\]\\(${this.escapeRegex(targetBasePath)}(\\.md)?\\):\\s*`,
            );
            const cleanText = lineInfo.text.replace(prefixPattern, "");
            const completed = isTaskCompleted(lineInfo.mark);
            const hasDate = hasCompletionDate(cleanText);

            if (completed) {
                // Completed: Add to project Log section
                const completionDate = hasDate
                    ? ""
                    : ` (${this.getBestDate(cleanText, lineInfo.path)})`;

                const addThis = `- [${lineInfo.mark}] ${cleanText}${completionDate}`;
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
                await this.deleteCurrentLine();
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
     */
    private async pushText(
        targetContext: NoteContext,
        lineInfo: LineInfo,
    ): Promise<void> {
        console.log("[PushText.pushText] Starting with:", {
            targetPath: targetContext.path,
            sourceIsDaily: lineInfo.context.isDaily,
            targetIsDaily: targetContext.isDaily,
            targetAsTask: targetContext.asTask,
        });

        const targetFile = this.app.vault.getFileByPath(
            targetContext.path,
        ) as TFile;
        if (!targetFile) {
            console.log("[PushText.pushText] Target file not found");
            new Notice(`Target file not found: ${targetContext.path}`);
            return;
        }

        const source = this.getSourceAttribution(lineInfo.path, lineInfo.title);
        const date = this.getBestDate(lineInfo.text, lineInfo.path);
        const isProjectToDaily =
            !lineInfo.context.isDaily && targetContext.isDaily;

        console.log("[PushText.pushText] Source attribution:", source);
        console.log("[PushText.pushText] Best date:", date);
        console.log("[PushText.pushText] isProjectToDaily:", isProjectToDaily);

        let type: string | undefined;
        if (isProjectToDaily) {
            type = "Log item";
        } else {
            type = await showFileSuggester(
                this.app,
                this.pushOptions.item,
                "Choose item type",
            );
            if (!type) {
                console.log(
                    "[PushText.pushText] User cancelled type selection",
                );
                return;
            }
        }

        console.log("[PushText.pushText] Type selected:", type);

        if (type === "Tasks item") {
            const content = `- [ ] ${lineInfo.text}`;
            console.log("[PushText.pushText] Adding to Tasks:", content);
            await this.addToSection(targetFile, "Tasks", content);
        } else {
            const task = targetContext.asTask ? "[x] " : "";
            const from =
                source.fromDaily || source.fromAssets || source.fromYearly
                    ? ""
                    : `[${source.pretty}](${lineInfo.path}): `;

            // Strip leading link to target project (daily → project workflow)
            const targetBasePath = targetContext.path.replace(/\.md$/, "");
            const prefixPattern = new RegExp(
                `^\\[.*?\\]\\(${this.escapeRegex(targetBasePath)}(\\.md)?\\):\\s*`,
            );
            const strippedText = (lineInfo.text || "").replace(
                prefixPattern,
                "",
            );

            const text = source.fromDaily
                ? strippedText.replace(
                      / #(self|work|home|community|family)/g,
                      "",
                  )
                : strippedText;
            const hasDate = hasCompletionDate(text || "");
            const completed = task && !hasDate ? ` (${date})` : "";

            const addThis = `- ${task}${from}${text}${completed}`;
            console.log("[PushText.pushText] Content to add:", addThis);

            if (isProjectToDaily) {
                console.log("[PushText.pushText] Appending to daily note");
                await this.appendToDailyNote(targetFile, addThis);
            } else {
                console.log("[PushText.pushText] Adding to Log section");
                await this.addToSection(targetFile, "Log", addThis);
            }
        }
        console.log("[PushText.pushText] Done");
    }

    // === HELPER METHODS ===

    /**
     * Delete the current line or selection from the source file
     */
    private async deleteCurrentLine(): Promise<void> {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

        if (!activeView?.editor) {
            return;
        }

        const selection = getActiveSelection(this.app);

        if (selection.hasSelection) {
            activeView.editor.replaceSelection("");
        } else {
            const cursor = activeView.editor.getCursor("from");
            const line = cursor.line;
            const lineContent = activeView.editor.getLine(line);

            activeView.editor.replaceRange(
                "",
                { line, ch: 0 },
                { line, ch: lineContent.length },
            );

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
     * Get formatted source attribution for push operations
     */
    private getSourceAttribution(
        path: string,
        title: string,
    ): SourceAttribution {
        const pathDate = getDateFromPath(path);
        const fromDaily = Boolean(pathDate);
        const fromYearly = !fromDaily && /\/\d{4}\.md$/.test(path);
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
    }

    /**
     * Get the most appropriate date from various sources
     */
    private getBestDate(
        lineText: string | undefined,
        sourcePath: string,
    ): string {
        const lineDate = lineText?.match(DATE_IN_PATH_REGEX);
        if (lineDate) {
            return lineDate[1];
        }

        const sourceDate = getDateFromPath(sourcePath);
        if (sourceDate) {
            return sourceDate;
        }

        return window.moment().format("YYYY-MM-DD");
    }

    /**
     * Extract date and interesting text from conversation heading
     */
    private parseConversationHeading(heading: string): {
        date: string;
        interesting: string;
    } {
        const date = heading.replace(/^.*?(\d{4}-\d{2}-\d{2}).*$/, "$1") || "";
        const interesting = heading
            .replace(/\s*\d{4}-\d{2}-\d{2}\s*/, "")
            .trim();
        return { date, interesting };
    }

    /**
     * Create URL anchor from heading text
     */
    private createAnchor(heading: string): string {
        return heading
            .replace(/\s+/g, " ")
            .replace(/:/g, "")
            .replace(/ /g, "%20");
    }

    /**
     * Escape special regex characters in a string
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Create a new section with heading and embed
     */
    private async createNewSection(
        targetFile: TFile,
        heading: string,
        title: string,
        sourcePath: string,
        anchor: string,
    ): Promise<void> {
        const addThis = [
            `## ${heading} ${title}`,
            `![invisible-embed](${sourcePath}#${anchor})`,
            "",
        ].join("\n");

        const fileCache = this.app.metadataCache.getFileCache(targetFile);

        if (!fileCache?.headings) {
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
    }

    /**
     * Append content to the end of a daily note
     */
    private async appendToDailyNote(
        file: TFile,
        content: string,
    ): Promise<void> {
        console.log("[PushText.appendToDailyNote] Appending to:", file.path);
        console.log("[PushText.appendToDailyNote] Content:", content);
        await this.app.vault.process(file, (fileContent) => {
            const lines = fileContent.split("\n");
            while (
                lines.length > 0 &&
                lines[lines.length - 1].trim().length === 0
            ) {
                lines.pop();
            }

            lines.push(content);
            console.log("[PushText.appendToDailyNote] File processed");
            return `${lines.join("\n")}\n`;
        });
    }

    /**
     * Add text to a specified section in a file
     */
    private async addToSection(
        file: TFile,
        sectionName: string,
        content: string,
    ): Promise<void> {
        console.log("[PushText.addToSection] Looking for section:", {
            file: file.path,
            sectionName,
            content,
        });

        const fileCache = this.app.metadataCache.getFileCache(file);

        if (!fileCache?.headings) {
            console.warn(
                `[PushText.addToSection] No headings found for ${file.path}`,
            );
            return;
        }

        console.log(
            "[PushText.addToSection] All headings:",
            fileCache.headings.map((h) => ({
                level: h.level,
                heading: h.heading,
                line: h.position.start.line,
            })),
        );

        const headings = fileCache.headings
            .filter((x) => x.level >= 2)
            .filter((x) => x.heading.includes(sectionName));

        console.log(
            "[PushText.addToSection] Matching headings:",
            headings.map((h) => ({
                heading: h.heading,
                line: h.position.start.line,
            })),
        );

        if (headings[0]) {
            const insertLine = headings[0].position.start.line + 1;
            console.log(
                `[PushText.addToSection] Inserting at line ${insertLine}`,
            );
            await this.app.vault.process(file, (fileContent) => {
                const split = fileContent.split("\n");
                split.splice(insertLine, 0, content);
                console.log("[PushText.addToSection] File processed");
                return split.join("\n");
            });
        } else {
            console.warn(
                `[PushText.addToSection] Section "${sectionName}" not found in ${file.path}`,
            );
        }
    }
}

import type { App, TFile } from "obsidian";
import type { Utils } from "./_utils";

/**
 * Information about a line or selection in a file
 */
interface LineInfo {
    title: string;
    path: string;
    heading: string | undefined;
    text: string | undefined;
    mark: string | undefined;
    selectedLines?: string[];
}

export class PushText {
    app: App;

    private readonly pushOptions = {
        header: ["Section", "Log item", "Tasks item"],
        item: ["Log item", "Tasks item"],
    };

    private readonly patterns = {
        dated: /^.*?(\d{4}-\d{2}-\d{2}).*$/,
        completed: /.*\((\d{4}-\d{2}-\d{2})\)\s*$/,
        dailyNote: /(\d{4}-\d{2}-\d{2})\.md/,
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
     * Push text from current location to target file
     * Replaces the Templater template: templates/AllTheThings/push-text.md
     */
    async invoke(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            console.log("No active file");
            return;
        }

        try {
            // Get cached push target files
            const files = await this.utils().getPushTargets(activeFile);

            if (files.length === 0) {
                console.log("No push target files found");
                return;
            }

            // Get current selection/text
            const selection = this.utils().getActiveSelection();

            // Show file suggester
            const choice = await this.utils().showFileSuggester(
                files,
                "Choose target file",
            );

            if (!choice) {
                return; // User cancelled
            }

            // Analyze the current line/selection
            const lineInfo = await this.findLine(activeFile, selection);
            // Check for weekly file involvement (either source or target)
            const isWeeklyInvolved =
                lineInfo.path.endsWith("_week.md") ||
                choice.endsWith("_week.md");

            // Perform the appropriate push operation based on context
            if (lineInfo.selectedLines && lineInfo.selectedLines.length > 1) {
                await this.pushMultipleLinesAsBlob(choice, lineInfo);
            } else {
                if (lineInfo.heading) {
                    await this.pushHeader(choice, lineInfo);
                } else if (isWeeklyInvolved) {
                    await this.pushWeeklyTask(choice, lineInfo);
                } else {
                    await this.pushText(choice, lineInfo);
                }
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
        const split = fileContent.split("\n");
        const fileCache = this.app.metadataCache.getFileCache(activeFile);
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
            line = split[cursor];
        }

        let heading: string | undefined;
        let text: string | undefined;
        let mark: string | undefined;

        if (line?.match(/^\s*- .*/)) {
            // Extract text and mark from a task item
            const taskMatch = this.patterns.task.exec(line);
            if (taskMatch) {
                mark = taskMatch[2];
                text = taskMatch[3].trim();
            } else {
                // Not a task, just a list item
                text = line.replace(/^\s*- (.*)/, "$1").trim();
            }
        } else {
            if (!line || !line.startsWith("#")) {
                // No line, or the line isn't a heading: Find the first h2 heading in the file
                const headings = fileCache?.headings?.filter(
                    (x) => x.level === 2,
                );
                line = split[headings?.[0]?.position.start.line];
            }
            // Extract text from a heading
            heading = line?.replace(/#+ /, "").trim();
        }

        return {
            title,
            path: activeFile.path,
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
        targetPath: string,
        lineInfo: LineInfo,
    ): Promise<void> {
        if (!lineInfo.selectedLines) {
            return;
        }

        const targetFile = this.app.vault.getFileByPath(targetPath) as TFile;
        if (!targetFile) {
            console.log(`Target file not found: ${targetPath}`);
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
        const target = this.getCompletionStatus(targetPath);

        const originalText = lineInfo.selectedLines.join("\n");
        let processedText = originalText;

        if (type === "Tasks item") {
            const from = target.isDaily
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
            const task = target.shouldHaveCheckbox ? "[x] " : "";
            const from = source.fromDaily
                ? ""
                : `[${source.pretty}](${lineInfo.path}): `;
            const completed = task ? ` (${source.date})` : "";

            if (task) {
                processedText = processedText.replace(
                    /^(\s*)-\s*(?:\[.\]\s*)?(.+)$/gm,
                    `$1- ${task}${from}$2${completed}`,
                );
                processedText = processedText.replace(
                    /^(?!\s*-\s)(.+)$/gm,
                    `- ${task}${from}$1${completed}`,
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
     * Target: Daily notes or project logs
     *
     * Creates links to conversation sections, using "interesting" part or file title
     * if no interesting part exists.
     */
    private async pushHeader(
        targetPath: string,
        lineInfo: LineInfo,
    ): Promise<void> {
        const targetFile = this.app.vault.getFileByPath(targetPath) as TFile;
        if (!targetFile) {
            console.log(`Target file not found: ${targetPath}`);
            return;
        }

        const type = await this.utils().showFileSuggester(
            this.pushOptions.header,
            "Choose header type",
        );

        if (!type) {
            return;
        }

        const { date, interesting } = this.parseConversationHeading(
            lineInfo.heading || "",
        );
        const source = this.getSourceAttribution(lineInfo.path, lineInfo.title);
        const linkText = lineInfo.path === targetPath ? "⤴" : source.pretty;
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
            const addThis = `- [ ] [${linkText}](${lineInfo.path}#${anchor}): ${lineText}\n`;
            await this.addToSection(targetFile, "Tasks", addThis);
        } else {
            // Log item - create completed reference to conversation
            const target = this.getCompletionStatus(targetPath);
            const task = target.shouldHaveCheckbox ? "[x] " : "";
            const prefix = source.fromDaily
                ? ""
                : `[${linkText}](${lineInfo.path}#${anchor}): `;
            const completed = task
                ? source.fromDaily
                    ? `([${linkText}](${lineInfo.path}#${anchor}))`
                    : ` (${date})`
                : "";

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
        targetPath: string,
        lineInfo: LineInfo,
    ): Promise<void> {
        const targetFile = this.app.vault.getFileByPath(targetPath) as TFile;
        if (!targetFile) {
            console.log(`Target file not found: ${targetPath}`);
            return;
        }

        const source = this.getSourceAttribution(lineInfo.path, lineInfo.title);
        const isTargetWeekly = targetPath.endsWith("_week.md");
        const isSourceWeekly = lineInfo.path.endsWith("_week.md");
        const isForward = !source.fromDaily && isTargetWeekly; // Project → Weekly
        const isReturn = isSourceWeekly && !targetPath.endsWith("_week.md"); // Weekly → Project

        console.log(
            "PUSH WEEKLY TASK",
            `"${lineInfo.path}" → "${targetPath}"`,
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
                targetPath,
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
        targetPath: string,
        lineInfo: LineInfo,
    ): Promise<void> {
        const targetFile = this.app.vault.getFileByPath(targetPath) as TFile;
        if (!targetFile) {
            console.log(`Target file not found: ${targetPath}`);
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
        const target = this.getCompletionStatus(targetPath);
        const date = this.getBestDate(lineInfo.text, lineInfo.path);

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
            const task = target.shouldHaveCheckbox ? "[x] " : "";
            const from = source.fromDaily
                ? ""
                : `[${source.pretty}](${lineInfo.path}): `;
            const completed = task ? ` (${date})` : "";
            const text = source.fromDaily
                ? lineInfo.text.replace(
                      / #(self|work|home|community|family)/,
                      "",
                  )
                : lineInfo.text;

            const addThis = `- ${task}${from}${text}${completed}`;
            await this.addToSection(targetFile, "Log", addThis);
        }
    }

    // === HELPER METHODS ===

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
     * Get formatted source attribution for push operations
     */
    private getSourceAttribution = (
        path: string,
        title: string,
    ): {
        pretty: string;
        fromDaily: boolean;
        fromReminders: boolean;
        date: string;
    } => {
        const fromDaily = this.patterns.dated.test(path);
        const fromReminders = path.contains("Reminders.md");
        const pretty = path.contains("conversations")
            ? `**${title}**`
            : `_${title}_`;
        const date = fromDaily
            ? this.patterns.dated.exec(path)?.[1] || ""
            : window.moment().format("YYYY-MM-DD");

        return { pretty, fromDaily, fromReminders, date };
    };

    /**
     * Determine completion status based on target file type
     */
    private getCompletionStatus = (
        targetPath: string,
    ): {
        isDaily: boolean;
        isWeekly: boolean;
        shouldHaveCheckbox: boolean;
    } => {
        const isDaily = this.patterns.dated.test(targetPath);
        const isWeekly = targetPath.endsWith("_week.md");
        const shouldHaveCheckbox = !isDaily || isWeekly;

        return { isDaily, isWeekly, shouldHaveCheckbox };
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
        const sourceDate = this.patterns.dated.exec(sourcePath);
        if (sourceDate) {
            return sourceDate[1];
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
        }
    }
}

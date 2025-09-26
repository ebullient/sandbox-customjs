import type { App, TFolder } from "obsidian";
import type { Templater } from "./@types/templater.types";
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

/**
 * Cache for push target files
 */
interface PushTargetCache {
    data: string[];
    timestamp: number;
}

/**
 * Templates class for working with Obsidian Templater templates.
 * Provides utilities for file selection, content pushing, and conversation management.
 */
export class Templates {
    private readonly app: App;
    private fileCache: PushTargetCache | null = null;
    private readonly cacheTTL = 5 * 60 * 1000; // Cache valid for 5 minutes

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
        console.log("loaded Templates");
    }

    /**
     * Lazy-load utils function - important for dynamic updates
     */
    private utils = (): Utils => window.customJS.Utils;

    // === API METHODS ===

    /**
     * Prompt user to choose a file from the vault.
     */
    chooseFile = async (tp: Templater): Promise<string> => {
        const files = this.utils().filePaths();
        return await tp.system.suggester(files, files);
    };

    /**
     * Prompt user to choose a folder from the vault.
     */
    chooseFolder = async (tp: Templater, folder: string): Promise<string> => {
        const folders = this.utils()
            .foldersByCondition(
                folder,
                (tfolder: TFolder) => !tfolder.path.startsWith("assets"),
            )
            .map((f) => f.path);

        folders.unshift("--");
        const choice = await tp.system.suggester(folders, folders);

        if (!choice) {
            console.warn("No choice selected. Using 'athenaeum'");
            return "athenaeum";
        }

        return choice === "--"
            ? await tp.system.prompt("Enter folder path")
            : choice;
    };

    /**
     * Create a conversation entry for the specified day:
     * - Create a new dated section in the relevant file
     * - Add a link to the conversation in the daily log, and embed that section
     */
    createConversation = async (tp: Templater): Promise<string> => {
        const day = window.moment(tp.file.title).format("YYYY-MM-DD");
        const regex = this.utils().segmentFilterRegex(
            "chronicles/conversations",
        );
        const files = this.utils()
            .filesWithPath(regex)
            .map((x) => x.path);

        const choice = await tp.system.suggester(files, files);
        if (!choice) {
            return "";
        }

        const file = tp.file.find_tfile(choice);
        const fileCache = this.app.metadataCache.getFileCache(file);
        const title = fileCache.frontmatter?.aliases
            ? fileCache.frontmatter.aliases[0]
            : file.basename;

        const headings = fileCache?.headings?.filter((x) => x.level === 2);
        if (!headings || headings.length === 0) {
            await this.app.vault.process(file, (content) => {
                return `${content}\n\n## ${day}\n\n`;
            });
        } else if (headings[0].heading !== day) {
            await this.app.vault.process(file, (content) => {
                const split = content.split("\n");
                split.splice(
                    headings[0].position.start.line,
                    0,
                    `## ${day}\n\n`,
                );
                return split.join("\n");
            });
        }

        return [
            `- [**${title}**](${file.path}#${day})`,
            `    ![${day}](${file.path}#${day})`,
            "",
        ].join("\n");
    };

    /**
     * Main push method: prompts user to choose a file and pushes text to it.
     * Handles both single line (cursor position) and multiple lines (selection).
     * This is the primary method for managing "what I've done" on a day to projects/quests.
     */
    pushText = async (tp: Templater): Promise<string> => {
        const files = await this.cachedPushTargets();

        const view = this.app.workspace.getActiveViewOfType(
            window.customJS.obsidian.MarkdownView,
        );
        const originalText = view?.editor?.somethingSelected()
            ? view.editor.getSelection()
            : "";

        const choice = await tp.system.suggester(files, files);
        if (!choice) {
            return originalText;
        }

        const lineInfo = await this.findLine(tp, originalText);

        if (lineInfo.selectedLines && lineInfo.selectedLines.length > 1) {
            await this.doPushMultipleLinesAsBlob(tp, choice, lineInfo);
            return originalText || lineInfo.selectedLines.join("\n");
        }

        // Check for weekly file involvement (either source or target)
        const isWeeklyInvolved =
            lineInfo.path.endsWith("_week.md") || choice.endsWith("_week.md");

        if (lineInfo.heading) {
            await this.doPushHeader(tp, choice, lineInfo);
        } else if (isWeeklyInvolved) {
            await this.doPushWeeklyTask(tp, choice, lineInfo);
        } else {
            await this.doPushText(tp, choice, lineInfo);
        }

        return originalText;
    };

    // === CONTENT ANALYSIS METHODS ===

    /**
     * Find the current line or selection in the active file and extract relevant information.
     */
    findLine = async (
        tp: Templater,
        originalSelection?: string,
    ): Promise<LineInfo> => {
        let line: string | undefined;
        let selectedLines: string[] | undefined;

        const split = tp.file.content.split("\n");
        const file = tp.file.find_tfile(tp.file.title);
        const fileCache = this.app.metadataCache.getFileCache(file);
        const title = this.utils().fileTitle(file);

        const view = this.app.workspace.getActiveViewOfType(
            window.customJS.obsidian.MarkdownView,
        );

        if (originalSelection) {
            selectedLines = originalSelection
                .split("\n")
                .filter((line) => line.trim() !== "");

            if (selectedLines.length > 0) {
                line = selectedLines[0];
            }
        } else if (view?.editor) {
            if (view.editor.somethingSelected()) {
                const selectionStart = view.editor.getCursor("from");
                const selectionEnd = view.editor.getCursor("to");

                const selection = view.editor.getRange(
                    selectionStart,
                    selectionEnd,
                );

                selectedLines = selection
                    .split("\n")
                    .filter((line) => line.trim() !== "");

                if (selectedLines.length > 0) {
                    line = selectedLines[0];
                }
            } else {
                const cursor = view.editor.getCursor("from").line;
                line = split[cursor];
            }
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
            path: tp.file.path(true),
            heading,
            text,
            mark,
            selectedLines,
        };
    };

    /**
     * Get cached list of files that can be push targets.
     * Pre-finds matched headings to avoid re-searching when cache is stale.
     */
    cachedPushTargets = async (): Promise<string[]> => {
        const now = Date.now();

        if (this.fileCache && now - this.fileCache.timestamp < this.cacheTTL) {
            console.log("Using cached files");
            return this.fileCache.data;
        }

        console.log("Refreshing file cache");
        const files = this.utils()
            .filesMatchingCondition((file) => {
                console.log("Checking file", file.path);
                const isConversation = file.path.contains("conversations");
                const isNotArchived = !file.path.contains("archive");
                const isWeekly = file.path.contains("_week.md");

                const fileHeadings = this.app.metadataCache.getCache(
                    file.path,
                )?.headings;
                const hasRelevantHeadings = fileHeadings
                    ? fileHeadings
                          .filter((x) => x.level === 2)
                          .some((x) => x.heading.match(/(Log|Task)/))
                    : false;

                return (
                    isWeekly ||
                    isConversation ||
                    (isNotArchived && hasRelevantHeadings)
                );
            }, false)
            .map((f) => f.path);

        this.fileCache = { data: files, timestamp: now };
        return files;
    };

    // === WRITE OPERATIONS ===

    /**
     * Add text to a specified section in a file.
     */
    addToSection = async (
        tp: Templater,
        choice: string,
        addThis: string,
        section = "Log",
    ): Promise<void> => {
        const file = tp.file.find_tfile(choice);
        const fileCache = this.app.metadataCache.getFileCache(file);

        if (!fileCache?.headings) {
            console.warn(`No metadata cache or headings found for ${choice}`);
            return;
        }

        const headings = fileCache.headings
            .filter((x) => x.level >= 2)
            .filter((x) => x.heading.contains(section));

        if (headings[0]) {
            await this.app.vault.process(file, (content) => {
                const split = content.split("\n");
                split.splice(headings[0].position.start.line + 1, 0, addThis);
                return split.join("\n");
            });
        }
    };

    // === HELPER METHODS FOR PUSH OPERATIONS ===

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
     * Handle pushing multiple selected lines as a blob to the specified file.
     * Uses regex to mark list items as complete and maintains order.
     */
    doPushMultipleLinesAsBlob = async (
        tp: Templater,
        choice: string,
        lineInfo: LineInfo,
    ): Promise<void> => {
        const type = await tp.system.suggester(
            this.pushOptions.item,
            this.pushOptions.item,
        );
        const source = this.getSourceAttribution(lineInfo.path, lineInfo.title);
        const target = this.getCompletionStatus(choice);

        const originalText = lineInfo.selectedLines?.join("\n") || "";
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
            const completed = task
                ? source.fromDaily
                    ? ` ([${source.pretty}](${lineInfo.path}))`
                    : ` (${source.date})`
                : "";

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

        await this.addToSection(tp, choice, processedText);
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
     * Create a new section with heading and embed
     * Used for "Section" type pushes
     */
    private createNewSection = async (
        tp: Templater,
        targetFile: string,
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

        const file = tp.file.find_tfile(targetFile);
        const fileCache = this.app.metadataCache.getFileCache(file);

        if (!fileCache?.headings) {
            console.warn(
                `No metadata cache or headings found for ${targetFile}`,
            );
            return;
        }

        const headings = fileCache.headings.filter((x) => x.level === 2);

        await this.app.vault.process(file, (content) => {
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
     * PATTERN 1: Push conversation header references
     *
     * Purpose: Reference what happened in a conversation on a specific day
     * Source: Conversation files with dated headings like "## 2023-10-11 Foundation materials review"
     * Target: Daily notes or project logs
     *
     * Creates links to conversation sections, using "interesting" part or file title
     * if no interesting part exists.
     */
    doPushHeader = async (
        tp: Templater,
        choice: string,
        line: LineInfo,
    ): Promise<void> => {
        const type = await tp.system.suggester(
            this.pushOptions.header,
            this.pushOptions.header,
        );

        const { date, interesting } = this.parseConversationHeading(
            line.heading || "",
        );
        const source = this.getSourceAttribution(line.path, line.title);
        const linkText = line.path === choice ? "⤴" : source.pretty;
        const lineText = interesting || line.title; // Use file title if no interesting part
        const anchor = this.createAnchor(line.heading || "");

        console.log("PUSH HEADER", line, date, interesting, linkText, lineText);

        if (type === "Section") {
            await this.createNewSection(
                tp,
                choice,
                line.heading || "",
                line.title,
                line.path,
                anchor,
            );
        } else if (type === "Tasks item") {
            const addThis = `- [ ] [${linkText}](${line.path}#${anchor}): ${lineText}\n`;
            await this.addToSection(tp, choice, addThis, "Tasks");
        } else {
            // Log item - create completed reference to conversation
            const target = this.getCompletionStatus(choice);
            const task = target.shouldHaveCheckbox ? "[x] " : "";
            const prefix = source.fromDaily
                ? ""
                : `[${linkText}](${line.path}#${anchor}): `;
            const completed = task
                ? source.fromDaily
                    ? `([${linkText}](${line.path}#${anchor}))`
                    : ` (${date})`
                : "";

            const addThis = `- ${task}${prefix}${lineText}${completed}`;
            console.log("doPushHeader: Log", addThis);
            await this.addToSection(tp, choice, addThis);
        }
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
     * PATTERN 2: Push daily progress items
     *
     * Purpose: Track "what I did" progress from daily notes to project tracking
     * Source: Daily notes with accomplishment lines like "- Haus Manager: Fixed NPE for team sync"
     * Target: Project files
     *
     * Output:
     * - Log item: "- [x] ... ([_2025-09-17_](chronicles/2025/2025-09-17.md))" (completed, with source link)
     * - Task item: "- [ ] ... from [_Daily Note_](path)" (unchecked, for future work)
     */
    doPushText = async (
        tp: Templater,
        choice: string,
        line: LineInfo,
    ): Promise<void> => {
        const type = await tp.system.suggester(
            this.pushOptions.item,
            this.pushOptions.item,
        );

        const source = this.getSourceAttribution(line.path, line.title);
        const target = this.getCompletionStatus(choice);
        const date = this.getBestDate(line.text, line.path);

        console.log(
            "PUSH TEXT",
            `"${line.path}"`,
            `"${line.text}"`,
            `"${date}"`,
        );

        if (type === "Tasks item") {
            // Create unchecked task with source attribution
            const from =
                target.isDaily || source.fromReminders
                    ? ""
                    : ` from [${source.pretty}](${line.path})`;
            const addThis = `- [ ] ${line.text}${from}`;
            await this.addToSection(tp, choice, addThis, "Tasks");
        } else {
            // Create log entry (completed if going to project file)
            const task = target.shouldHaveCheckbox ? "[x] " : "";
            const from = source.fromDaily
                ? ""
                : `[${source.pretty}](${line.path}): `;
            const completed = task
                ? source.fromDaily
                    ? ` ([${source.pretty}](${line.path}))`
                    : ` (${date})`
                : "";

            const addThis = `- ${task}${from}${line.text}${completed}`;
            await this.addToSection(tp, choice, addThis);
        }
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
     * PATTERN 3: Weekly planning workflow
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
    doPushWeeklyTask = async (
        tp: Templater,
        choice: string,
        lineInfo: LineInfo,
    ): Promise<void> => {
        const source = this.getSourceAttribution(lineInfo.path, lineInfo.title);
        const isTargetWeekly = choice.endsWith("_week.md");
        const isSourceWeekly = lineInfo.path.endsWith("_week.md");
        const isForward = !source.fromDaily && isTargetWeekly; // Project → Weekly
        const isReturn = isSourceWeekly && !choice.endsWith("_week.md"); // Weekly → Project

        console.log(
            "PUSH WEEKLY TASK",
            `"${lineInfo.path}" → "${choice}"`,
            `forward: ${isForward}, return: ${isReturn}`,
        );

        if (isForward) {
            // Project → Weekly: Add task to weekly Tasks section with project link
            const addThis = `- [ ] [${source.pretty}](${lineInfo.path}): ${lineInfo.text}\n`;
            await this.addToSection(tp, choice, addThis, "Tasks");
        } else if (isReturn) {
            // Weekly → Project: Check if completed and route appropriately
            if (!lineInfo.mark || !lineInfo.text) {
                console.warn(
                    "Could not parse task line - missing mark or text:",
                    lineInfo,
                );
                return;
            }

            const isCompleted = this.isTaskCompleted(lineInfo.mark);
            const hasDate = this.hasCompletionDate(lineInfo.text);

            if (isCompleted) {
                // Completed: Add to project Log section
                const completionDate = hasDate
                    ? "" // Already has date, don't add weekly reference
                    : ` (${this.getBestDate(lineInfo.text, lineInfo.path)})`;

                const addThis = `- [${lineInfo.mark}] ${lineInfo.text}${completionDate}`;
                console.log("task completed", completionDate, addThis);

                await this.addToSection(tp, choice, addThis, "Log");
            } else {
                // Not completed: Return to project Tasks section
                const addThis = `- [${lineInfo.mark}] ${lineInfo.text}`;
                await this.addToSection(tp, choice, addThis, "Tasks");
            }
        } else {
            console.warn(
                "Weekly task push: Could not determine direction",
                lineInfo.path,
                "→",
                choice,
            );
        }
    };
}

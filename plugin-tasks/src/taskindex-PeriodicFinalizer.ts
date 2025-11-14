import type { App, TFile } from "obsidian";
import * as CommonPatterns from "./taskindex-CommonPatterns";
import type { TaskEngine } from "./taskindex-TaskEngine";

/**
 * Finalizes daily and weekly periodic files
 * "Seals" or "tidies up" completed periodic notes by:
 * - Converting checkboxes to emoji (final state)
 * - Removing template scaffolding
 * - Replacing js-engine task blocks with static markdown
 */

export class PeriodicFinalizer {
    constructor(
        private app: App,
        private taskEngine: TaskEngine,
    ) {}

    /**
     * Finalize the currently active file if it's a daily or weekly note
     */
    async finalizeActiveFile(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }

        const fileType = this.detectFileType(activeFile);

        console.log(
            `[PeriodicFinalization] Finalizing ${fileType} file: ${activeFile.name}`,
        );

        // Read file content
        const content = await this.app.vault.read(activeFile);
        let transformed = content.split("\n");

        // Transform content based on file type
        if (fileType === "daily") {
            transformed = this.finalizeDailyFile(transformed);
        } else if (fileType === "weekly") {
            transformed = this.finalizeWeeklyFile(transformed);
            transformed = await this.replaceTaskBlocks(transformed, activeFile);
        } else {
            // "other" type
            transformed = this.finalizeOtherFile(transformed);
            transformed = await this.replaceTaskBlocks(transformed, activeFile);
        }
        transformed = this.collapseBlankLines(transformed);

        // Write transformed content back
        await this.app.vault.modify(activeFile, transformed.join("\n"));
    }

    /**
     * Detect if a file is a daily, weekly, or other note based on configured patterns
     */
    private detectFileType(file: TFile): "daily" | "weekly" | "other" {
        if (CommonPatterns.DAILY_NOTE_REGEX.test(file.name)) {
            return "daily";
        }
        if (CommonPatterns.WEEKLY_NOTE_REGEX.test(file.name)) {
            return "weekly";
        }
        // "other" is any markdown file that's not daily or weekly
        return "other";
    }

    /**
     * Finalize a daily note file
     */
    private finalizeDailyFile(lines: string[]): string[] {
        // Remove generic/standard time blocks (uncompleted tasks)
        lines = this.removeGenericTimeBlocks(lines);

        // Convert checkbox markers to emoji
        lines = this.convertCheckboxesToEmoji(lines);

        // Add frontmatter if not present
        lines = this.ensureFrontmatter(lines, "My Day");

        // Remove template text, consolidate empty lines
        let revised = lines
            .join("\n")
            .replace(/%% agenda %%(([\s\S]*?)%% agenda %%)?/g, "")
            .replace(/\n%%\n- 🎉[\s\S]*?\n%%\n/, "")
            .replace(/\n%% %%\n/g, "\n")
            .replace(/\n- \.\n/g, "")
            .replace(/\n\d\. \.\n/g, "");

        // Collapse empty Day Planner sections
        revised = revised.replace(
            /^### ❧? ?(Morning|After Lunch|Afternoon|Wrap up)\n+(?=###|##|>)/gm,
            "",
        );

        // Remove template callout blocks
        return this.removeTemplateCallouts(revised.split("\n"));
    }

    /**
     * Finalize a weekly note file
     */
    private finalizeWeeklyFile(lines: string[]): string[] {
        // Step 1: Convert checkbox markers to emoji
        lines = this.convertCheckboxesToEmoji(lines);

        // Step 2: Clean up links (tag links and app:// links)
        lines = this.cleanupLinks(lines);

        // Step 3: Fix list whitespace after link cleanup
        lines = lines.map((line) => line.replace(/^(\s*)-\s+(.*)$/, "$1- $2"));

        // Step 4: Remove unmarked tasks and completed standard tasks
        lines = this.removeWeeklyStandardTasks(lines);

        // Step 5: Add frontmatter if not present
        return this.ensureFrontmatter(lines, "Week of ");
    }

    /**
     * Finalize other files (not daily or weekly)
     */
    private finalizeOtherFile(lines: string[]): string[] {
        // Step 1: Convert checkbox markers to emoji
        lines = this.convertCheckboxesToEmoji(lines);

        // Step 2: Clean up links (tag links and app:// links)
        return this.cleanupLinks(lines);
    }

    /**
     * Remove generic/standard time blocks from daily files
     * These are template scaffolding that wasn't filled in
     */
    private removeGenericTimeBlocks(lines: string[]): string[] {
        const genericPatterns = [
            /^- \[[x ]\]\s+\d+:\d+\s+Start[ :]*$/,
            /^- \[[x ]\]\s+\d+:\d+\s+.*GH Notifications \/ Email$/,
            /^- \[[x ]\]\s+\d+:\d+\s+BREAK( \/ chat)?$/,
            /^- \[[x ]\]\s+\d+:\d+\s+.* to the bus$/,
            /^- \[[x ]\]\s+\d+:\d+\s+Meditation.*$/,
            /^- \[[x ]\]\s+\d+:\d+\s+(Planning|Lunch|Email|Reflection|Preview).*$/,
            /^- \[[x ]\]\s+\d+:\d+\s+END.*$/,
        ];

        return lines.filter((line) => {
            for (const pattern of genericPatterns) {
                if (pattern.test(line)) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * Convert checkbox markers to emoji
     */
    private convertCheckboxesToEmoji(lines: string[]): string[] {
        return lines.map((line) => {
            return (
                line
                    // single space: - [ ] stuff
                    .replace(/^(\s*)-\s+(\[.\])\s+(.*)/, "$1- $2 $3")
                    // [x] -> ✔️
                    .replace(/^(\s*)- \[x\]/, "$1- ✔️")
                    // [r] or [R] -> 👀
                    .replace(/^(\s*)- \[r\]/i, "$1- 👀")
                    // [/] -> 🔛
                    .replace(/^(\s*)- \[\/\]/, "$1- 🔛")
                    // [>] -> 🔜
                    .replace(/^(\s*)- \[>\]/, "$1- 🔜")
                    // [-] -> 〰️ ~~text~~
                    .replace(/^(\s*)- \[-\]\s+(.*)$/, "$1- 〰️ ~~$2~~")
            );
        });
    }

    /**
     * Clean up unwanted links:
     * - Convert tag links back to plain tags: [#next](index.html#next) -> #next
     * - Remove app://obsidian.md links (replace with empty string)
     */
    private cleanupLinks(lines: string[]): string[] {
        return lines.map((line) => {
            return line
                .replace(/\[(#[^\]]+)\]\(index\.html#[^)]+\)/g, "$1")
                .replace(/app:\/\/obsidian\.md/g, "");
        });
    }

    /**
     * Parse js-engine code block calling TaskIndex API methods
     * Returns null if not a recognized pattern
     */
    private parseTaskBlock(blockContent: string): {
        method: string;
        dateString?: string;
        tag?: string;
        all?: boolean;
    } | null {
        // Match generateWeeklyTasksForEngine(engine)
        if (
            blockContent.includes("generateWeeklyTasksForEngine(engine)") ||
            blockContent.includes("Tasks.thisWeekTasks(engine)")
        ) {
            return { method: "thisWeekTasks" };
        }

        // Match generateFixedWeekTasksForEngine(engine, "date", "tag", all)
        const fixedMatch = blockContent.match(
            /generateFixedWeekTasksForEngine\(engine,\s*"([^"]+)"(?:,\s*"([^"]+)")?(?:,\s*(true|false))?\)/,
        );
        if (fixedMatch) {
            return {
                method: "fixedWeekTasks",
                dateString: fixedMatch[1],
                tag: fixedMatch[2] || undefined,
                all: fixedMatch[3] === "true",
            };
        }

        // Legacy: Match Tasks.fixedWeekTasks(engine, "date", "tag", all)
        const legacyFixedMatch = blockContent.match(
            /Tasks\.fixedWeekTasks\(engine,\s*"([^"]+)"(?:,\s*"([^"]+)")?(?:,\s*(true|false))?\)/,
        );
        if (legacyFixedMatch) {
            return {
                method: "fixedWeekTasks",
                dateString: legacyFixedMatch[1],
                tag: legacyFixedMatch[2] || undefined,
                all: legacyFixedMatch[3] === "true",
            };
        }

        return null;
    }

    private isTierBlock(blockContent: string): boolean {
        return blockContent.includes("TierTracker.createGrid(engine)");
    }

    /**
     * Generate task list markdown based on parameters
     * Delegates to TaskService for task collection
     */
    private async generateTaskList(
        currentFile: TFile,
        params: {
            method: string;
            dateString?: string;
            tag?: string;
            all?: boolean;
        },
    ): Promise<string> {
        if (params.method === "thisWeekTasks") {
            return this.taskEngine.generateWeeklyTasks(currentFile);
        }

        if (params.method === "fixedWeekTasks") {
            return this.taskEngine.generateFixedWeekTasks(
                currentFile,
                params.dateString || "",
                params.tag,
                params.all || false,
            );
        }

        return "";
    }

    /**
     * Replace js-engine code blocks with fresh task list content
     */
    private async replaceTaskBlocks(
        lines: string[],
        currentFile: TFile,
    ): Promise<string[]> {
        const newLines: string[] = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // Check if this is a js-engine code block start
            if (line.trim().match("```js-engine(-debug)?")) {
                // Find the end of the code block
                let blockEnd = i + 1;
                let blockContent = "";

                while (
                    blockEnd < lines.length &&
                    lines[blockEnd].trim() !== "```"
                ) {
                    blockContent += `${lines[blockEnd]}\n`;
                    blockEnd++;
                }

                // Try to parse as a Tasks block
                const params = this.parseTaskBlock(blockContent);

                if (params) {
                    // Generate fresh content
                    const markdown = await this.generateTaskList(
                        currentFile,
                        params,
                    );
                    // Replace block with just the markdown (no code block)
                    newLines.push(...markdown.split("\n"));
                } else if (this.isTierBlock(blockContent)) {
                    newLines.push("");
                } else {
                    // Not a recognized Tasks block, keep original
                    for (let j = i; j <= blockEnd; j++) {
                        newLines.push(lines[j]);
                    }
                }
                // Skip to end of block
                i = blockEnd + 1;
            } else {
                newLines.push(line);
                i++;
            }
        }
        return newLines;
    }

    /**
     * Remove unmarked tasks and completed standard maintenance tasks from weekly files
     */
    private removeWeeklyStandardTasks(lines: string[]): string[] {
        const standardTaskPatterns = [
            /^%% \*?\*?(self care|maintenance)\*?\*? %%$/i,
            /^(\s*)- ✔️ \[Reflect on last week\]\(.*\).*$/,
            /^(\s*)- ✔️ Update activity rings.*$/,
            /^(\s*)- ✔️ Review \[gh-triage\]\(gh-triage.md\).*$/,
            /^(\s*)- ✔️ Check "missing".*$/,
            /^(\s*)- ✔️ Review \[All Tasks\]\(all-tasks.md\).*$/,
            /^(\s*)- ✔️ Review \[percolator\]\(percolator.md\).*$/,
            /^(\s*)- ✔️ File any \[Inbox\]\(Inbox.md\) items.*$/,
            /^(\s*)- ✔️ (`qk` and )?updates on .*$/,
            /^(\s*)- ✔️ check on moria.*$/,
            /^(\s*)- ✔️ water plants.*$/,
        ];

        return lines.filter((line) => {
            // Remove unmarked tasks [ ]
            if (line.match(/^(\s*)- \[ \]/)) {
                return false;
            }

            // Remove completed standard maintenance tasks
            for (const pattern of standardTaskPatterns) {
                if (pattern.test(line)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Remove template callout blocks (mood, tier strategies)
     * These are flashcard-style prompts that don't need to be preserved
     */
    private removeTemplateCallouts(lines: string[]): string[] {
        let content = lines.join("\n");
        // Remove mood callout block (entire callout including all lines and block ref)
        content = content.replace(
            /^> \[!mood\]-[^\n]*(?:\n>.*)*(?:\n\^[^\n]+)?(?:\n|$)/gm,
            "",
        );

        // Remove tier strategy callout block (entire callout including embed and block ref)
        content = content.replace(
            /^> \[!tip\]- Tier \d+ Strategies[^\n]*(?:\n>.*)*(?:\n\^[^\n]+)?(?:\n|$)/gm,
            "",
        );

        return content.split("\n");
    }

    /**
     * Ensure frontmatter exists with obsidianUIMode: preview
     */
    private ensureFrontmatter(lines: string[], titlePrefix: string): string[] {
        // Check if frontmatter already exists
        if (lines[0] === "---") {
            // Frontmatter exists, don't modify
            return lines;
        }

        // Find the title line (starts with #)
        let titleIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`# ${titlePrefix}`)) {
                titleIndex = i;
                break;
            }
        }

        const defaultYaml = ["---", "obsidianUIMode: preview", "---"];

        if (titleIndex === -1) {
            // No title found, add frontmatter at top
            return [...defaultYaml, "", ...lines];
        }

        // Insert frontmatter before title
        return [...defaultYaml, ...lines.slice(titleIndex)];
    }

    /**
     * Collapse consecutive blank lines (ignoring whitespace) down to two
     */
    private collapseBlankLines(lines: string[]): string[] {
        const collapsed: string[] = [];
        let seenBlank = false;

        for (const line of lines) {
            if (line.trim().length === 0) {
                if (!seenBlank) {
                    collapsed.push("");
                    seenBlank = true;
                }
            } else {
                seenBlank = false;
                collapsed.push(line);
            }
        }

        return collapsed;
    }
}

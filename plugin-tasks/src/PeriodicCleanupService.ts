import type { App, TFile } from "obsidian";

/**
 * Service for cleaning up completed daily and weekly periodic files
 * Replaces regex pipeline plugin functionality with programmatic transformations
 */
export class PeriodicCleanupService {
    dailyRegex = new RegExp(/(\d{4}-\d{2}-\d{2})\.md/);
    weeklyRegex = new RegExp(/(\d{4}-\d{2}-\d{2})_week\.md/);

    constructor(private app: App) {}

    /**
     * Clean up the currently active file if it's a daily or weekly note
     */
    async cleanupActiveFile(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }

        const fileType = this.detectFileType(activeFile);

        console.log(
            `[PeriodicCleanup] Cleaning ${fileType} file: ${activeFile.name}`,
        );

        await this.app.vault.process(activeFile, (content) => {
            if (fileType === "daily") {
                return this.cleanupDailyFile(content);
            }
            if (fileType === "weekly") {
                return this.cleanupWeeklyFile(content);
            }
            return this.cleanupOtherFile(content);
        });
    }

    /**
     * Detect if a file is a daily, weekly, or other note based on configured patterns
     */
    private detectFileType(file: TFile): "daily" | "weekly" | "other" {
        if (this.dailyRegex.test(file.name)) {
            return "daily";
        }
        if (this.weeklyRegex.test(file.name)) {
            return "weekly";
        }
        // "other" is any markdown file that's not daily or weekly
        return "other";
    }

    /**
     * Clean up a daily note file
     */
    private cleanupDailyFile(content: string): string {
        let lines = content.split("\n");

        // Remove generic/standard time blocks (uncompleted tasks)
        lines = this.removeGenericTimeBlocks(lines);

        // Convert checkbox markers to emoji
        lines = this.convertCheckboxesToEmoji(lines);

        // Add frontmatter if not present
        lines = this.ensureFrontmatter(lines, "My Day");

        // Remove template text, consoldiate empty lines.
        let revised = lines
            .join("\n")
            .replace(/%% agenda %%(([\s\S]*?)%% agenda %%)?/g, "")
            .replace(/\n%%\n- 🎉[\s\S]*?\n%%\n/, "")
            .replace(/\n- \.\n/g, "")
            .replace(/\n\d\. \.\n/g, "")
            .replace(/\n\n\n+/g, "\n\n");

        // Collapse empty Day Planner sections
        revised = revised.replace(
            /^### ❧? ?(Morning|After Lunch|Afternoon|Wrap up)\n+(?=###|##|>)/gm,
            "",
        );

        return revised;
    }

    /**
     * Clean up a weekly note file
     */
    private cleanupWeeklyFile(content: string): string {
        let lines = content.split("\n");

        // Step 1: Convert checkbox markers to emoji
        lines = this.convertCheckboxesToEmoji(lines);

        // Step 2: Clean up links (tag links and app:// links)
        lines = this.cleanupLinks(lines);

        // Step 3: Fix list whitespace after link cleanup
        lines = lines.map((line) => line.replace(/^(\s*)-\s+(.*)$/, "$1- $2"));

        // Step 4: Remove unmarked tasks and completed standard tasks
        lines = this.removeWeeklyStandardTasks(lines);

        // Step 5: Add frontmatter if not present
        lines = this.ensureFrontmatter(lines, "Week of ");

        return lines.join("\n");
    }

    /**
     * Clean up other files (not daily or weekly)
     */
    private cleanupOtherFile(content: string): string {
        let lines = content.split("\n");

        // Step 1: Convert checkbox markers to emoji
        lines = this.convertCheckboxesToEmoji(lines);

        // Step 2: Clean up links (tag links and app:// links)
        lines = this.cleanupLinks(lines);

        return lines.join("\n");
    }

    /**
     * Remove generic/standard time blocks from daily files
     * These are template scaffolding that wasn't filled in
     */
    private removeGenericTimeBlocks(lines: string[]): string[] {
        const genericPatterns = [
            /^- \[[x ]\]\s+\d+:\d+\s+Start[ :]*$/,
            /^- \[[x ]\]\s+\d+:\d+\s+.*GH Notifications \/ Email$/,
            /^- \[[x ]\]\s+\d+:\d+\s+BREAK$/,
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
     * Remove unmarked tasks and completed standard maintenance tasks from weekly files
     */
    private removeWeeklyStandardTasks(lines: string[]): string[] {
        const standardTaskPatterns = [
            /^(\s*)- ✔️ Review \[gh-triage\]\(gh-triage.md\).*$/,
            /^(\s*)- ✔️ File any \[Inbox\]\(Inbox.md\) items.*$/,
            /^(\s*)- ✔️ Review \[All Tasks\]\(all-tasks.md\) and \[percolator\]\(percolator.md\).*$/,
            /^(\s*)- ✔️ Review \[percolator\]\(percolator.md\).*$/,
            /^(\s*)- ✔️ Check "missing".*$/,
            /^(\s*)- ✔️ updates on .*$/,
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

        if (titleIndex === -1) {
            // No title found, add frontmatter at top
            return ["---", "obsidianUIMode: preview", "---", "", ...lines];
        }

        // Insert frontmatter before title
        return [
            "---",
            "obsidianUIMode: preview",
            "---",
            ...lines.slice(titleIndex),
        ];
    }
}

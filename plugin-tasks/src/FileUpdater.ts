import type { App, CachedMetadata } from "obsidian";
import type { QuestFile } from "./@types";

/**
 * Handles writing quest changes back to files
 */
export class FileUpdater {
    private static readonly TASKS_SECTION = "Tasks";

    constructor(private app: App) {}

    /**
     * Update a quest file with changes from review
     */
    async updateQuestFile(quest: QuestFile): Promise<void> {
        const file = this.app.vault.getFileByPath(quest.path);
        if (!file) {
            console.error(`[FileUpdater] File not found: ${quest.path}`);
            return;
        }

        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) {
            console.error(`[FileUpdater] No metadata cache for: ${quest.path}`);
            return;
        }

        await this.app.vault.process(file, (content) => {
            return this.updateContent(content, quest, cache);
        });
    }

    /**
     * Update file content with quest changes
     */
    private updateContent(content: string, quest: QuestFile, cache: CachedMetadata): string {
        const lines = content.split("\n");

        // Update frontmatter
        const withFrontmatter = this.updateFrontmatter(lines, quest.sphere);

        // Update purpose section
        const withPurpose = this.updatePurpose(withFrontmatter, quest.purpose, cache);

        // Update tasks section with raw content
        return this.replaceTaskSection(withPurpose, quest.rawTaskContent, cache);
    }

    /**
     * Replace the entire Tasks section with new content
     */
    private replaceTaskSection(lines: string[], taskContent: string, cache: CachedMetadata): string {
        // Find Tasks section using metadata cache
        const tasksHeading = cache.headings?.find(
            (h) => h.level === 2 && h.heading.includes(FileUpdater.TASKS_SECTION),
        );

        if (!tasksHeading) {
            console.warn("[FileUpdater] No Tasks section found");
            return lines.join("\n");
        }

        // Content starts after heading
        const startIdx = tasksHeading.position.start.line + 1;

        // Find next heading at same or higher level
        let endIdx = lines.length;
        const nextHeading = cache.headings?.find(
            (h) => h.level <= 2 && h.position.start.line > tasksHeading.position.start.line,
        );
        if (nextHeading) {
            endIdx = nextHeading.position.start.line;
        }

        // Replace the task section
        const result = [...lines.slice(0, startIdx), ...taskContent.split("\n"), ...lines.slice(endIdx)];

        return result.join("\n");
    }

    /**
     * Update frontmatter with sphere
     */
    private updateFrontmatter(lines: string[], sphere?: string): string[] {
        const result = [...lines];

        if (lines[0] !== "---") {
            return result;
        }

        // Find end of frontmatter
        let endIdx = -1;
        for (let i = 1; i < lines.length; i++) {
            if (lines[i] === "---") {
                endIdx = i;
                break;
            }
        }

        if (endIdx === -1) {
            return result;
        }

        // Check if sphere already exists
        let sphereLineIdx = -1;
        for (let i = 1; i < endIdx; i++) {
            if (lines[i].startsWith("sphere:")) {
                sphereLineIdx = i;
                break;
            }
        }

        if (sphere) {
            const sphereLine = `sphere: ${sphere}`;
            if (sphereLineIdx !== -1) {
                // Update existing
                result[sphereLineIdx] = sphereLine;
            } else {
                // Add after type field
                const typeIdx = result.findIndex((l) => l.startsWith("type:"));
                if (typeIdx !== -1) {
                    result.splice(typeIdx + 1, 0, sphereLine);
                }
            }
        } else if (sphereLineIdx !== -1) {
            // Remove sphere if cleared
            result.splice(sphereLineIdx, 1);
        }

        return result;
    }

    /**
     * Update purpose section (content between first heading and ## Tasks)
     */
    private updatePurpose(lines: string[], purpose: string, cache: CachedMetadata): string[] {
        // Find first heading (usually H1 title) - purpose starts after it
        const firstHeading = cache.headings?.[0];
        if (!firstHeading) {
            return lines;
        }

        const startIdx = firstHeading.position.end.line + 1;

        // Find ## Tasks section
        const tasksHeading = cache.headings?.find(
            (h) => h.level === 2 && h.heading.includes(FileUpdater.TASKS_SECTION),
        );
        if (!tasksHeading) {
            return lines;
        }

        const tasksIdx = tasksHeading.position.start.line;

        // Replace purpose section (after first heading, before Tasks)
        const result = [...lines.slice(0, startIdx), ...purpose.split("\n"), "", ...lines.slice(tasksIdx)];

        return result;
    }
}

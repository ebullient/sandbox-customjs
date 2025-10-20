import type { App, CachedMetadata } from "obsidian";
import type { QuestFile, SectionBoundaries } from "./@types";
import * as TaskParser from "./TaskParser";

/**
 * Handles writing quest changes back to files
 */
export class FileUpdater {
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

        // Get fresh cache for atomic update
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) {
            console.error(`[FileUpdater] No metadata cache for: ${quest.path}`);
            return;
        }

        // Update content (purpose + tasks) atomically
        await this.app.vault.process(file, (content) => {
            return this.updateContent(content, quest, cache);
        });

        // Update frontmatter atomically (after content update)
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            if (quest.sphere) {
                frontmatter.sphere = quest.sphere;
            } else {
                delete frontmatter.sphere;
            }
        });
    }

    /**
     * Update file content with quest changes
     * Re-parses section boundaries from current content to ensure accuracy
     */
    private updateContent(
        content: string,
        quest: QuestFile,
        cache: CachedMetadata,
    ): string {
        let lines = content.split("\n");

        // Find current section boundaries using cache
        const boundaries = TaskParser.findSectionBoundaries(lines, cache);

        // Update tasks section first (bottom section)
        lines = this.replaceTaskSection(lines, quest, boundaries);

        // Update purpose section (middle section)
        lines = this.updatePurpose(lines, quest, boundaries);

        return lines.join("\n");
    }

    /**
     * Replace the entire Tasks section with new content
     */
    private replaceTaskSection(
        lines: string[],
        quest: QuestFile,
        boundaries: SectionBoundaries,
    ): string[] {
        // Replace task content (preserve the ## Tasks heading at tasksStart)
        const contentStart = boundaries.tasksStart + 1;

        return [
            ...lines.slice(0, contentStart),
            ...quest.rawTaskContent.split("\n"),
            ...lines.slice(boundaries.tasksEnd),
        ];
    }

    /**
     * Update purpose section (content after H1 title, before ## Tasks)
     */
    private updatePurpose(
        lines: string[],
        quest: QuestFile,
        boundaries: SectionBoundaries,
    ): string[] {
        // Replace purpose content (between purposeStart and tasksStart)
        // Add blank line before Tasks heading for readability
        return [
            ...lines.slice(0, boundaries.purposeStart),
            ...quest.purpose.split("\n"),
            "",
            ...lines.slice(boundaries.tasksStart),
        ];
    }
}

import {
    type App,
    type CachedMetadata,
    type TAbstractFile,
    TFile,
} from "obsidian";
import type { CurrentSettings, QuestFile, Task, TaskTag } from "./@types";
import * as TaskParser from "./TaskParser";

/**
 * Index of quest/area files and their tasks
 */
export class QuestIndex {
    private quests = new Map<string, QuestFile>();

    constructor(
        private app: App,
        private settings: CurrentSettings,
    ) {}

    /**
     * Simple hash function for content change detection
     */
    private hashContent(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Check if a file should be indexed
     */
    private shouldIndexFile(file: TAbstractFile): boolean {
        if (!(file instanceof TFile)) {
            return false;
        }

        if (file.extension !== "md") {
            return false;
        }

        // Check if file is in a quest folder
        return this.settings
            .current()
            .questFolders.some((folder) => file.path.startsWith(folder));
    }

    /**
     * Parse purpose section (after H1 title, before ## Tasks)
     * Populates quest.purpose, quest.purposeStartLine, and quest.tasksStartLine
     */
    private parsePurpose(
        content: string,
        cache: CachedMetadata,
        quest: Partial<QuestFile>,
    ): void {
        const lines = content.split("\n");

        // Find section boundaries using shared utility and cache
        const boundaries = TaskParser.findSectionBoundaries(lines, cache);

        // Extract purpose content (boundaries are ready for slice)
        quest.purpose = lines
            .slice(boundaries.purposeStart, boundaries.purposeEnd)
            .join("\n")
            .trim();
        quest.purposeStartLine = boundaries.purposeStart;
        quest.tasksStartLine = boundaries.tasksStart;
    }

    /**
     * Parse tasks from content
     * Populates quest.tasks and quest.rawTaskContent
     */
    private parseTasks(
        content: string,
        cache: CachedMetadata,
        quest: Partial<QuestFile>,
    ): void {
        const lines = content.split("\n");

        // Find section boundaries using shared utility and cache
        const boundaries = TaskParser.findSectionBoundaries(lines, cache);

        // If no tasks section found
        if (boundaries.tasksStart >= lines.length) {
            quest.tasks = [];
            quest.rawTaskContent = "";
            return;
        }

        // Extract task content (lines after ## Tasks heading)
        // Skip the heading itself (tasksStart + 1) and use tasksEnd as exclusive end
        const taskContentStart = boundaries.tasksStart + 1;
        const taskLines = lines.slice(taskContentStart, boundaries.tasksEnd);
        quest.rawTaskContent = taskLines.join("\n");

        // Parse only the task lines
        quest.tasks = TaskParser.parseTasks(taskLines, taskContentStart);
    }

    /**
     * Parse a quest file
     */
    private async parseQuestFile(file: TFile): Promise<QuestFile | null> {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;

        if (!frontmatter) {
            return null;
        }

        // Must have a valid type from settings
        const type = frontmatter.type;
        if (!type || !this.settings.current().validTypes.includes(type)) {
            return null;
        }

        // Read file content (use cached read for performance)
        const content = await this.app.vault.cachedRead(file);
        const contentHash = this.hashContent(content);

        // Check if content has changed since last index
        const existing = this.quests.get(file.path);
        if (existing && existing.contentHash === contentHash) {
            // Content hasn't changed, return existing parsed data
            return existing;
        }

        // Build quest object
        const quest: Partial<QuestFile> = {
            path: file.path,
            title: file.basename,
            lastModified: file.stat.mtime,
            contentHash,
            type,
            sphere: frontmatter.sphere,
            role: frontmatter.role,
        };

        // Parse purpose and tasks (populates quest fields)
        this.parsePurpose(content, cache, quest);
        this.parseTasks(content, cache, quest);

        // Compute flags (tasks array is guaranteed to be populated by parseTasks)
        const tasks = quest.tasks || [];
        const hasNextTasks = tasks.some((t) => t.tags.includes("next"));
        const hasWaitingTasks = tasks.some((t) => t.tags.includes("waiting"));
        const untriagedCount = tasks.filter(
            (t) => !TaskParser.isTaskTriaged(t),
        ).length;
        const hasOverdueTasks = tasks.some((t) =>
            TaskParser.isOverdueOrDueToday(t),
        );

        // TODO: Track oldest waiting date properly
        const oldestWaitingDate = undefined;

        return {
            ...quest,
            hasNextTasks,
            hasWaitingTasks,
            hasOverdueTasks,
            untriagedCount,
            oldestWaitingDate,
        } as QuestFile;
    }

    /**
     * Index a single file
     */
    async indexFile(file: TAbstractFile): Promise<void> {
        if (!this.shouldIndexFile(file)) {
            return;
        }

        const quest = await this.parseQuestFile(file as TFile);
        if (quest) {
            this.quests.set(file.path, quest);
        }
    }

    /**
     * Remove a file from the index
     */
    removeFile(path: string): void {
        this.quests.delete(path);
    }

    /**
     * Rebuild the entire index
     */
    async rebuildIndex(): Promise<void> {
        this.quests.clear();

        const files = this.app.vault.getMarkdownFiles();

        for (const file of files) {
            if (this.shouldIndexFile(file)) {
                await this.indexFile(file);
            }
        }

        console.log(`Indexed ${this.quests.size} quest/area files`);
    }

    /**
     * Get all indexed quests
     */
    getAllQuests(): QuestFile[] {
        return Array.from(this.quests.values());
    }

    /**
     * Get a specific quest by path
     */
    getQuest(path: string): QuestFile | undefined {
        return this.quests.get(path);
    }

    /**
     * Get all tasks with a specific tag
     */
    getTasksByTag(tag: TaskTag): Array<{ quest: QuestFile; task: Task }> {
        const results: Array<{ quest: QuestFile; task: Task }> = [];

        for (const quest of this.quests.values()) {
            for (const task of quest.tasks) {
                if (task.tags.includes(tag)) {
                    results.push({ quest, task });
                }
            }
        }

        return results;
    }

    /**
     * Get all quests in a specific sphere
     */
    getQuestsBySphere(sphere: string): QuestFile[] {
        return Array.from(this.quests.values()).filter(
            (q) => q.sphere === sphere,
        );
    }
}

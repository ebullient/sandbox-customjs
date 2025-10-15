import { type App, type CachedMetadata, type TAbstractFile, TFile } from "obsidian";
import type { QuestFile, Task, TaskIndexSettings, TaskTag } from "./@types";
import { TaskParser } from "./TaskParser";

/**
 * Index of quest/area files and their tasks
 */
export class QuestIndex {
    private quests = new Map<string, QuestFile>();

    constructor(
        private app: App,
        private settings: TaskIndexSettings,
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
        return this.settings.questFolders.some((folder) => file.path.startsWith(folder));
    }

    /**
     * Parse purpose section (frontmatter to ## Tasks)
     */
    private parsePurpose(content: string): string {
        // Find the end of frontmatter
        const lines = content.split("\n");
        let startIdx = 0;

        if (lines[0] === "---") {
            // Skip frontmatter
            for (let i = 1; i < lines.length; i++) {
                if (lines[i] === "---") {
                    startIdx = i + 1;
                    break;
                }
            }
        }

        // Find ## Tasks section
        let endIdx = lines.length;
        for (let i = startIdx; i < lines.length; i++) {
            if (lines[i].startsWith("## ") && lines[i].includes("Tasks")) {
                endIdx = i;
                break;
            }
        }

        // Extract purpose section
        return lines.slice(startIdx, endIdx).join("\n").trim();
    }

    /**
     * Parse tasks from content
     * Returns both parsed tasks and raw content
     */
    private parseTasks(content: string, cache: CachedMetadata | null): { tasks: Task[]; rawContent: string } {
        const lines = content.split("\n");

        // Find Tasks section
        const tasksHeading = cache?.headings?.find((h) => h.level === 2 && h.heading.includes("Tasks"));

        if (!tasksHeading) {
            return { tasks: [], rawContent: "" };
        }

        // Find the next heading at same or higher level
        const startLine = tasksHeading.position.start.line + 1;
        let endLine = lines.length;

        const nextHeading = cache?.headings?.find(
            (h) => h.level <= 2 && h.position.start.line > tasksHeading.position.start.line,
        );

        if (nextHeading) {
            endLine = nextHeading.position.start.line;
        }

        // Extract raw content (preserves ALL lines: tasks, headings, sub-bullets, etc.)
        const taskLines = lines.slice(startLine, endLine);
        const rawContent = taskLines.join("\n");

        // Parse only the task lines
        const tasks = TaskParser.parseTasks(taskLines, startLine);

        return { tasks, rawContent };
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
        if (!type || !this.settings.validTypes.includes(type)) {
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

        // Parse purpose and tasks
        const purpose = this.parsePurpose(content);
        const { tasks, rawContent } = this.parseTasks(content, cache);

        // Compute flags
        const hasNextTasks = tasks.some((t) => t.tags.includes("next"));
        const hasWaitingTasks = tasks.some((t) => t.tags.includes("waiting"));
        const untriagedCount = tasks.filter((t) => !TaskParser.isTaskTriaged(t)).length;

        // TODO: Track oldest waiting date properly
        const oldestWaitingDate = undefined;

        return {
            path: file.path,
            title: file.basename,
            lastModified: file.stat.mtime,
            contentHash,
            type,
            sphere: frontmatter.sphere,
            role: frontmatter.role,
            purpose,
            tasks,
            rawTaskContent: rawContent,
            hasNextTasks,
            hasWaitingTasks,
            untriagedCount,
            oldestWaitingDate,
        };
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
        return Array.from(this.quests.values()).filter((q) => q.sphere === sphere);
    }
}

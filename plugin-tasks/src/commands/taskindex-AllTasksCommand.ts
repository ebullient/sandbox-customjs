import { type App, Notice } from "obsidian";
import * as LogParser from "../taskindex-LogParser";
import type { TaskEngine } from "../taskindex-TaskEngine";

/**
 * Command to regenerate all-tasks.md with embedded task sections
 * Replaces cmd-all-tasks.ts CustomJS script
 */
export class AllTasksCommand {
    private targetFile = "all-tasks.md";
    private includePaths = ["demesne/", "quests/"];
    private RENDER_TASKS =
        /([\s\S]*?<!--\s*ALL TASKS BEGIN\s*-->)[\s\S]*?(<!--\s*ALL TASKS END\s*-->[\s\S]*?)/i;

    constructor(
        private app: App,
        private taskEngine: TaskEngine,
    ) {}

    async execute(): Promise<void> {
        console.log("Finding all tasks");

        const allTasksFile = this.app.vault.getFileByPath(this.targetFile);
        if (!allTasksFile) {
            new Notice(`${this.targetFile} file not found`);
            return;
        }

        // Get all notes with Tasks sections tagged with #project
        const projects = this.taskEngine
            .getProjectsWithTaskSections(this.includePaths, [this.targetFile])
            .filter((fci) =>
                LogParser.fileMatchesTag(this.app, fci.file, "#project", false),
            );

        // Generate markdown
        const markdown = this.taskEngine.generateAllTasksMarkdown(projects);

        // Update file
        await this.app.vault.process(allTasksFile, (src) => {
            let source = src;
            const match = this.RENDER_TASKS.exec(source);
            if (match) {
                source = match[1];
                source += markdown;
                source += match[2];
            }
            return source;
        });

        new Notice(
            `Updated ${this.targetFile} with ${projects.length} projects`,
        );
    }
}

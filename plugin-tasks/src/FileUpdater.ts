import type { App, TFile } from "obsidian";
import type { QuestFile, Task } from "./@types";

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
            console.error(`File not found: ${quest.path}`);
            return;
        }

        await this.app.vault.process(file, (content) => {
            return this.updateContent(content, quest);
        });
    }

    /**
     * Update file content with quest changes
     */
    private updateContent(content: string, quest: QuestFile): string {
        const lines = content.split("\n");

        // Update frontmatter
        lines.splice(0, lines.length, ...this.updateFrontmatter(lines, quest.sphere));

        // Update purpose section
        const updatedLines = this.updatePurpose(lines, quest.purpose);

        // Update tasks
        return this.updateTasks(updatedLines.join("\n"), quest.tasks);
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
     * Update purpose section
     */
    private updatePurpose(lines: string[], purpose: string): string[] {
        // Find frontmatter end
        let startIdx = 0;
        if (lines[0] === "---") {
            for (let i = 1; i < lines.length; i++) {
                if (lines[i] === "---") {
                    startIdx = i + 1;
                    break;
                }
            }
        }

        // Find ## Tasks section
        let tasksIdx = -1;
        for (let i = startIdx; i < lines.length; i++) {
            if (lines[i].startsWith("## ") && lines[i].includes("Tasks")) {
                tasksIdx = i;
                break;
            }
        }

        if (tasksIdx === -1) {
            return lines;
        }

        // Replace purpose section
        const result = [...lines.slice(0, startIdx), ...purpose.split("\n"), "", ...lines.slice(tasksIdx)];

        return result;
    }

    /**
     * Update task lines with new tags/due dates
     */
    private updateTasks(content: string, tasks: Task[]): string {
        let result = content;

        // Update each task line
        // Work backwards to preserve line numbers
        const sortedTasks = [...tasks].sort((a, b) => b.lineNumber - a.lineNumber);

        for (const task of sortedTasks) {
            result = this.updateTaskLine(result, task);
        }

        return result;
    }

    /**
     * Update a single task line
     */
    private updateTaskLine(content: string, task: Task): string {
        const lines = content.split("\n");

        if (task.lineNumber >= lines.length) {
            return content;
        }

        let line = lines[task.lineNumber];

        // Update tags
        const oldTags = task.line.match(/#(next|waiting|someday)/g) || [];
        const newTags = task.tags.map((t) => `#${t}`);

        if (JSON.stringify(oldTags) !== JSON.stringify(newTags)) {
            // Remove old tags
            line = line.replace(/#(next|waiting|someday)/g, "").trim();

            // Add new tags
            if (newTags.length > 0) {
                line = `${line} ${newTags.join(" ")}`;
            }
        }

        // Update due date
        const oldDueDate = task.line.match(/\{(\d{4}-\d{2}-\d{2})\}/)?.[0];
        const newDueDate = task.dueDate ? `{${task.dueDate}}` : null;

        if (oldDueDate !== newDueDate) {
            // Remove old due date
            line = line.replace(/\s*\{\d{4}-\d{2}-\d{2}\}/g, "");

            // Add new due date
            if (newDueDate) {
                line = `${line} ${newDueDate}`;
            }
        }

        lines[task.lineNumber] = line;
        return lines.join("\n");
    }

    /**
     * Push a task from project to weekly note
     */
    async pushTaskToWeekly(projectPath: string, projectTitle: string, task: Task, weeklyPath: string): Promise<void> {
        const weeklyFile = this.app.vault.getFileByPath(weeklyPath);
        if (!weeklyFile) {
            console.error(`Weekly file not found: ${weeklyPath}`);
            return;
        }

        // Create task line with project link
        const taskLine = `- [ ] [_${projectTitle}_](${projectPath}): ${task.text}`;

        // Add to weekly Tasks section
        await this.addToSection(weeklyFile, "Tasks", taskLine);

        // Remove from project
        const projectFile = this.app.vault.getFileByPath(projectPath);
        if (projectFile) {
            await this.removeTaskLine(projectFile, task.lineNumber);
        }
    }

    /**
     * Add content to a section in a file
     */
    private async addToSection(file: TFile, sectionName: string, content: string): Promise<void> {
        const fileCache = this.app.metadataCache.getFileCache(file);

        if (!fileCache?.headings) {
            console.warn(`No headings found in ${file.path}`);
            return;
        }

        const heading = fileCache.headings.filter((h) => h.level === 2).find((h) => h.heading.includes(sectionName));

        if (!heading) {
            console.warn(`Section "${sectionName}" not found in ${file.path}`);
            return;
        }

        await this.app.vault.process(file, (fileContent) => {
            const lines = fileContent.split("\n");
            lines.splice(heading.position.start.line + 1, 0, content);
            return lines.join("\n");
        });
    }

    /**
     * Remove a task line from a file
     */
    private async removeTaskLine(file: TFile, lineNumber: number): Promise<void> {
        await this.app.vault.process(file, (content) => {
            const lines = content.split("\n");
            lines.splice(lineNumber, 1);
            return lines.join("\n");
        });
    }
}

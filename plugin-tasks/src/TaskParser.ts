import type { Task, TaskStatus, TaskTag } from "./@types";

/**
 * Utilities for parsing tasks from markdown
 */
export class TaskParser {
    private static readonly TASK_REGEX = /^(\s*)-\s*\[(.)\]\s*(.*)$/;
    private static readonly TAG_REGEX = /#(next|waiting|someday)/g;
    private static readonly DUE_DATE_REGEX = /\{(\d{4}-\d{2}-\d{2})\}/;

    /**
     * Parse a single task line
     */
    static parseTask(line: string, lineNumber: number): Task | null {
        const match = TaskParser.TASK_REGEX.exec(line);
        if (!match) {
            return null;
        }

        const [, indentStr, statusChar, text] = match;
        const indent = indentStr.length;
        const status = statusChar as TaskStatus;

        // Extract tags
        const tags: TaskTag[] = [];
        const tagMatches = text.matchAll(TaskParser.TAG_REGEX);
        for (const tagMatch of tagMatches) {
            tags.push(tagMatch[1] as TaskTag);
        }

        // Extract due date
        const dueDateMatch = TaskParser.DUE_DATE_REGEX.exec(text);
        const dueDate = dueDateMatch?.[1];

        return {
            line,
            lineNumber,
            status,
            text,
            tags,
            dueDate,
            indent,
        };
    }

    /**
     * Parse all tasks from a section of text
     */
    static parseTasks(lines: string[], startLine = 0): Task[] {
        const tasks: Task[] = [];

        for (let i = 0; i < lines.length; i++) {
            const task = TaskParser.parseTask(lines[i], startLine + i);
            if (task) {
                tasks.push(task);
            }
        }

        return tasks;
    }

    /**
     * Add or update a tag on a task line
     */
    static updateTaskTag(line: string, tag: TaskTag | null): string {
        // Remove all existing GTD tags
        let updated = line.replace(/#(next|waiting|someday)/g, "").trim();

        // Add new tag if specified
        if (tag) {
            updated = `${updated} #${tag}`;
        }

        return updated;
    }

    /**
     * Add or update due date on a task line
     */
    static updateTaskDueDate(line: string, dueDate: string | null): string {
        // Remove existing due date
        let updated = line.replace(/\s*\{\d{4}-\d{2}-\d{2}\}/g, "");

        // Add new due date if specified
        if (dueDate) {
            updated = `${updated} {${dueDate}}`;
        }

        return updated.trim();
    }

    /**
     * Check if task has any GTD tags
     */
    static isTaskTriaged(task: Task): boolean {
        return task.tags.length > 0;
    }

    /**
     * Get the oldest date a task was marked #waiting
     * Returns timestamp or undefined if not waiting
     */
    static getWaitingSince(task: Task, _file: string): number | undefined {
        if (!task.tags.includes("waiting")) {
            return undefined;
        }

        // TODO: Track when tags were added
        // For now, use a simple heuristic: assume waiting since last file modification
        // This will be enhanced later with proper tag tracking
        return undefined;
    }
}

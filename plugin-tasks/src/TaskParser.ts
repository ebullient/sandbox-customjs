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
     * Check if task has any GTD tags
     */
    static isTaskTriaged(task: Task): boolean {
        return task.tags.length > 0;
    }

    /**
     * Check if task has a due date that is today or in the past
     */
    static isOverdueOrDueToday(task: Task): boolean {
        if (!task.dueDate) {
            return false;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        return dueDate <= today;
    }
}

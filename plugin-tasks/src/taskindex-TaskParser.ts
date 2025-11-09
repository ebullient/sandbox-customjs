import type { CachedMetadata } from "obsidian";
import type { SectionBoundaries, Task, TaskStatus, TaskTag } from "./@types";

/**
 * Utilities for parsing tasks from markdown
 */

const TASK_REGEX = /^(\s*)-\s*\[(.)\]\s*(.*)$/;
const TAG_REGEX = /#(next|waiting|someday)/g;
const DUE_DATE_REGEX = /\{(\d{4}-\d{2}-\d{2})\}/;

/**
 * Parse a single task line
 */
export function parseTask(line: string, lineNumber: number): Task | null {
    const match = TASK_REGEX.exec(line);
    if (!match) {
        return null;
    }

    const [, indentStr, statusChar, text] = match;
    const indent = indentStr.length;
    const status = statusChar as TaskStatus;

    // Extract tags
    const tags: TaskTag[] = [];
    const tagMatches = text.matchAll(TAG_REGEX);
    for (const tagMatch of tagMatches) {
        tags.push(tagMatch[1] as TaskTag);
    }

    // Extract due date
    const dueDateMatch = DUE_DATE_REGEX.exec(text);
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
export function parseTasks(lines: string[], startLine = 0): Task[] {
    const tasks: Task[] = [];

    for (let i = 0; i < lines.length; i++) {
        const task = parseTask(lines[i], startLine + i);
        if (task) {
            tasks.push(task);
        }
    }

    return tasks;
}

/**
 * Check if task has any GTD tags
 */
export function isTaskTriaged(task: Task): boolean {
    return task.tags.length > 0;
}

/**
 * Check if task has a due date that is today or in the past
 */
export function isOverdueOrDueToday(task: Task): boolean {
    if (!task.dueDate) {
        return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate <= today;
}

/**
 * Find section boundaries in quest file content using metadata cache
 * Returns boundaries suitable for direct use with Array.slice()
 */
export function findSectionBoundaries(
    lines: string[],
    cache: CachedMetadata,
): SectionBoundaries {
    const headings = cache.headings || [];

    // Find first H1 heading - purpose starts after it
    const firstHeading = headings[0];
    const purposeStart = firstHeading ? firstHeading.position.end.line + 1 : 0;

    // Find ## Tasks heading
    const tasksHeading = headings.find(
        (h) => h.level === 2 && h.heading.includes("Tasks"),
    );
    const tasksStart = tasksHeading
        ? tasksHeading.position.start.line
        : lines.length;

    // Purpose ends where Tasks starts (exclusive end for slice)
    const purposeEnd = tasksStart;

    // Find end of tasks section (next heading at level 1-2, or end of file)
    const nextHeading = tasksHeading
        ? headings.find(
              (h) =>
                  h.level <= 2 &&
                  h.position.start.line > tasksHeading.position.start.line,
          )
        : undefined;
    const tasksEnd = nextHeading
        ? nextHeading.position.start.line
        : lines.length;

    return { purposeStart, purposeEnd, tasksStart, tasksEnd };
}

import type { App, TFile } from "obsidian";
import { getAllTags } from "obsidian";
import {
    COMPLETED_DATE_REGEX,
    COMPLETED_MARK_REGEX,
    TASK_REGEX,
} from "./taskindex-CommonPatterns";
import { getFileTitle } from "./taskindex-NoteUtils";

/**
 * Utilities for parsing completed tasks from quest/area Log sections
 */

export interface CompletedTask {
    file: TFile;
    sphere: string;
    name: string;
    mark: string; // 'x' or '-'
    text: string;
    completedDate: string; // YYYY-MM-DD
}

/**
 * Parse a single completed task line
 * Returns null if not a completed task or no completion date found
 */
export function parseCompletedTask(
    line: string,
    file: TFile,
    sphere: string,
    name: string,
): CompletedTask | null {
    const taskMatch = TASK_REGEX.exec(line);
    if (!taskMatch) {
        return null;
    }

    const mark = taskMatch[2];
    const text = taskMatch[3];

    // Only process completed tasks (x) or cancelled tasks (-)
    if (!COMPLETED_MARK_REGEX.test(mark)) {
        return null;
    }

    // Extract completion date
    const dateMatch = COMPLETED_DATE_REGEX.exec(text);
    if (!dateMatch) {
        return null;
    }

    return {
        file,
        sphere,
        name,
        mark,
        text,
        completedDate: dateMatch[1],
    };
}

/**
 * Parse all completed tasks from file content
 */
export async function parseCompletedTasksFromFile(
    app: App,
    file: TFile,
): Promise<CompletedTask[]> {
    const tasks: CompletedTask[] = [];
    const sphere = getFileSphere(app, file);
    const name = getFileTitle(app, file);
    const content = await app.vault.cachedRead(file);
    const lines = content.split("\n");

    for (const line of lines) {
        const task = parseCompletedTask(line, file, sphere, name);
        if (task) {
            tasks.push(task);
        }
    }

    return tasks;
}

/**
 * Filter completed tasks by date range (inclusive)
 */
export function filterTasksByDateRange(
    tasks: CompletedTask[],
    startDate: string,
    endDate: string,
): CompletedTask[] {
    return tasks.filter((task) => {
        return task.completedDate >= startDate && task.completedDate <= endDate;
    });
}

/**
 * Get sphere from file frontmatter
 */
export function getFileSphere(app: App, file: TFile): string {
    const cache = app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.sphere || "(no sphere)";
}

/**
 * Check if file matches tag filter
 * Supports hierarchical tags (e.g., "#me/🎯/ibm")
 */
export function fileMatchesTag(
    app: App,
    file: TFile,
    tagFilter: string,
    matchAll = false,
): boolean {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache) {
        return false;
    }

    const allTags = getAllTags(cache);
    if (!allTags || allTags.length === 0) {
        return false;
    }

    // Simple prefix matching for hierarchical tags
    return matchAll
        ? allTags.every((t: string) => t.startsWith(tagFilter))
        : allTags.some((t: string) => t.startsWith(tagFilter));
}

/**
 * Group completed tasks by sphere
 * Returns a map of sphere name to array of task lines (markdown formatted)
 */
export function groupTasksBySphere(
    tasks: CompletedTask[],
    removeTriageTags = false,
): Map<string, string[]> {
    const bySphere = new Map<string, string[]>();

    for (const task of tasks) {
        const link = `[${task.name}](${task.file.path})`;

        let taskText = task.text;
        if (removeTriageTags) {
            // Remove chore/routine/trivial tags for fixedWeekTasks
            taskText = taskText.replace(/\s+#(chore|routine|trivial)/g, "");
        }

        const taskLine = `- *${link}*: ${taskText}`;

        if (!bySphere.has(task.sphere)) {
            bySphere.set(task.sphere, []);
        }
        bySphere.get(task.sphere)?.push(taskLine);
    }

    return bySphere;
}

/**
 * Generate markdown output from grouped tasks
 */
export function generateMarkdown(
    tasksBySphere: Map<string, string[]>,
    startDate: string,
    endDate: string,
): string {
    const list: string[] = [];

    if (tasksBySphere.size === 0) {
        list.push(`- No tasks found between ${startDate} and ${endDate}`);
    } else {
        const spheres = Array.from(tasksBySphere.keys()).sort();
        for (const sphere of spheres) {
            const tasks = tasksBySphere.get(sphere) || [];
            tasks.sort();

            list.push(`#### ${sphere}\n`);
            list.push(...tasks);
            list.push("");
        }
    }

    return list.join("\n");
}

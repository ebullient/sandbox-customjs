/**
 * Common regex patterns used across task parsing and cleanup services
 * Centralizes all task-related pattern definitions
 */

/**
 * Date patterns
 */
// Extracts date from anywhere in a path (e.g., "chronicles/2024/2024-01-15.md" → "2024-01-15")
export const DATE_IN_PATH_REGEX = /^.*?(\d{4}-\d{2}-\d{2}).*$/;
// Matches daily note filename pattern
export const DAILY_NOTE_REGEX = /(\d{4}-\d{2}-\d{2})\.md/;
// Matches weekly note filename pattern
export const WEEKLY_NOTE_REGEX = /(\d{4}-\d{2}-\d{2})_week\.md/;
// Matches yearly note filename pattern
export const YEARLY_NOTE_REGEX = /\/\d{4}\.md$/;

/**
 * Task line patterns
 */
export const TASK_REGEX = /^(\s*)-\s*\[(.)\]\s*(.*)$/;
export const COMPLETED_DATE_REGEX = /\((\d{4}-\d{2}-\d{2})\)/;
export const COMPLETED_MARK_REGEX = /[x-]/;

/**
 * GTD tag patterns
 */
export const GTD_TAG_REGEX = /#(next|waiting|someday)/g;
export const TRIAGE_TAG_REGEX = /#(chore|routine|trivial)/g;

/**
 * Due date pattern in task text
 */
export const DUE_DATE_REGEX = /\{(\d{4}-\d{2}-\d{2})\}/;

/**
 * Archive link patterns
 */
export const ARCHIVE_LINK_REGEX = /^- \[.*-log-(\d{4})\]\(.*\)$/;

/**
 * List item patterns
 */
export const LIST_ITEM_REGEX = /^[\s>]*- .*$/;
export const DONE_ITEM_REGEX = /^[\s>]*- (✔️|〰️) .*$/;

/**
 * Heading pattern - strips markdown heading prefix
 */
export const HEADING_PREFIX_REGEX = /^#+\s*/;

/**
 * Check if a line is a task (checkbox format)
 */
export function isTaskLine(line: string): boolean {
    return TASK_REGEX.test(line);
}

/**
 * Check if a line is a completed task (done emoji)
 */
export function isDoneLine(line: string): boolean {
    return DONE_ITEM_REGEX.test(line);
}

/**
 * Check if a line is an archive link
 */
export function isArchiveLink(line: string): boolean {
    return ARCHIVE_LINK_REGEX.test(line);
}

/**
 * Extract completion date from task text
 * Checks both explicit (YYYY-MM-DD) format and daily note references
 */
export function extractCompletionDate(text: string): string | null {
    const explicitMatch = COMPLETED_DATE_REGEX.exec(text);
    if (explicitMatch) {
        return explicitMatch[1];
    }

    const dailyNoteMatch = DAILY_NOTE_REGEX.exec(text);
    if (dailyNoteMatch) {
        return dailyNoteMatch[1];
    }

    return null;
}

/**
 * Extract year from completion date
 */
export function extractYear(dateString: string): string | null {
    const match = /^(\d{4})-\d{2}-\d{2}$/.exec(dateString);
    return match ? match[1] : null;
}

/**
 * Parse a markdown task line
 * Returns status marker and text, or null if not a task
 */
export interface ParsedTask {
    indent: string;
    status: string;
    text: string;
}

export function parseTaskLine(line: string): ParsedTask | null {
    const match = TASK_REGEX.exec(line);
    if (!match) {
        return null;
    }

    return {
        indent: match[1],
        status: match[2],
        text: match[3],
    };
}

/**
 * Check if task mark indicates completion (x or -)
 */
export function isTaskCompleted(mark: string): boolean {
    return COMPLETED_MARK_REGEX.test(mark);
}

/**
 * Check if text already has a completion date like (2024-01-15)
 */
export function hasCompletionDate(text: string): boolean {
    return COMPLETED_DATE_REGEX.test(text);
}

/**
 * Extract date from a file path (cached for performance)
 */
const noteDateCache = new Map<string, string | undefined>();

export function getDateFromPath(path: string): string | undefined {
    if (!path) {
        return undefined;
    }

    if (noteDateCache.has(path)) {
        return noteDateCache.get(path);
    }

    const match = DATE_IN_PATH_REGEX.exec(path);
    const date = match ? match[1] : undefined;
    noteDateCache.set(path, date);
    return date;
}

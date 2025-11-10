/**
 * Core type definitions for Task Index plugin
 */

/**
 * Plugin settings
 */
export interface TaskIndexSettings {
    // Sphere configuration
    validSpheres: string[];

    // Review thresholds
    staleProjectWeeks: number;
    waitingTaskDays: number;

    // Archive thresholds
    minArchiveLines: number;

    // File patterns
    questFolders: string[];
    validTypes: string[]; // Valid frontmatter type values (e.g., "quest", "area", "project", "demesne")

    // Purpose tags (for tagging project purposes with goals/values)
    purposeTags: string[]; // e.g., ["#me/🎯/🤓", "#me/🧬/creativity/curiosity"]
}

/**
 * Section boundaries in a quest file
 * All indices are suitable for direct use with Array.slice()
 */
export interface SectionBoundaries {
    purposeStart: number; // First line of purpose content (inclusive)
    purposeEnd: number; // Line after purpose content (exclusive) = tasksStart
    tasksStart: number; // Line of ## Tasks heading
    tasksEnd: number; // Line after tasks content (exclusive) = next section or length
}

/**
 * Task status markers from checkbox
 */
export type TaskStatus = " " | "/" | "b" | "x" | "-";

/**
 * GTD-style task tags
 */
export type TaskTag = "next" | "waiting" | "someday";

export interface CurrentSettings {
    current(): TaskIndexSettings;
}

/**
 * Parsed task from markdown
 */
export interface Task {
    // Raw data
    line: string;
    lineNumber: number;

    // Parsed components
    status: TaskStatus;
    text: string;
    tags: TaskTag[];
    dueDate?: string; // YYYY-MM-DD format

    // Context
    indent: number;
}

/**
 * Quest or Area file metadata
 */
export interface QuestFile {
    // File info
    path: string;
    title: string;
    lastModified: number;
    contentHash: string; // Hash of file content for change detection

    // Frontmatter
    type: string; // Configurable type value (quest, area, project, demesne, etc.)
    sphere?: string;
    role?: string;

    // Content sections
    purpose: string; // Content after H1/frontmatter, before ## Tasks (excludes H1)
    tasks: Task[];
    rawTaskContent: string; // Raw markdown from ## Tasks section (preserves formatting)

    // Section boundaries (line numbers for updates)
    purposeStartLine: number; // Where purpose content starts (after H1 or frontmatter)
    tasksStartLine: number; // Where ## Tasks heading is located

    // Computed flags
    hasNextTasks: boolean;
    hasWaitingTasks: boolean;
    hasCompletedTasks: boolean; // Has completed (x) or cancelled (-) tasks that need cleanup
    untriagedCount: number;
    hasOverdueTasks: boolean; // Has tasks with due dates today or in the past
    oldestWaitingDate?: number; // TODO: Track when tasks were marked #waiting
}

/**
 * Reasons a project needs review
 */
export type ReviewReason =
    | "no-next-tasks"
    | "stale-project"
    | "overdue-tasks"
    | "long-waiting"
    | "no-sphere";

/**
 * Project flagged for review
 */
export interface ReviewItem {
    quest: QuestFile;
    reasons: ReviewReason[];
    priority: number; // Computed priority score
}

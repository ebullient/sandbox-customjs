/**
 * Core type definitions for Task Index plugin
 */

/**
 * Plugin settings
 */
export interface TaskIndexSettings {
    // Sphere configuration
    validSpheres: string[];
    currentSphereFocus?: string;

    // Review thresholds
    staleProjectWeeks: number;
    waitingTaskDays: number;

    // File patterns
    questFolders: string[];
    validTypes: string[]; // Valid frontmatter type values (e.g., "quest", "area", "project", "demesne")

    // Purpose tags (for tagging project purposes with goals/values)
    purposeTags: string[]; // e.g., ["#me/🎯/🤓", "#me/🧬/creativity/curiosity"]
}

/**
 * Task status markers from checkbox
 */
export type TaskStatus = " " | "/" | "b" | "x" | "-";

/**
 * GTD-style task tags
 */
export type TaskTag = "next" | "waiting" | "someday";

/**
 * Task actions available in review modal
 */
export type TaskAction = TaskTag | "complete" | "cancel";

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
    purpose: string; // From frontmatter to ## Tasks
    tasks: Task[];
    rawTaskContent: string; // Raw markdown from ## Tasks section (preserves formatting)

    // Computed flags
    hasNextTasks: boolean;
    hasWaitingTasks: boolean;
    untriagedCount: number;
    oldestWaitingDate?: number;
}

/**
 * Reasons a project needs review
 */
export type ReviewReason =
    | "no-next-tasks"
    | "stale-project"
    | "long-waiting"
    | "no-sphere"
    | "sphere-focus";

/**
 * Project flagged for review
 */
export interface ReviewItem {
    quest: QuestFile;
    reasons: ReviewReason[];
    priority: number; // Computed priority score
}

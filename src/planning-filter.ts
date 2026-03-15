import type { FilterFn } from "./@types/prompt-flow.types";

interface ProjectEntry {
    sphere: string;
    name: string;
    lastModified: string | null;
    embedPath: string;
}

interface CategorizedTasks {
    next: string[];
    due: string[];
    waiting: string[];
    blocked: string[];
    other: string[];
}

export class PlanningFilter {
    constructor() {
        window.promptFlow = window.promptFlow ?? {};
        window.promptFlow.filters = window.promptFlow.filters ?? {};
        window.promptFlow.filters.weeklyPlanFilter = this.weeklyPlanFilter;
    }

    weeklyPlanFilter: FilterFn = (content) => {
        const todayStr = new Date().toISOString().split("T")[0];
        const dayName = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ][new Date().getDay()];

        const entries = this.parseEntries(content);
        const weeklyContext = this.extractWeeklyContext(entries);
        const projects = this.parseProjectStructure(entries);

        // Categorize all projects, then sort
        const withTasks = projects.map((project) => ({
            project,
            tasks: this.categorizeTasks(
                entries.get(project.embedPath) ?? "",
                todayStr,
            ),
        }));

        const actionable = withTasks.filter(
            ({ tasks }) =>
                tasks.next.length +
                    tasks.due.length +
                    tasks.waiting.length +
                    tasks.blocked.length +
                    tasks.other.length >
                0,
        );

        actionable.sort((a, b) => {
            const nextDiff = b.tasks.next.length - a.tasks.next.length;
            if (nextDiff !== 0) return nextDiff;
            const aDate = a.project.lastModified ?? "0000-00-00";
            const bDate = b.project.lastModified ?? "0000-00-00";
            return bDate.localeCompare(aDate);
        });

        const lines: string[] = [];

        lines.push("--- WEEKLY CONTEXT ---");
        lines.push(`Date: ${todayStr} (${dayName})\n`);
        if (weeklyContext.trim()) {
            lines.push(weeklyContext.trim());
            lines.push("");
        }

        lines.push(
            `--- PROJECT TASKS (${actionable.length} projects with pending work) ---\n`,
        );
        for (const { project, tasks } of actionable) {
            lines.push(this.formatProject(project, tasks));
        }

        lines.push("--- PLANNING INSTRUCTIONS ---");
        lines.push("Use ONLY the tasks and goals listed above.");
        lines.push(
            "Do NOT invent, add, or assume any tasks, projects, or paths not shown here.",
        );
        lines.push(
            "If a project has no actionable tasks, it is not listed — do not reference it.",
        );
        lines.push(
            "Projects with #next tasks appear first, then sorted by most recently modified.",
        );

        return lines.join("\n");
    };

    private parseEntries(content: string): Map<string, string> {
        const entries = new Map<string, string>();
        const ENTRY_RE =
            /^===== BEGIN ENTRY: (.+?) =====\n([\s\S]*?)\n===== END ENTRY =====/gm;
        let match = ENTRY_RE.exec(content);
        while (match !== null) {
            entries.set(match[1].trim(), match[2].trim());
            match = ENTRY_RE.exec(content);
        }
        return entries;
    }

    private extractWeeklyContext(entries: Map<string, string>): string {
        const parts: string[] = [];
        for (const [key, value] of entries) {
            if (/_week\.md#/.test(key)) {
                const cleaned = this.cleanWeeklySection(value);
                if (cleaned) parts.push(cleaned);
            }
        }
        return parts.join("\n\n");
    }

    private cleanWeeklySection(content: string): string {
        return content
            .split("\n")
            .filter((line) => {
                const t = line.trimStart();
                if (/^- \[x\]/.test(t)) return false; // completed tasks
                if (/^- \[-\]/.test(t)) return false; // cancelled tasks
                if (/^%%/.test(t)) return false; // comments
                if (/^!?\[.*\]\(.*\)/.test(t)) return false; // embed/link-only lines
                if (/^```/.test(t)) return false; // code blocks
                return true;
            })
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    private parseProjectStructure(
        entries: Map<string, string>,
    ): ProjectEntry[] {
        const allTasksContent = entries.get("all-tasks.md");
        if (!allTasksContent) return [];

        const HEADING_RE = /^## (\S+)\s+<span[^>]*>[^<]*<\/span>\s+(.+)$/;
        const LAST_MODIFIED_RE =
            /<span class="last-modified">last modified:\s*(\d{4}-\d{2}-\d{2})<\/span>/;
        const EMBED_RE = /!\[.*?\]\(([^)]+)\)/;

        const projects: ProjectEntry[] = [];
        let current: Partial<ProjectEntry> | null = null;

        for (const line of allTasksContent.split("\n")) {
            const headingMatch = HEADING_RE.exec(line);
            if (headingMatch) {
                current = {
                    sphere: headingMatch[1].trim(),
                    name: headingMatch[2].trim(),
                    lastModified: null,
                };
                continue;
            }

            if (!current) continue;

            const modMatch = LAST_MODIFIED_RE.exec(line);
            if (modMatch) {
                current.lastModified = modMatch[1];
                continue;
            }

            const embedMatch = EMBED_RE.exec(line);
            if (embedMatch) {
                current.embedPath = embedMatch[1].trim();
                projects.push(current as ProjectEntry);
                current = null;
                continue;
            }

            // Reset on separator or unexpected heading before embed found
            if (/^(---|##)/.test(line.trim())) {
                current = null;
            }
        }

        return projects;
    }

    private categorizeTasks(
        content: string,
        todayStr: string,
    ): CategorizedTasks {
        const result: CategorizedTasks = {
            next: [],
            due: [],
            waiting: [],
            blocked: [],
            other: [],
        };
        if (!content.trim()) return result;

        let inSomeday = false;
        for (const line of content.split("\n")) {
            const trimmed = line.trimStart();

            // Someday section guard (skip until next non-someday heading)
            if (/^#{1,4}\s*(?:❧\s*)?Someday/i.test(trimmed)) {
                inSomeday = true;
                continue;
            }
            if (inSomeday) {
                if (/^#{1,4}\s+/.test(trimmed)) inSomeday = false;
                else continue;
            }

            const taskMatch = /^- \[([^\]]+)\]\s+(.+)$/.exec(trimmed);
            if (!taskMatch) continue;

            const status = taskMatch[1];
            const text = taskMatch[2];

            // Skip completed and cancelled
            if (status === "x" || status === "-") continue;

            // In-progress tasks are actively being worked on
            if (status === "/") {
                const cleanText = text
                    .replace(/\s*#next\b/g, "")
                    .replace(/\s*#waiting\b/g, "")
                    .trim();
                result.next.push(cleanText);
                continue;
            }

            // Blocked tasks go with waiting (not immediately actionable)
            if (status === "b") {
                const cleanText = text
                    .replace(/\s*#next\b/g, "")
                    .replace(/\s*#waiting\b/g, "")
                    .trim();
                result.blocked.push(cleanText);
                continue;
            }

            const hasNext = /#next\b/.test(text);
            const hasWaiting = /#waiting\b/.test(text);
            const dueDateMatch = /\{(\d{4}-\d{2}-\d{2})\}/.exec(text);
            const isOverdue = dueDateMatch
                ? dueDateMatch[1] <= todayStr
                : false;

            // Clean structural tags from display text
            const cleanText = text
                .replace(/\s*#next\b/g, "")
                .replace(/\s*#waiting\b/g, "")
                .trim();

            if (hasNext) {
                result.next.push(cleanText);
            } else if (isOverdue) {
                result.due.push(cleanText);
            } else if (hasWaiting) {
                result.waiting.push(cleanText);
            } else {
                result.other.push(cleanText);
            }
        }

        return result;
    }

    private formatProject(
        project: ProjectEntry,
        tasks: CategorizedTasks,
    ): string {
        const modified = project.lastModified
            ? `  [modified: ${project.lastModified}]`
            : "";
        const lines: string[] = [
            `### ${project.sphere} | ${project.name}${modified}`,
        ];

        if (tasks.next.length > 0) {
            lines.push("#next:");
            for (const t of tasks.next) lines.push(`  - ${t}`);
        }
        if (tasks.due.length > 0) {
            lines.push("due/overdue:");
            for (const t of tasks.due) lines.push(`  - ${t}`);
        }
        if (tasks.waiting.length > 0) {
            lines.push(`#waiting (${tasks.waiting.length}):`);
            for (const t of tasks.waiting) lines.push(`  - ${t}`);
        }
        if (tasks.blocked.length > 0) {
            lines.push(`blocked (${tasks.blocked.length}):`);
            for (const t of tasks.blocked) lines.push(`  - ${t}`);
        }
        if (tasks.other.length > 0) {
            lines.push(`other (${tasks.other.length}):`);
            for (const t of tasks.other) lines.push(`  - ${t}`);
        }

        lines.push("");
        return lines.join("\n");
    }
}

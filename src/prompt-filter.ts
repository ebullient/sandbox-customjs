import type { App } from "obsidian";
import type { FilterFn } from "./@types/prompt-flow.types";

interface TierFilterConfig {
    familyCheckin: Record<string, string>;
}

type HealthMetrics = {
    "stand ring": string;
    [key: string]: string;
};

export class PromptFilter {
    tierFilterConfigFile = "assets/config/tier-prefilter-config.yaml";
    familyCheckin: Record<string, RegExp> = {};
    app: App;

    yes = "✔️";
    no = "✗";

    constructor() {
        // Constructor
        console.log("loading PromptFilter");
        this.app = window.customJS.app;
        window.promptFlow = window.promptFlow ?? {};
        window.promptFlow.filters = window.promptFlow.filters ?? {};
        window.promptFlow.filters.tierFilter = this.tierFilter;
        window.promptFlow.filters.contentFilter = this.contentFilter;
    }

    deconstructor() {
        window.promptFlow.filters.tierFilter = undefined;
        window.promptFlow.filters.contentFilter = undefined;

        window.journal.filters.tierFilter = undefined;
        window.journal.filters.contentFilter = undefined;
    }

    /**
     * "Startup" invokable script. Load configuration
     */
    async invoke(): Promise<void> {
        try {
            const configFile = this.app.vault.getFileByPath(
                this.tierFilterConfigFile,
            );
            if (!configFile) {
                console.warn(
                    `Missing config file ${this.tierFilterConfigFile}, using defaults`,
                );
                return;
            }

            const configText = await this.app.vault.cachedRead(configFile);
            const config = window.customJS.obsidian.parseYaml(
                configText,
            ) as TierFilterConfig;

            if (config.familyCheckin) {
                for (const [name, expression] of Object.entries(
                    config.familyCheckin,
                )) {
                    this.familyCheckin[name] = new RegExp(
                        `\\b${expression}\\b`,
                        "gi",
                    );
                }
            }
            console.log(
                "Loaded prefilter configuration from",
                this.tierFilterConfigFile,
            );
        } catch (error) {
            console.error("Failed to load configuration:", error);
        }
    }

    /**
     * CONTENT FILTER
     * Removes visual and structural clutter
     */
    contentFilter: FilterFn = (content) => {
        console.log("Content Filter");
        let filtered = content;

        // 1. Remove entire daily file entries (planning files, not journals)
        filtered = this.removeDailyFileEntries(filtered);

        // 2. Remove frontmatter (appears after each BEGIN ENTRY marker)
        filtered = filtered.replace(/=====\n---\n[\s\S]*?\n---\n/g, "=====\n");

        // 3. Remove list items that are only links
        filtered = this.removeLinkOnlyLines(filtered);

        // 4. Remove block references
        filtered = filtered.replace(/^\^[\w-]+\s*?$/gm, "");

        // 5. Remove empty file blocks (with only whitespace between BEGIN and END)
        filtered = filtered.replace(
            /^===== BEGIN ENTRY: .*? =====\n(?:#.*\n|\s)*===== END ENTRY =====\n?/gm,
            "",
        );

        // 6. Remove single line comments
        filtered = filtered.replace(/%%.*?%%/gm, "");

        // 7. This is an odd one, leftover template detritus
        // Matches: > [!todo]- Today:  \n> Log:  \n
        filtered = filtered.replace(
            /^>\s*\[!todo\]-?\s*Today:\s*\n>\s*Log:\s*\n/gm,
            "",
        );

        // Finally, clean up excessive blank lines
        filtered = filtered.replace(/\n{3,}/g, "\n\n");

        return filtered;
    };

    private removeDailyFileEntries(content: string): string {
        // Remove entire planning file entries (daily and weekly)
        // Keep journal entries (/chronicles/journal/...)
        // Patterns:
        // - Daily: ===== BEGIN ENTRY: /chronicles/2025/2025-11-03.md =====
        // - Weekly: ===== BEGIN ENTRY: /chronicles/2025/2025-11-03_week.md#Logs =====
        let filtered = content;

        // Remove daily planning files
        filtered = filtered.replace(
            /^===== BEGIN ENTRY: \/?chronicles\/\d{4}\/\d{4}-\d{2}-\d{2}(\.md)?(#Log)? =====\n[\s\S]*?\n===== END ENTRY =====\n?/gm,
            "",
        );

        // Remove weekly planning files
        filtered = filtered.replace(
            /^===== BEGIN ENTRY: \/?chronicles\/\d{4}\/\d{4}-\d{2}-\d{2}_week(\.md)?(?:#[\w\s]+)? =====\n[\s\S]*?\n===== END ENTRY =====\n?/gm,
            "",
        );

        return filtered;
    }

    private removeLinkOnlyLines(content: string): string {
        // Remove lines that are only list items with links and optional whitespace
        // Matches:
        // - [text](path)  \n
        // - [text](path)\n
        // text](path)\n
        // ![text](path)\n
        // > ![invisible-embed](path)
        // > [text](path)
        // > - [text](path)
        return content.replace(
            /^[\s>]*(-\s+|!)?\[([^\]]+)\]\([^)]+\)\s*\\?\s*\n/gm,
            "",
        );
    }

    /**
     * TIER FILTER
     * Used specifically for preprocessing entries containing
     * activity tags, etc.
     */
    tierFilter: FilterFn = (content) => {
        console.log("Tier Filter");
        const metrics = this.extractMetrics(content);
        const structuredSection = this.formatMetrics(content, metrics);

        return `--- STRUCTURED METRICS ---\n${structuredSection}\n--- JOURNAL TEXT ---\n${content}`;
    };

    private extractMetrics(content: string) {
        const health = this.extractHealthTags(content);
        return {
            iteration: this.extractIteration(content),
            health,
            workday: this.extractWorkday(content),
            work: this.extractWorkPatterns(content, health),
            familyMentions: this.extractFamilyMentions(content),
            dateRange: this.extractDateRange(content),
            completedProjects: this.extractCompletedProjects(content),
        };
    }

    private formatMetrics(
        content: string,
        metrics: ReturnType<typeof this.extractMetrics>,
    ): string {
        const lines: string[] = [];
        const dailyJournal = !content.includes("# ✍️ Week of ");

        // Iteration info
        lines.push(`Iteration: ${metrics.iteration.current} of 4`);
        lines.push(
            `Can ask more questions: ${metrics.iteration.canAskMore ? "yes" : "no"}`,
        );
        if (dailyJournal) {
            if (metrics.health.tierTag) {
                lines.push(`Self-assessment: ${metrics.health.tierTag}`);
            }
            lines.push(`Workday: ${metrics.workday.display}`);
            // } else {
            //     lines.push(`Date range: ${metrics.dateRange}`);
        }

        // Health metrics
        lines.push("");
        this.pushPresentAbsent(
            lines,
            "Health metrics",
            Object.entries(metrics.health).filter(
                ([key, _v]) => key !== "tierTag",
            ),
        );

        if (dailyJournal) {
            this.pushPresentAbsent(
                lines,
                "Work patterns",
                Object.entries(metrics.work),
            );
        } else {
            // Add project completions for weekly summaries
            const projectEntries = Object.entries(metrics.completedProjects);
            if (projectEntries.length > 0) {
                lines.push("");
                lines.push("Projects per Sphere:");
                for (const [project, count] of projectEntries) {
                    lines.push(`- ${project}: ${count} items`);
                }
            }
        }

        lines.push("");
        lines.push(`Family mentions: ${metrics.familyMentions}`);
        return lines.join("\n");
    }

    private pushPresentAbsent(
        lines: string[],
        prefix: string,
        entries: [string, string][],
    ): void {
        const present = entries
            .filter(([_k, value]) => value.startsWith(this.yes))
            .map(([key, value]) => `${key}: ${value}`);
        const absent = entries
            .filter(([_k, value]) => value.startsWith(this.no))
            .map(([key, value]) => `${key}: ${value}`);
        lines.push(
            `${prefix}:\n- present: ${present.join("; ")}\n- absent: ${absent.join("; ")}`,
        );
        lines.push("");
    }

    private extractIteration(content: string): {
        current: number;
        canAskMore: boolean;
    } {
        const matches = content.match(/\[!tier-assessment\]/g);
        const count = matches ? matches.length : 0;
        const current = count + 1;
        return {
            current,
            canAskMore: current < 4,
        };
    }

    private extractWorkday(content: string): {
        isWorkday: boolean | undefined;
        reason?: string;
        display: string;
    } {
        // Check for PTO or Vacation
        if (/\b(PTO|[vV]acation)\b/.test(content)) {
            return {
                isWorkday: false,
                reason: "time off",
                display: "no (time off)",
            };
        }

        // Extract day of week
        const dayMatch = content.match(
            /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/,
        );
        if (!dayMatch) {
            return { isWorkday: undefined, display: "unknown" };
        }

        const day = dayMatch[1];
        const isWeekday = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
        ].includes(day);

        return {
            isWorkday: isWeekday,
            reason: isWeekday ? undefined : "weekend",
            display: isWeekday ? `yes (${day})` : "no (weekend)",
        };
    }

    private extractDateRange(content: string): string {
        // Look for weekly plan link: /chronicles/2025/2025-11-03_week.md#Logs
        const linkMatch = content.match(
            /\/chronicles\/\d{4}\/(\d{4}-\d{2}-\d{2})_week\.md/,
        );
        if (!linkMatch) {
            return "unknown";
        }

        const dateStr = linkMatch[1]; // e.g., "2025-11-03"
        const date = window.moment(dateStr);

        // Get week boundaries starting on Monday
        const weekStart = date.clone().startOf("isoWeek");
        const weekEnd = date.clone().endOf("isoWeek");

        return `${weekStart.format("YYYY-MM-DD")} to ${weekEnd.format("YYYY-MM-DD")}`;
    }

    private extractHealthTags(content: string) {
        const hasTag = (tags: string[]) =>
            tags.some((t) => content.includes(t));

        // Extract tier tag(s)
        const tierMatches = content.match(/#me\/🌓\/(tier[1-4]|mixed)/g);
        const tierTag = tierMatches
            ? [
                  ...new Set(tierMatches.map((m) => m.replace("#me/🌓/", ""))),
              ].join(", ")
            : "none";

        const mindfulness = hasTag(["#me/✅/🧘"]) ? this.yes : this.no;
        const movementRing = hasTag(["#me/✅/🔴"]) ? this.yes : this.no;
        const standRing = hasTag(["#me/✅/🔵"]) ? this.yes : this.no;
        const exerciseRing = hasTag(["#me/✅/🟢"]) ? this.yes : this.no;
        const extraGreens = hasTag(["#me/✅/☘️", "#me/✅/🍀"])
            ? this.yes
            : this.no;
        const vitamins =
            extraGreens || hasTag(["#me/✅/✨"]) ? this.yes : this.no;
        const water = vitamins || hasTag(["#me/✅/💧"]) ? this.yes : this.no;
        const chores = hasTag([
            "#me/✅/🧼",
            "#me/✅/🧽",
            "#me/✅/🧹",
            "#me/✅/🧺",
            "#me/✅/🪣",
            "#me/✅/🪏",
            "#me/✅/🥘",
        ])
            ? this.yes
            : this.no;

        // Count breathe meditation sessions (2 minutes each)
        const breatheMatches = content.match(/#me\/✅\/🧘\/breathe/g);
        const breatheCount = breatheMatches?.length ?? 0;
        const meditationMinutes = breatheCount * 2;
        const meditation =
            meditationMinutes > 0
                ? `${this.yes} (${meditationMinutes} min)`
                : this.no;

        return {
            "extra greens": extraGreens,
            "exercise ring": exerciseRing,
            "movement ring": movementRing,
            "stand ring": standRing,
            mindfulness: mindfulness,
            meditation,
            chores,
            vitamins,
            water,
            tierTag,
        };
    }

    private extractWorkPatterns(content: string, health: HealthMetrics) {
        // Extract stop time
        let _stoppedAt: string;
        let _workedPast6pm: string;

        // - 🎉 Completion / Landed the task.
        // - 🎠 Distracted / chasing novelty.
        // - 😵‍💫 Tier 2 hyperfocus. Must finish.
        // - ☄️ Tier 4 hyperfocus. Feels good, costs later. Time for Tier 4 rules.

        // Count breaks taken (BREAK in all caps, or stand ring completion ~= 12)
        const breakMatches = content.match(/BREAK/g);
        const breakCount =
            breakMatches?.length ??
            (health["stand ring"] === this.yes ? 12 : 0);
        const breaks = breakCount > 0 ? `${this.yes} (${breakCount})` : this.no;

        // 🎉 Intention-outcome alignment: landed the intended task
        const completionCount = content.match(/🎉/g)?.length ?? 0;
        const completion =
            completionCount > 0 ? `${this.yes} (${completionCount})` : this.no;

        // ☄️ Executive function challenges: hyperfocus
        const hyperfocusPattern =
            /(😵‍💫|☄️|\bhyperfocus(?:ed)?\b|\blost track of time\b)/gi;
        const hyperfocusMatches = content.match(hyperfocusPattern);
        const uniqueHyperfocus = hyperfocusMatches
            ? [...new Set(hyperfocusMatches)].join(", ")
            : null;
        const hyperfocus = uniqueHyperfocus
            ? `${this.yes} (${hyperfocusMatches.length}: ${uniqueHyperfocus})`
            : this.no;

        // 🎠 Executive function challenges: distracted
        const distractedCount = content.match(/🎠/g)?.length ?? 0;
        const distracted =
            distractedCount > 0 ? `${this.yes} (${distractedCount})` : this.no;

        return {
            "breaks taken": breaks,
            "completed intended task": completion,
            hyperfocus,
            distracted,
        };
    }

    private extractFamilyMentions(content: string): string {
        const counts: string[] = [];
        for (const [name, regex] of Object.entries(this.familyCheckin)) {
            const matches = content.match(regex);
            const count = matches ? matches.length : 0;
            counts.push(`${name} (${count})`);
        }
        return counts.join(", ");
    }

    private extractCompletedProjects(content: string): Record<string, number> {
        const completions: Record<string, number> = {};

        // Find the "Project items completed this week" section
        const sectionMatch = content.match(
            /^###\s+Project items completed this week[:\s]*\n([\s\S]*?)(?=\n#{1,3}\s|$)/m,
        );

        if (!sectionMatch) {
            return completions;
        }
        console.log("Find completed project section");

        const sectionContent = sectionMatch[1];
        const lines = sectionContent.split("\n");
        let currentProject = "";

        for (const line of lines) {
            // Match 4th level headings (####)
            const headingMatch = line.match(/^####\s+(.+)$/);
            if (headingMatch) {
                currentProject = headingMatch[1].trim();
                completions[currentProject] = 0;
                continue;
            }

            // Count list items under the current project
            if (currentProject && /^\s*[-*]\s+/.test(line)) {
                completions[currentProject]++;
            }
        }

        return completions;
    }
}

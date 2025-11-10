import type { App } from "obsidian";
import type { FilterFn } from "./@types/journal-reflect.types";

interface PrefilterConfig {
    familyCheckin: Record<string, string>;
}

type HealthMetrics = {
    "stand ring": string;
    [key: string]: string;
};

export class TierPrefilter {
    configFile = "assets/config/tier-prefilter-config.yaml";
    familyCheckin: Record<string, RegExp> = {};
    app: App;

    yes = "✔️";
    no = "✗";

    constructor() {
        // Constructor
        console.log("loading TierPrefilter");
        this.app = window.customJS.app;
        window.journal = window.journal ?? {};
        window.journal.filters = window.journal.filters ?? {};
        window.journal.filters.tierFilter = this.prefilter;
    }

    deconstructor() {
        window.journal.filters.tierFilter = undefined;
    }

    /**
     * "Startup" invokable script. Load configuration
     */
    async invoke(): Promise<void> {
        try {
            const configFile = this.app.vault.getFileByPath(this.configFile);
            if (!configFile) {
                console.warn(
                    `Missing config file ${this.configFile}, using defaults`,
                );
                return;
            }

            const configText = await this.app.vault.cachedRead(configFile);
            const config = window.customJS.obsidian.parseYaml(
                configText,
            ) as PrefilterConfig;

            if (config.familyCheckin) {
                for (const [name, expression] of Object.entries(
                    config.familyCheckin,
                )) {
                    this.familyCheckin[name] = new RegExp(
                        `\\b${expression}\\b`,
                    );
                }
                console.log(this.familyCheckin);
            }
            console.log("Loaded prefilter configuration from", this.configFile);
        } catch (error) {
            console.error("Failed to load configuration:", error);
        }
    }

    prefilter: FilterFn = (content) => {
        const metrics = this.extractMetrics(content);
        const structuredSection = this.formatMetrics(metrics);

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
        };
    }

    private formatMetrics(
        metrics: ReturnType<typeof this.extractMetrics>,
    ): string {
        const lines: string[] = [];

        // Iteration info
        lines.push(`Iteration: ${metrics.iteration.current} of 4`);
        lines.push(
            `Can ask more questions: ${metrics.iteration.canAskMore ? "yes" : "no"}`,
        );
        if (metrics.health.tierTag) {
            lines.push(`Self-assessment: ${metrics.health.tierTag}`);
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

        lines.push("");
        lines.push(`Workday: ${metrics.workday.display}`);
        this.pushPresentAbsent(
            lines,
            "Work patterns",
            Object.entries(metrics.work),
        );

        lines.push(`Family mentions: ${metrics.familyMentions}`);
        lines.push("");

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

        const yoga = hasTag(["#me/✅/🧘"]) ? this.yes : this.no;
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
        ])
            ? this.yes
            : this.no;

        return {
            "extra greens": extraGreens,
            "exercise ring": exerciseRing,
            "movement ring": movementRing,
            "stand ring": standRing,
            chores,
            vitamins,
            water,
            yoga,
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
}

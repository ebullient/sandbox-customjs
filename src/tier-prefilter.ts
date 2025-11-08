import type { App } from "obsidian";
import type { FilterFn } from "./@types/journal-reflect.types";

interface PrefilterConfig {
    familyCheckin: string[];
}

export class TierPrefilter {
    configFile = "assets/config/tier-prefilter-config.yaml";
    familyCheckin: RegExp[] = [];
    app: App;

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
     * Load configuration from YAML file
     */
    async loadConfig(): Promise<void> {
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
                this.familyCheckin = config.familyCheckin.map(
                    (x) => new RegExp(`\\b${x}\\b`),
                );
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
        return {
            iteration: this.extractIteration(content),
            health: this.extractHealthTags(content),
            work: this.extractWorkPatterns(content),
            checkboxes: this.extractCheckboxes(content),
            familyCheckins: this.extractFamilyCheckins(content),
            sleep: this.extractSleep(content),
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
        lines.push("");

        // Health metrics
        const healthParts = [
            `vitamins ${metrics.health.vitamins}`,
            `yoga ${metrics.health.yoga}`,
            `movement ring ${metrics.health.movementRing}`,
            `stand ring ${metrics.health.standRing}`,
            `exercise ring ${metrics.health.exerciseRing}`,
            `extra greens ${metrics.health.extraGreens}`,
            `journaling ${metrics.health.journaling}`,
        ];
        lines.push(`Health metrics: ${healthParts.join(", ")}`);
        lines.push(`Current tier tag: ${metrics.health.tierTag}`);
        lines.push("");

        // Work patterns
        const workParts = [
            `stopped at ${metrics.work.stoppedAt}`,
            `worked past 6pm ${metrics.work.workedPast6pm}`,
            `breaks mentioned ${metrics.work.breakCount}`,
            `hyperfocus mentioned ${metrics.work.hyperfocus}`,
        ];
        lines.push(`Work patterns: ${workParts.join(", ")}`);
        lines.push("");

        // Checkboxes
        lines.push("Tier assessment checkboxes:");
        if (metrics.checkboxes.found) {
            if (metrics.checkboxes.workedPast6pm !== "not answered") {
                lines.push(
                    `- Worked past 6pm: ${metrics.checkboxes.workedPast6pm}`,
                );
            }
            if (metrics.checkboxes.skippedBreaks !== "not answered") {
                lines.push(
                    `- Skipped breaks: ${metrics.checkboxes.skippedBreaks}`,
                );
            }
            if (metrics.checkboxes.startedNewProjects !== "not answered") {
                lines.push(
                    `- Started new projects: ${metrics.checkboxes.startedNewProjects}`,
                );
            }
            if (metrics.checkboxes.fastSpeech !== "not answered") {
                lines.push(
                    `- Fast speech noted: ${metrics.checkboxes.fastSpeech}`,
                );
            }
            if (metrics.checkboxes.struggledBasics !== "not answered") {
                lines.push(
                    `- Struggled with basics: ${metrics.checkboxes.struggledBasics}`,
                );
            }
            if (metrics.checkboxes.tiredButWired !== "not answered") {
                lines.push(
                    `- Tired but wired: ${metrics.checkboxes.tiredButWired}`,
                );
            }
        } else {
            lines.push("[none found]");
        }
        lines.push("");

        // Family check-ins
        lines.push(
            `Family check-ins: ${metrics.familyCheckins} mention${metrics.familyCheckins !== 1 ? "s" : ""} in text`,
        );
        lines.push("");

        // Sleep
        lines.push(`Sleep last night: ${metrics.sleep}`);

        return lines.join("\n");
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

    private extractHealthTags(content: string) {
        const hasTag = (tag: string) => (content.includes(tag) ? "✓" : "✗");

        // Extract tier tag
        let tierTag = "none";
        if (content.includes("#me/🌓/tier1")) {
            tierTag = "tier1";
        } else if (content.includes("#me/🌓/tier2")) {
            tierTag = "tier2";
        } else if (content.includes("#me/🌓/tier3")) {
            tierTag = "tier3";
        } else if (content.includes("#me/🌓/tier4")) {
            tierTag = "tier4";
        } else if (content.includes("#me/🌓/mixed")) {
            tierTag = "mixed";
        }

        return {
            vitamins: hasTag("#me/✅/✨"),
            yoga: hasTag("#me/✅/🧘"),
            movementRing: hasTag("#me/✅/🔴"),
            standRing: hasTag("#me/✅/🔵"),
            exerciseRing: hasTag("#me/✅/🟢"),
            extraGreens: hasTag("#me/✅/☘️"),
            journaling: hasTag("#me/✅/✍️"),
            tierTag,
        };
    }

    private extractWorkPatterns(content: string) {
        // Extract stop time
        let stoppedAt = "unknown";
        let workedPast6pm = "unknown";

        const timePatterns = [
            /(?:stopped|worked until|finished work) at (\d{1,2}):?(\d{2})?\s*([ap]m)?/i,
            /(?:stopped|worked until|finished work) at ([a-z]+) ([ap]m)/i,
        ];

        for (const pattern of timePatterns) {
            const match = content.match(pattern);
            if (match) {
                const time = this.parseTime(match[1], match[2], match[3]);
                if (time) {
                    stoppedAt = time;
                    const hour = Number.parseInt(time.split(":")[0], 10);
                    workedPast6pm = hour >= 18 ? "yes" : "no";
                }
                break;
            }
        }

        // Count breaks
        const breakMatches = content.match(/\b(break|timer)\b/gi);
        const breakCount = breakMatches ? breakMatches.length : 0;

        // Check for hyperfocus
        const hyperfocusPattern = /\b(hyperfocus(?:ed)?|lost track of time)\b/i;
        const hyperfocus = hyperfocusPattern.test(content) ? "yes" : "no";

        return {
            stoppedAt,
            workedPast6pm,
            breakCount,
            hyperfocus,
        };
    }

    private parseTime(
        hourStr: string,
        minuteStr?: string,
        meridiem?: string,
    ): string | null {
        const wordToNum: Record<string, number> = {
            one: 1,
            two: 2,
            three: 3,
            four: 4,
            five: 5,
            six: 6,
            seven: 7,
            eight: 8,
            nine: 9,
            ten: 10,
            eleven: 11,
            twelve: 12,
        };

        let hour = Number.parseInt(hourStr, 10);
        if (Number.isNaN(hour)) {
            hour = wordToNum[hourStr.toLowerCase()] ?? 0;
        }
        if (hour === 0) {
            return null;
        }

        const minute = minuteStr ? Number.parseInt(minuteStr, 10) : 0;

        // Convert to 24-hour format
        if (meridiem) {
            const isPm = meridiem.toLowerCase() === "pm";
            if (isPm && hour < 12) {
                hour += 12;
            } else if (!isPm && hour === 12) {
                hour = 0;
            }
        }

        return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    }

    private extractCheckboxes(content: string) {
        const checkboxPattern = /^[ \t]*-\s+\[([ xX])\]\s+(.+)$/gm;
        const matches = [...content.matchAll(checkboxPattern)];

        if (matches.length === 0) {
            return {
                found: false,
                workedPast6pm: "not answered" as const,
                skippedBreaks: "not answered" as const,
                startedNewProjects: "not answered" as const,
                fastSpeech: "not answered" as const,
                struggledBasics: "not answered" as const,
                tiredButWired: "not answered" as const,
            };
        }

        const getCheckboxStatus = (patterns: RegExp[]) => {
            for (const match of matches) {
                const isChecked = match[1] !== " ";
                const checkboxText = match[2].toLowerCase();
                for (const pattern of patterns) {
                    if (pattern.test(checkboxText)) {
                        return isChecked ? "✓" : "✗";
                    }
                }
            }
            return "not answered" as const;
        };

        return {
            found: true,
            workedPast6pm: getCheckboxStatus([/worked past 6\s*pm/i]),
            skippedBreaks: getCheckboxStatus([/skipped? breaks?/i]),
            startedNewProjects: getCheckboxStatus([/started? new projects?/i]),
            fastSpeech: getCheckboxStatus([/fast speech|speech/i]),
            struggledBasics: getCheckboxStatus([
                /struggled? (?:with )?basics?/i,
            ]),
            tiredButWired: getCheckboxStatus([
                /tired (?:but|and) wired|tired.+wired/i,
            ]),
        };
    }

    private extractFamilyCheckins(content: string): number {
        const familyMatches = this.familyCheckin.map((regex) =>
            regex.test(content),
        );
        console.log(familyMatches);
        return familyMatches?.length ?? 0;
    }

    private extractSleep(content: string): string {
        const sleepPatterns = [
            /slept (\d+(?:\.\d+)?)\s*hours?/i,
            /got (\d+(?:\.\d+)?)\s*hours? of sleep/i,
            /sleep:\s*(\d+(?:\.\d+)?)/i,
            /(\d+(?:\.\d+)?)\s*hours? of sleep/i,
        ];

        for (const pattern of sleepPatterns) {
            const match = content.match(pattern);
            if (match) {
                return `${match[1]} hours`;
            }
        }

        return "not mentioned";
    }
}

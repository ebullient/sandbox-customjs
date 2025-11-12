import type { App } from "obsidian";
import type { EngineAPI } from "./@types/jsengine.types";
import type { Utils } from "./_utils";

interface TierData {
    date: string; // YYYY-MM-DD format
    tier1: number | null; // First tier found (1-4)
    tier2: number | null; // Second tier found (for split cells)
    isError: boolean; // True if 3+ tier tags found
}

export class TierTracker {
    // Tier colors from obsidian-theme-ebullientworks
    tierColors = {
        1: "230, 133, 132", // red-3
        2: "179, 153, 174", // purple-3
        3: "145, 166, 149", // green-3
        4: "236, 201, 134", // yellow-2 (brighter)
    };

    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded TierTracker");
    }

    utils = (): Utils => window.customJS.Utils;

    /**
     * Gets tier data for up to the last 52 weeks.
     * Only includes weeks that have at least one tier tag.
     * Returns a map of date string (YYYY-MM-DD) to tier data,
     * plus the actual start date (which may be less than 52 weeks ago).
     */
    getTierDataForWeeks = async (): Promise<{
        tierData: Map<string, TierData>;
        actualStartDate: string;
    }> => {
        const tierData = new Map<string, TierData>();
        const current = window.moment();

        // Calculate 52 weeks back from the end of current week (Sunday)
        const endOfWeek = current.clone().day(7); // Sunday
        const maxStartDate = window
            .moment(endOfWeek)
            .subtract(52, "weeks")
            .add(1, "days");

        const prefix = "me/🌓/tier";

        // Get daily note files that have tier tags (nested under #me/🌓)
        const tagsByFile = this.utils().tagsForDatesByFile(
            maxStartDate,
            endOfWeek,
            ["#me/🌓"],
        );

        // Process tags for each file (only files with #me/🌓 tags)
        for (const [f, tags] of tagsByFile) {
            const dateStr = f.name.replace(".md", ""); // YYYY-MM-DD format
            const tierTags: number[] = [];

            // Find all tier tags for this day
            for (const t of tags) {
                if (t.startsWith(prefix)) {
                    const tierNum = Number.parseInt(t.slice(prefix.length), 10);
                    if (tierNum >= 1 && tierNum <= 4) {
                        tierTags.push(tierNum);
                    }
                }
            }

            // Store tier data based on number of tier tags found
            if (tierTags.length === 1) {
                tierData.set(dateStr, {
                    date: dateStr,
                    tier1: tierTags[0],
                    tier2: null,
                    isError: false,
                });
            } else if (tierTags.length === 2) {
                // Sort to ensure consistent ordering
                tierTags.sort();
                tierData.set(dateStr, {
                    date: dateStr,
                    tier1: tierTags[0],
                    tier2: tierTags[1],
                    isError: false,
                });
            } else if (tierTags.length >= 3) {
                // 3+ tags = error
                console.warn(
                    `Multiple tier tags found for ${dateStr}:`,
                    tierTags,
                );
                tierData.set(dateStr, {
                    date: dateStr,
                    tier1: null,
                    tier2: null,
                    isError: true,
                });
            }
            // Note: tierTags.length === 0 means file has #me/🌓 but no tier subtags
            // We skip these files (don't add to tierData)
        }

        // Find the earliest date with tier data
        let actualStartDate = endOfWeek.format("YYYY-MM-DD");
        if (tierData.size > 0) {
            const dates = Array.from(tierData.keys()).sort();
            actualStartDate = dates[0];
        }

        console.debug(
            "Actual tier data range:",
            actualStartDate,
            "to",
            endOfWeek.format("YYYY-MM-DD"),
            `(${tierData.size} days)`,
        );

        return { tierData, actualStartDate };
    };

    /**
     * Renders a GitHub-style contribution grid showing tier data.
     * Grid is 7 rows (days of week) × N columns (weeks with data).
     */
    renderGrid = (
        tierData: Map<string, TierData>,
        startDateStr: string,
    ): HTMLElement => {
        const container = createEl("div");
        container.style.cssText = `
			display: flex;
			align-items: center;
			gap: 20px;
			padding: 20px;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		`;

        // Create legend first (on the left)
        const legend = container.createEl("div");
        legend.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: 8px;
			font-size: 12px;
		`;

        // Add legend items for each tier
        for (let tier = 1; tier <= 4; tier++) {
            const item = legend.createEl("div");
            item.style.cssText = `
				display: flex;
				align-items: center;
				gap: 8px;
			`;

            const colorBox = item.createEl("div");
            const color = this.tierColors[tier as keyof typeof this.tierColors];
            colorBox.style.cssText = `
				width: 16px;
				height: 16px;
				border-radius: 2px;
				background-color: rgb(${color});
			`;

            const label = item.createEl("span");
            label.setText(`Tier ${tier}`);
        }

        // Create grid container (on the right)
        const grid = container.createEl("div");
        grid.style.cssText = `
			display: grid;
			grid-template-rows: repeat(7, 12px);
			grid-auto-flow: column;
			grid-auto-columns: 12px;
			gap: 2px;
		`;

        const current = window.moment();
        const endOfWeek = current.clone().day(7); // Sunday

        // Adjust start date to nearest Monday (beginning of week)
        const startDate = window.moment(startDateStr);
        const startDayOfWeek = startDate.day(); // 0 = Sunday, 1 = Monday, etc.
        if (startDayOfWeek !== 1) {
            // If not Monday, go back to the previous Monday
            const daysToSubtract =
                startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
            startDate.subtract(daysToSubtract, "days");
        }

        // Iterate through each day from Monday of first week to end of current week
        const iterDate = window.moment(startDate);
        while (iterDate.isSameOrBefore(endOfWeek)) {
            const dateStr = iterDate.format("YYYY-MM-DD");
            const data = tierData.get(dateStr);

            const cell = grid.createEl("div");
            cell.style.cssText = `
				width: 12px;
				height: 12px;
				border-radius: 2px;
				cursor: pointer;
			`;

            // Build tooltip text
            let tooltipText = dateStr;
            if (iterDate.isAfter(current)) {
                tooltipText += " • Future";
            } else if (!data) {
                tooltipText += " • No tier data";
            } else if (data.isError) {
                tooltipText += " • Error: 3+ tier tags";
            } else if (data.tier1 !== null && data.tier2 !== null) {
                tooltipText += ` • Tier ${data.tier1}/${data.tier2}`;
            } else if (data.tier1 !== null) {
                tooltipText += ` • Tier ${data.tier1}`;
            } else {
                tooltipText += " • No tier data";
            }

            // Set tooltip (aria-label for Obsidian's tooltip system)
            cell.setAttribute("aria-label", tooltipText);

            // Determine cell styling based on tier data
            if (iterDate.isAfter(current)) {
                // Future date: transparent
                cell.style.backgroundColor = "transparent";
            } else if (!data || data.isError) {
                // Error or missing data: gray with optional error indicator
                cell.style.backgroundColor = "rgba(128, 128, 128, 0.2)";
                cell.style.border = "1px solid rgba(128, 128, 128, 0.3)";
                if (data?.isError) {
                    cell.style.color = "#ff0000";
                    cell.style.fontSize = "8px";
                    cell.style.lineHeight = "12px";
                    cell.style.textAlign = "center";
                    cell.setText("!");
                }
            } else if (data.tier1 !== null && data.tier2 !== null) {
                // Split cell: two tiers (gradient left-to-right)
                const color1 =
                    this.tierColors[data.tier1 as keyof typeof this.tierColors];
                const color2 =
                    this.tierColors[data.tier2 as keyof typeof this.tierColors];
                cell.style.background = `linear-gradient(90deg, rgb(${color1}) 50%, rgb(${color2}) 50%)`;
            } else if (data.tier1 !== null) {
                // Single tier: solid color
                const color =
                    this.tierColors[data.tier1 as keyof typeof this.tierColors];
                cell.style.backgroundColor = `rgb(${color})`;
            } else {
                // No tier data for past date: gray
                cell.style.backgroundColor = "rgba(128, 128, 128, 0.2)";
                cell.style.border = "1px solid rgba(128, 128, 128, 0.3)";
            }

            // Store date for future interactivity (clicks)
            cell.setAttribute("data-date", dateStr);

            iterDate.add(1, "days");
        }

        return container;
    };

    /**
     * Creates a tier tracking grid visualization.
     * Entry point for JSEngine.
     */
    createGrid = async (_: EngineAPI): Promise<HTMLElement> => {
        const result = await this.getTierDataForWeeks();
        console.debug("Tier data collected:", result.tierData.size, "days");

        const container = createEl("div");
        const grid = this.renderGrid(result.tierData, result.actualStartDate);
        container.appendChild(grid);

        return container;
    };
}

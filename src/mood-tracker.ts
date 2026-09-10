import type { App } from "obsidian";
import type { EngineAPI } from "./@types/jsengine.types";
import type { Utils } from "./_utils";

declare global {
    interface Window {
        renderChart: (chartData: object, container: HTMLElement) => void;
    }
}

interface RadarDataSet {
    label: string;
    data: number[];
}

interface RadarChartOptions {
    type: string;
    data: {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
            backgroundColor: string;
            borderColor: string;
            borderWidth: number;
        }[];
    };
    options: {
        scales: {
            r: {
                min: number;
                max: number;
                angleLines: {
                    color: string;
                };
                grid: {
                    color: string;
                };
                ticks: {
                    showLabelBackdrop: boolean;
                    color: string;
                    z: number;
                    padding: number;
                };
            };
        };
    };
}

export class MoodTracker {
    // Markers tracked under #me/mood/<marker>
    // Keep this list in sync with demesne/self/mood/mood-markers.md
    markers: string[] = [
        "anxiety",
        "rejection-fear",
        "irritability",
        "fixated-circles",
        "hopelessness",
        "tearfulness",
        "withdrawal",
    ];

    colors = [
        "236,201,134", // this week
        "230,133,132", // last week
        "142,103,135", // 4 weeks
        "69,117,174", // 12
        "158,190,188", // 48
    ];

    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded MoodTracker");
    }

    utils = (): Utils => window.customJS.Utils;

    /**
     * Gets mood marker data for up to the last `weeksBack` weeks.
     * Returns a map of week-start date string (YYYY-MM-DD, Monday) to
     * a map of marker -> count of days that week the marker appeared,
     * plus the actual start date (which may be less than weeksBack ago).
     */
    getMoodDataForWeeks = async (
        weeksBack = 12,
    ): Promise<{
        weeklyData: Map<string, Map<string, number>>;
        actualStartDate: string;
    }> => {
        const weeklyData = new Map<string, Map<string, number>>();
        const current = this.utils().momentFn();

        // Calculate weeksBack weeks from the end of current week (Sunday)
        const endOfWeek = current.clone().day(7); // Sunday
        const maxStartDate = window
            .moment(endOfWeek)
            .subtract(weeksBack, "weeks")
            .add(1, "days");

        const prefix = "me/mood/";

        // Get daily note files that have mood tags (nested under #me/mood)
        const tagsByFile = this.utils().tagsForDatesByFile(
            maxStartDate,
            endOfWeek,
            ["#me/mood"],
        );

        for (const [f, tags] of tagsByFile) {
            if (!this.utils().dailyNotePattern.test(f.name)) {
                continue;
            }
            const dateStr = f.name.replace(".md", ""); // YYYY-MM-DD format
            const date = this.utils().momentFn(dateStr);

            // Find the Monday that starts this date's week
            const dayOfWeek = date.day(); // 0 = Sunday, 1 = Monday, etc.
            const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const weekStart = date
                .clone()
                .subtract(daysToSubtract, "days")
                .format("YYYY-MM-DD");

            if (!weeklyData.has(weekStart)) {
                weeklyData.set(weekStart, new Map<string, number>());
            }
            const weekCounts = weeklyData.get(weekStart);

            // De-dupe markers within a single day before counting
            // (a day can have multiple markers, unlike tier's single/split value)
            const foundMarkers = new Set<string>();
            for (const t of tags) {
                if (t.startsWith(prefix)) {
                    foundMarkers.add(t.slice(prefix.length));
                }
            }
            for (const marker of foundMarkers) {
                weekCounts.set(marker, (weekCounts.get(marker) ?? 0) + 1);
            }
        }

        let actualStartDate = endOfWeek.format("YYYY-MM-DD");
        if (weeklyData.size > 0) {
            const weeks = Array.from(weeklyData.keys()).sort();
            actualStartDate = weeks[0];
        }

        return { weeklyData, actualStartDate };
    };

    /**
     * Averages marker day-counts across `windowWeeks` weeks present in
     * `weeklyData`, starting `weeksAgo` weeks back from most recent, giving
     * an avg days/week per marker (0-7 scale) comparable to a single week's
     * counts. e.g. weeksAgo=0 is the most recent weeks; weeksAgo=1 skips the
     * most recent week (useful for an isolated "last week" reading).
     */
    averageOverWeeks = (
        weeklyData: Map<string, Map<string, number>>,
        windowWeeks: number,
        weeksAgo = 0,
    ): number[] => {
        const weeks = Array.from(weeklyData.keys()).sort().reverse();
        const recentWeeks = weeks.slice(weeksAgo, weeksAgo + windowWeeks);

        const totals = this.markers.map(() => 0);
        for (const weekStart of recentWeeks) {
            const counts = weeklyData.get(weekStart);
            this.markers.forEach((marker, i) => {
                totals[i] += counts?.get(marker) ?? 0;
            });
        }

        if (recentWeeks.length === 0) {
            return totals;
        }
        return totals.map(
            (t) => Math.round((t / recentWeeks.length) * 10) / 10,
        );
    };

    /**
     * Renders a radar chart in the specified container.
     * @param {HTMLElement} container The container to render the chart in.
     * @param {string[]} labels The labels for the radar chart.
     * @param {Object} series The data series for the radar chart.
     */
    renderRadarChart = (
        container: HTMLElement,
        labels: string[],
        series: RadarDataSet[],
    ) => {
        const chartOptions: RadarChartOptions = {
            type: "radar",
            data: {
                labels,
                datasets: [],
            },
            options: {
                scales: {
                    r: {
                        min: 0,
                        max: 7,
                        angleLines: {
                            color: "rgba(128, 128, 128, 0.2)",
                        },
                        grid: {
                            color: "rgba(128, 128, 128, 0.2)",
                        },
                        ticks: {
                            showLabelBackdrop: false,
                            color: "#a0a0a0",
                            z: 10,
                            padding: 10,
                        },
                    },
                },
            },
        };

        series.forEach((dataset, i) => {
            chartOptions.data.datasets.push({
                label: dataset.label,
                data: dataset.data,
                backgroundColor: "transparent",
                borderColor: `rgb(${this.colors[i]})`,
                borderWidth: 2,
            });
        });

        const chartData = {
            chartOptions: chartOptions,
            width: "80%",
        };
        window.renderChart(chartData, container);
    };

    /**
     * Renders a table: rows = weeks (most recent first), columns = markers,
     * cells = count of days that week the marker showed up (0-7).
     *
     * A single grid cell per day (like TierTracker's contribution grid)
     * doesn't fit here because a day can carry more than one marker at once,
     * so this rolls up to a weekly frequency table instead.
     */
    renderTable = (
        weeklyData: Map<string, Map<string, number>>,
    ): HTMLElement => {
        const container = createEl("div");
        container.style.cssText = `
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 10px 0;
        `;

        const table = container.createEl("table");
        table.style.cssText = "border-collapse: collapse; font-size: 12px;";

        const headerRow = table.createEl("tr");
        const weekHeader = headerRow.createEl("th", { text: "Week of" });
        weekHeader.style.cssText =
            "text-align: left; padding: 4px 10px; color: var(--text-muted);";
        for (const marker of this.markers) {
            const th = headerRow.createEl("th", { text: marker });
            th.style.cssText =
                "text-align: center; padding: 4px 10px; font-weight: 500;";
        }

        const weeks = Array.from(weeklyData.keys()).sort().reverse();
        for (const weekStart of weeks) {
            const counts = weeklyData.get(weekStart);
            const row = table.createEl("tr");
            const weekCell = row.createEl("td", { text: weekStart });
            weekCell.style.cssText =
                "padding: 4px 10px; color: var(--text-muted);";
            for (const marker of this.markers) {
                const count = counts.get(marker) ?? 0;
                const cell = row.createEl("td", {
                    text: count > 0 ? String(count) : "",
                });
                const alpha =
                    count > 0 ? Math.min(0.15 + count * 0.12, 0.75) : 0;
                cell.style.cssText = `
                    text-align: center;
                    padding: 4px 10px;
                    background-color: rgba(120, 130, 165, ${alpha});
                    border-radius: 3px;
                `;
            }
        }

        return container;
    };

    /**
     * Creates a weekly mood-marker rollup table.
     * Entry point for JSEngine.
     */
    createWeeklyTable = async (
        _: EngineAPI,
        weeksBack = 12,
    ): Promise<HTMLElement> => {
        const result = await this.getMoodDataForWeeks(weeksBack);
        console.debug("Mood data collected:", result.weeklyData.size, "weeks");
        return this.renderTable(result.weeklyData);
    };

    /**
     * Creates a report with a radar chart (this/last week, 4/12/48-week
     * averages) followed by the weekly rollup table.
     * Entry point for JSEngine.
     */
    createReport = async (
        _: EngineAPI,
        weeksBack = 48,
    ): Promise<HTMLElement> => {
        const result = await this.getMoodDataForWeeks(weeksBack);
        console.debug("Mood data collected:", result.weeklyData.size, "weeks");

        const container = createEl("div");

        const chart = container.createEl("div");
        this.renderRadarChart(chart, this.markers, [
            {
                label: "this week",
                data: this.averageOverWeeks(result.weeklyData, 1, 0),
            },
            {
                label: "last week",
                data: this.averageOverWeeks(result.weeklyData, 1, 1),
            },
            {
                label: "4 weeks",
                data: this.averageOverWeeks(result.weeklyData, 4),
            },
            {
                label: "12 weeks",
                data: this.averageOverWeeks(result.weeklyData, 12),
            },
            {
                label: "48 weeks",
                data: this.averageOverWeeks(result.weeklyData, 48),
            },
        ]);

        container.appendChild(this.renderTable(result.weeklyData));

        return container;
    };
}

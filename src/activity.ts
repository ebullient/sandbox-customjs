import type { Moment } from "moment";
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

interface ActivityResult {
    activities: string[];
    count: number[];
    weeks: number;
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

export class Activity {
    activities: Record<string, string[]> = {
        "✨": ["✨", "🍀", "☘️"],
        "🔴": ["🔴"],
        "🔵": ["🔵"],
        "💚": ["🟢", "🏊", "💃"],
        "💦": ["✨", "💧", "🍀", "☘️"],
        "✍️": ["✍️", "📖"],
        "🧼": ["🧼", "🧽", "🧹", "🧺", "🪣", "🪏"],
    };

    colors = [
        "236,201,134", // this week
        "230,133,132", // last week
        "142,103,135", // 4 weeks
        "69,117,174", // 12
        "158,190,188", // 48
        "167,92,112",
    ];

    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded Templates");
    }

    utils = (): Utils => window.customJS.Utils;

    /**
     * Counts the tags within the specified date range.
     * @param {Moment} begin The beginning date (inclusive).
     * @param {Moment} end The ending date (inclusive).
     * @returns {Promise<Object>} An object with activity keys (labels) and
     *      the count for each activity found between the starting and ending dates.
     * @see utils.tagsForDates
     */
    countTags = async (begin: Moment, end: Moment): Promise<ActivityResult> => {
        const keys = Object.keys(this.activities);
        const count = keys.map(() => 0);
        const prefix = "me/✅/";

        // Track unique days for each activity category
        const daysPerActivity: Set<string>[] = keys.map(() => new Set());

        // Get daily note files and their tags within the date range
        const tagsByFile = this.utils().tagsForDatesByFile(begin, end, []);

        // Process tags for each file
        for (const [f, tags] of tagsByFile) {
            const day = f.name.replace(".md", "");

            for (const t of tags) {
                if (t.startsWith(prefix)) {
                    const value = t.slice(prefix.length);
                    //console.log(day, "checking", t, value);

                    for (const [i, key] of keys.entries()) {
                        if (this.activities[key].includes(value)) {
                            daysPerActivity[i].add(day);
                        }
                    }
                }
            }
        }

        // Convert sets to counts
        for (const [i, daySet] of daysPerActivity.entries()) {
            count[i] = daySet.size;
        }

        const days = end.diff(begin, "days");
        const weeks = days < 7 ? 1 : Math.round(days / 7);
        console.debug(
            "Range:",
            begin.format("YYYY-MM-DD"),
            "to",
            end.format("YYYY-MM-DD"),
            "| Raw counts:",
            count,
            "| Days:",
            days,
            "| Weeks:",
            weeks,
        );

        if (weeks > 1) {
            count.forEach((c, i) => {
                count[i] = Math.round(c / weeks);
            });
            console.debug("Averaged per week:", count);
        }

        return {
            activities: keys,
            count,
            weeks,
        };
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
     * Renders a bar chart in the specified container.
     * @param {HTMLElement} container The container to render the chart in.
     * @param {ActivityResult} input The input data for the bar chart.
     * @param {number} factor The factor to normalize the data.
     */
    renderBarChart = (container: HTMLElement, input: ActivityResult) => {
        const chartOptions = {
            type: "bar",
            data: {
                labels: input.activities,
                datasets: [
                    {
                        label: "Activities",
                        data: input.count,
                        backgroundColor: [
                            "rgb(187, 79, 108)",
                            "rgb(142, 103, 135)",
                            "rgb(53, 120, 175)",
                            "rgb(61, 126, 123)",
                            "rgb(92, 122, 99)",
                            "rgb(234, 175, 0)",
                        ],
                        beginAtZero: true,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                animation: false,
                events: ["click"],
                transitions: {
                    active: {
                        animation: {
                            duration: 0,
                        },
                    },
                },
                scales: {
                    y: {
                        min: 0,
                        max: 7,
                        grid: {
                            color: "rgba(128, 128, 128, 0.2)",
                        },
                    },
                },
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
            },
        };
        const chartData = {
            chartOptions: chartOptions,
            width: "80%",
        };
        window.renderChart(chartData, container);
    };

    /**
     * Creates a report with charts for the specified date ranges.
     * @param {JSEngine} engine The engine to create markdown (not used).
     * @returns {Promise<HTMLElement>} A promise that resolves to an HTML element containing the report.
     */
    createReport = async (_: EngineAPI): Promise<HTMLElement> => {
        const current = window.moment();
        const monday = window.moment(current).day(1);
        const lastMonday = window.moment(monday).subtract(1, "weeks");
        const prev4 = window.moment(monday).subtract(4, "weeks");
        const prev12 = window.moment(monday).subtract(12, "weeks");
        const prev48 = window.moment(monday).subtract(48, "weeks");

        const dataWeek = await this.countTags(
            monday,
            window.moment(monday).day(7),
        );
        console.debug("this week", dataWeek);
        const lastWeek = await this.countTags(
            lastMonday,
            window.moment(lastMonday).day(7),
        );
        const last4 = await this.countTags(prev4, monday);
        const last12 = await this.countTags(prev12, monday);
        const last48 = await this.countTags(prev48, monday);

        const container = createEl("div");

        let chart = container.createEl("div");
        this.renderRadarChart(chart, Object.keys(this.activities), [
            { label: "this week", data: dataWeek.count },
            { label: "last week", data: lastWeek.count },
            { label: "4 weeks", data: last4.count },
            { label: "12 weeks", data: last12.count },
            { label: "48 weeks", data: last48.count },
        ]);

        container.createEl("h2").setText("This Week");
        chart = container.createEl("div");
        this.renderBarChart(chart, dataWeek);

        container.createEl("h2").setText("Last Week");
        chart = container.createEl("div");
        this.renderBarChart(chart, lastWeek);

        container.createEl("h2").setText("Last 4 weeks (average)");
        chart = container.createEl("div");
        this.renderBarChart(chart, last4);

        container.createEl("h2").setText("Last 12 weeks (average)");
        chart = container.createEl("div");
        this.renderBarChart(chart, last12);

        container.createEl("h2").setText("Last 48 weeks (average)");
        chart = container.createEl("div");
        this.renderBarChart(chart, last48);

        return container;
    };
}

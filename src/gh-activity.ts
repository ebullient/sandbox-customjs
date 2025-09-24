import type { App, TFile } from "obsidian";
import type { EngineAPI } from "./@types/jsengine.types";

declare global {
    interface Window {
        renderChart: (chartData: object, container: HTMLElement) => void;
    }
    function createEl(tagName: string): HTMLElement;
}

interface RepositoryData {
    name: string;
    cumulative: Record<string, number>;
}

interface LineChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor: string;
        borderColor: string;
        borderWidth: number;
        pointRadius: number;
        pointHoverRadius: number;
    }[];
}
interface LineChartOptions {
    type: string;
    data: LineChartData;
    options: {
        animation: boolean;
        maintainAspectRatio?: boolean;
        responsive?: boolean;
        layout?: {
            padding?: {
                right?: number;
                left?: number;
                top?: number;
                bottom?: number;
            };
        };
        scales: {
            x: {
                type?: string;
                time?: {
                    unit?: string;
                };
                bounds?: string;
                ticks?: {
                    display?: boolean;
                    maxTicksLimit?: number;
                    color?: string;
                };
                grid?: {
                    color?: string;
                };
            };
            y: {
                beginAtZero: boolean;
                grid: {
                    color: string;
                };
                ticks: {
                    color: string;
                };
            };
        };
        plugins: {
            legend: {
                display: boolean;
                position: string;
                labels: {
                    color: string;
                };
            };
        };
    };
}

export class GHActivity {
    colors = [
        "236,201,134", // repo 1
        "230,133,132", // repo 2
        "142,103,135", // repo 3
        "69,117,174", // repo 4
        "158,190,188", // repo 5
        "167,92,112", // repo 6
    ];

    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded GH Activity");
    }

    /**
     * Loads stargazers data from the specified JSON file.
     * @param {string} filePath Path to the stargazers JSON file
     * @returns {Promise<RepositoryData[]>} Array of repository data
     */
    loadStargazersData = async (
        filePath: string,
    ): Promise<RepositoryData[]> => {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file) {
                throw new Error(`File not found: ${filePath}`);
            }
            const content = await this.app.vault.read(file as TFile);
            return JSON.parse(content);
        } catch (error) {
            console.error("Error loading stargazers data:", error);
            return [];
        }
    };

    /**
     * Processes repository data to create chart datasets.
     * @param {RepositoryData[]} repositories Array of repository data
     * @returns {Object} Chart data with labels and datasets
     */
    processChartData = (repositories: RepositoryData[]) => {
        // Get all unique dates and sort them
        const allDates = new Set<string>();
        for (const repo of repositories) {
            for (const date of Object.keys(repo.cumulative)) {
                allDates.add(date);
            }
        }
        const sortedDates = Array.from(allDates).sort();

        // Create datasets for each repository
        const datasets = repositories.map((repo, index) => {
            const data = sortedDates.map((date) => repo.cumulative[date] || 0);

            // Fill in missing values with previous value
            for (let i = 1; i < data.length; i++) {
                if (data[i] === 0 && data[i - 1] > 0) {
                    data[i] = data[i - 1];
                }
            }

            return {
                label: repo.name,
                data: data,
                backgroundColor: "transparent",
                borderColor: `rgb(${this.colors[index % this.colors.length]})`,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 3,
            };
        });

        return {
            labels: sortedDates,
            datasets: datasets,
        };
    };

    /**
     * Renders a line chart in the specified container.
     * @param {HTMLElement} container The container to render the chart in
     * @param {Object} chartData The processed chart data
     */
    renderLineChart = (container: HTMLElement, chartData: LineChartData) => {
        const chartOptions: LineChartOptions = {
            type: "line",
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                layout: {
                    padding: {
                        right: 25,
                        left: 5,
                    },
                },
                scales: {
                    x: {
                        type: "time",
                        time: {
                            unit: "month",
                        },
                        bounds: "ticks",
                        // ticks: {
                        //     display: true,
                        //     color: "#a0a0a0",
                        // },
                        grid: {
                            color: "rgb(183, 183, 183)",
                        },
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: "rgb(183, 183, 183)",
                        },
                        ticks: {
                            color: "#a0a0a0",
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: true,
                        position: "top" as const,
                        labels: {
                            color: "#a0a0a0",
                        },
                    },
                },
            },
        };

        const chartRenderData = {
            chartOptions: chartOptions,
            width: "95%",
        };
        window.renderChart(chartRenderData, container);
    };

    /**
     * Generates summary statistics for repositories.
     * @param {RepositoryData[]} repositories Array of repository data
     * @returns {HTMLElement} HTML element containing summary
     */
    generateSummary = (repositories: RepositoryData[]): HTMLElement => {
        const summaryContainer = createEl("div");
        const summaryTitle = summaryContainer.createEl("h2");
        summaryTitle.setText("Summary");

        for (const repo of repositories) {
            const repoSection = summaryContainer.createEl("div");
            repoSection.style.marginBottom = "1em";

            const repoTitle = repoSection.createEl("h3");
            repoTitle.setText(repo.name);

            const dates = Object.keys(repo.cumulative).sort();
            const values = Object.values(repo.cumulative);
            const totalStars = Math.max(...values);
            const dataPoints = dates.length;
            const dateRange =
                dates.length > 0
                    ? `${dates[0]} to ${dates[dates.length - 1]}`
                    : "No data";

            const stats = repoSection.createEl("ul");
            stats.innerHTML = `
                <li><strong>Total Stars</strong>: ${totalStars}</li>
                <li><strong>Data Points</strong>: ${dataPoints}</li>
                <li><strong>Date Range</strong>: ${dateRange}</li>
            `;
        }

        return summaryContainer;
    };

    /**
     * Creates a stargazers chart report from the JSON data.
     * @param {EngineAPI} engine The engine to create markdown
     * @returns {Promise<HTMLElement>} A promise that resolves to an HTML element containing the report
     */
    createReport = async (_: EngineAPI): Promise<HTMLElement> => {
        const container = createEl("div");

        // Load the stargazers data
        const repositories = await this.loadStargazersData(
            "assets/stargazers.json",
        );

        if (repositories.length === 0) {
            container.createEl("p").setText("No stargazers data found.");
            return container;
        }

        // Create chart section
        const chartTitle = container.createEl("h2");
        chartTitle.setText("Chart");

        const chartContainer = container.createEl("div");
        chartContainer.style.height = "400px";
        chartContainer.style.width = "95%";
        chartContainer.style.maxWidth = "95%";
        chartContainer.style.position = "relative";
        chartContainer.style.marginBottom = "2em";

        const chartData = this.processChartData(repositories);
        this.renderLineChart(chartContainer, chartData);

        // Add summary section
        const summary = this.generateSummary(repositories);
        container.appendChild(summary);

        return container;
    };
}

import {
    type App,
    PluginSettingTab,
    type Setting,
    type SettingDefinitionItem,
} from "obsidian";
import type { TaskIndexPlugin } from "./taskindex-Plugin";

function parseList(value: string): string[] {
    return value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

export class TaskIndexSettingsTab extends PluginSettingTab {
    plugin: TaskIndexPlugin;

    constructor(app: App, plugin: TaskIndexPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.icon = "table-of-contents";
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                type: "group",
                heading: "Spheres",
                items: [
                    {
                        name: "Valid spheres",
                        desc: "Comma-separated list of valid sphere values (e.g., work, home, community)",
                        render: (setting: Setting) => {
                            setting.addText((text) =>
                                text
                                    .setPlaceholder("work, home, community")
                                    .setValue(
                                        this.plugin.settings.validSpheres.join(
                                            ", ",
                                        ),
                                    )
                                    .onChange(async (value) => {
                                        this.plugin.settings.validSpheres =
                                            parseList(value);
                                        await this.plugin.saveSettings();
                                    }),
                            );
                        },
                    },
                ],
            },
            {
                type: "group",
                heading: "Review thresholds",
                items: [
                    {
                        name: "Stale project weeks",
                        desc: "Flag projects not modified in this many weeks",
                        control: {
                            type: "number",
                            key: "staleProjectWeeks",
                            min: 1,
                            placeholder: "4",
                        },
                    },
                    {
                        name: "Waiting task days",
                        desc: "Flag #waiting tasks older than this many days",
                        control: {
                            type: "number",
                            key: "waitingTaskDays",
                            min: 1,
                            placeholder: "14",
                        },
                    },
                ],
            },
            {
                type: "group",
                heading: "Archive thresholds",
                items: [
                    {
                        name: "Minimum archive lines",
                        desc: "Minimum number of log entries required before creating an archive file",
                        control: {
                            type: "number",
                            key: "minArchiveLines",
                            min: 1,
                            placeholder: "50",
                        },
                    },
                ],
            },
            {
                type: "group",
                heading: "Task locations and markers",
                items: [
                    {
                        name: "Quest folders",
                        desc: "Comma-separated list of folders to scan for quest/area files",
                        render: (setting: Setting) => {
                            setting.addText((text) =>
                                text
                                    .setPlaceholder("areas, projects")
                                    .setValue(
                                        this.plugin.settings.questFolders.join(
                                            ", ",
                                        ),
                                    )
                                    .onChange(async (value) => {
                                        this.plugin.settings.questFolders =
                                            parseList(value);
                                        await this.plugin.saveSettings();
                                    }),
                            );
                        },
                    },
                    {
                        name: "Valid frontmatter types",
                        desc: "Comma-separated list of valid 'type' values in frontmatter (e.g., quest, area, project, demesne)",
                        render: (setting: Setting) => {
                            setting.addText((text) =>
                                text
                                    .setPlaceholder(
                                        "quest, area, project, demesne",
                                    )
                                    .setValue(
                                        this.plugin.settings.validTypes.join(
                                            ", ",
                                        ),
                                    )
                                    .onChange(async (value) => {
                                        this.plugin.settings.validTypes =
                                            parseList(value);
                                        await this.plugin.saveSettings();
                                    }),
                            );
                        },
                    },
                    {
                        name: "Purpose tags",
                        desc: "One tag per line (e.g., #me/🎯/🤓)",
                        render: (setting: Setting) => {
                            setting.addTextArea((text) => {
                                text.setPlaceholder(
                                    "#me/🎯/🤓\n#me/🧬/creativity/curiosity",
                                )
                                    .setValue(
                                        this.plugin.settings.purposeTags.join(
                                            "\n",
                                        ),
                                    )
                                    .onChange(async (value) => {
                                        this.plugin.settings.purposeTags = value
                                            .split("\n")
                                            .map((s) => s.trim())
                                            .filter((s) => s.length > 0);
                                        await this.plugin.saveSettings();
                                    });
                                text.inputEl.rows = 8;
                                text.inputEl.cols = 50;
                            });
                        },
                    },
                ],
            },
            {
                type: "group",
                heading: "Push targets",
                items: [
                    {
                        name: "Exclude years",
                        desc: "Comma-separated list of years to exclude from push targets (e.g., 2020, 2021)",
                        render: (setting: Setting) => {
                            setting.addText((text) =>
                                text
                                    .setPlaceholder("2020, 2021")
                                    .setValue(
                                        this.plugin.settings.excludeYears.join(
                                            ", ",
                                        ),
                                    )
                                    .onChange(async (value) => {
                                        this.plugin.settings.excludeYears =
                                            parseList(value)
                                                .map((s) =>
                                                    Number.parseInt(s, 10),
                                                )
                                                .filter(
                                                    (n) => !Number.isNaN(n),
                                                );
                                        await this.plugin.saveSettings();
                                    }),
                            );
                        },
                    },
                ],
            },
            {
                type: "group",
                heading: "Frontmatter tracking",
                items: [
                    {
                        name: "Track last modified",
                        desc: "Update last_modified frontmatter field when editing quest/area files",
                        control: {
                            type: "toggle",
                            key: "trackLastModified",
                        },
                    },
                    {
                        name: "Exclude paths from last modified tracking",
                        desc: "Comma-separated list of path prefixes to exclude (e.g., chronicles/journal, templates)",
                        render: (setting: Setting) => {
                            setting.addText((text) =>
                                text
                                    .setPlaceholder(
                                        "chronicles/journal, templates",
                                    )
                                    .setValue(
                                        this.plugin.settings.trackLastModifiedExcludePaths.join(
                                            ", ",
                                        ),
                                    )
                                    .onChange(async (value) => {
                                        this.plugin.settings.trackLastModifiedExcludePaths =
                                            parseList(value);
                                        await this.plugin.saveSettings();
                                    }),
                            );
                        },
                    },
                ],
            },
        ];
    }
}

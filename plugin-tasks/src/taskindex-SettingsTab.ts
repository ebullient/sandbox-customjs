import { type App, PluginSettingTab, Setting } from "obsidian";
import type { TaskIndexPlugin } from "./taskindex-Plugin";

export class TaskIndexSettingsTab extends PluginSettingTab {
    plugin: TaskIndexPlugin;

    constructor(app: App, plugin: TaskIndexPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.icon = "table-of-contents";
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl).setName("Spheres").setHeading();

        new Setting(containerEl)
            .setName("Valid spheres")
            .setDesc(
                "Comma-separated list of valid sphere values (e.g., work, home, community)",
            )
            .addText((text) =>
                text
                    .setPlaceholder("work, home, community")
                    .setValue(this.plugin.settings.validSpheres.join(", "))
                    .onChange(async (value) => {
                        this.plugin.settings.validSpheres = value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0);
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl).setName("Review thresholds").setHeading();

        new Setting(containerEl)
            .setName("Stale project weeks")
            .setDesc("Flag projects not modified in this many weeks")
            .addText((text) =>
                text
                    .setPlaceholder("4")
                    .setValue(String(this.plugin.settings.staleProjectWeeks))
                    .onChange(async (value) => {
                        const num = Number.parseInt(value, 10);
                        if (!Number.isNaN(num) && num > 0) {
                            this.plugin.settings.staleProjectWeeks = num;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        new Setting(containerEl)
            .setName("Waiting task days")
            .setDesc("Flag #waiting tasks older than this many days")
            .addText((text) =>
                text
                    .setPlaceholder("14")
                    .setValue(String(this.plugin.settings.waitingTaskDays))
                    .onChange(async (value) => {
                        const num = Number.parseInt(value, 10);
                        if (!Number.isNaN(num) && num > 0) {
                            this.plugin.settings.waitingTaskDays = num;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        // Archive thresholds
        new Setting(containerEl).setName("Archive thresholds").setHeading();

        new Setting(containerEl)
            .setName("Minimum archive lines")
            .setDesc(
                "Minimum number of log entries required before creating an archive file",
            )
            .addText((text) =>
                text
                    .setPlaceholder("50")
                    .setValue(String(this.plugin.settings.minArchiveLines))
                    .onChange(async (value) => {
                        const num = Number.parseInt(value, 10);
                        if (!Number.isNaN(num) && num > 0) {
                            this.plugin.settings.minArchiveLines = num;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        // Archive thresholds
        new Setting(containerEl)
            .setName("Task locations and markers")
            .setHeading();

        new Setting(containerEl)
            .setName("Quest folders")
            .setDesc(
                "Comma-separated list of folders to scan for quest/area files",
            )
            .addText((text) =>
                text
                    .setPlaceholder("areas, projects")
                    .setValue(this.plugin.settings.questFolders.join(", "))
                    .onChange(async (value) => {
                        this.plugin.settings.questFolders = value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0);
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Valid frontmatter types")
            .setDesc(
                "Comma-separated list of valid 'type' values in frontmatter (e.g., quest, area, project, demesne)",
            )
            .addText((text) =>
                text
                    .setPlaceholder("quest, area, project, demesne")
                    .setValue(this.plugin.settings.validTypes.join(", "))
                    .onChange(async (value) => {
                        this.plugin.settings.validTypes = value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0);
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Purpose tags")
            .setDesc("One tag per line (e.g., #me/🎯/🤓)")
            .addTextArea((text) => {
                text.setPlaceholder("#me/🎯/🤓\n#me/🧬/creativity/curiosity")
                    .setValue(this.plugin.settings.purposeTags.join("\n"))
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
    }
}

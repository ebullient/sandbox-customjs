import { type App, PluginSettingTab, Setting } from "obsidian";
import type CampaignNotesPlugin from "./main";

export class CampaignNotesSettingsTab extends PluginSettingTab {
    plugin: CampaignNotesPlugin;

    constructor(app: App, plugin: CampaignNotesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Campaign Notes Settings" });

        new Setting(containerEl)
            .setName("Include Folders")
            .setDesc(
                "Specify folders to include in the campaign notes index (comma-separated)",
            )
            .addText((text) =>
                text
                    .setPlaceholder("campaign-notes")
                    .setValue(this.plugin.settings.includeFolders.join(", "))
                    .onChange(async (value) => {
                        this.plugin.settings.includeFolders = value
                            .split(",")
                            .map((s) => s.trim().replace(/^\//, ""))
                            .filter((s) => s.length > 0);
                        await this.plugin.saveSettings();
                        this.plugin.index.rebuildIndex();
                    }),
            );

        new Setting(containerEl)
            .setName("Campaign Scopes")
            .setDesc("List of campaign scopes (comma-separated)")
            .addText((text) =>
                text
                    .setPlaceholder("heist, witchlight, spelljammer")
                    .setValue(this.plugin.settings.campaignScopes.join(", "))
                    .onChange(async (value) => {
                        this.plugin.settings.campaignScopes = value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0);
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Keep tags")
            .setDesc("Prefixes for additional tags to keep in index")
            .addText((text) =>
                text
                    .setPlaceholder(
                        "default: npc, group, area, location, item, encounter",
                    )
                    .setValue(this.plugin.settings.keepTagPrefix.join(", "))
                    .onChange(async (value) => {
                        this.plugin.settings.keepTagPrefix = value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0);
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(this.containerEl)
            .setName("Debug")
            .setDesc("Enable debug messages")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.debug)
                    .onChange(async (value) => {
                        this.plugin.settings.debug = value;
                        await this.plugin.saveSettings();
                    }),
            );
    }
}

import { debounce, Plugin, type TAbstractFile } from "obsidian";
import type { CampaignReferenceAPI } from "./@types/api";
import type { CampaignNotesSettings } from "./@types/settings";
import { CampaignReference } from "./CampaignNotes-Api";
import { CampaignNotesIndex, DEFAULT_SETTINGS } from "./CampaignNotes-Index";
import { CampaignNotesSettingsTab } from "./CampaignNotes-SettingsTab";
import "./window-type";

export default class CampaignNotesPlugin extends Plugin {
    settings: CampaignNotesSettings;
    index: CampaignNotesIndex;
    api: CampaignReferenceAPI;

    async onload() {
        console.log("Loading Campaign Notes plugin");

        await this.loadSettings();

        // Initialize the index
        this.index = new CampaignNotesIndex(this);

        // Initialize the API
        this.api = new CampaignReference(this, this.index);
        console.log("Campaign Notes API initialized", this.api);

        if (!window.campaignNotes) {
            window.campaignNotes = {};
        }
        window.campaignNotes.api = this.api;

        // Add settings tab
        this.addSettingTab(new CampaignNotesSettingsTab(this.app, this));

        // Add command to rebuild index
        this.addCommand({
            id: "rebuild-campaign-notes-index",
            name: "Rebuild Campaign Notes Index",
            callback: () => {
                this.index.rebuildIndex();
            },
        });

        // Start indexing when workspace is ready
        this.app.workspace.onLayoutReady(() => {
            // Expose the API to window for other plugins/scripts
            this.index.rebuildIndex();

            // Register for file events to keep index updated
            this.registerEvent(
                this.app.vault.on("create", (file) =>
                    this.index.handleFileCreated(file),
                ),
            );

            this.registerEvent(
                this.app.vault.on("modify", async (file) =>
                    this.onFileModified(file),
                ),
            );

            this.registerEvent(
                this.app.vault.on("delete", (file) =>
                    this.index.handleFileDeleted(file),
                ),
            );

            this.registerEvent(
                this.app.vault.on("rename", (file, oldPath) =>
                    this.index.handleFileRenamed(file, oldPath),
                ),
            );
        });
    }

    onFileModified = debounce(
        async (file: TAbstractFile) => {
            this.index.handleFileModified(file);
        },
        2000,
        true,
    );

    onunload() {
        console.log("Unloading Campaign Notes plugin");

        // Clear the API reference if it exists
        if (window.campaignNotes) {
            window.campaignNotes.api = undefined;
            console.log("Cleared campaignNotes.api reference");
        }
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );
        console.log("Campaign Notes settings", this.settings);
    }

    async saveSettings() {
        console.log("Saving Campaign Notes settings", this.settings);
        await this.saveData(this.settings);
    }
}

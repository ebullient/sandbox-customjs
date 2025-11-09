import { debounce, Plugin, type TAbstractFile } from "obsidian";
import type { CampaignNotesSettings } from "./@types/settings";
import { CampaignReference } from "./campaignnotes-Api";
import { CampaignNotesCache } from "./campaignnotes-Cache";
import { EntitySelectorService } from "./campaignnotes-EntitySelector";
import { CampaignNotesIndex, DEFAULT_SETTINGS } from "./campaignnotes-Index";
import { CampaignNotesSettingsTab } from "./campaignnotes-SettingsTab";
import { TableGenerationService } from "./campaignnotes-TableGeneration";

export class CampaignNotesPlugin extends Plugin {
    settings: CampaignNotesSettings;
    index: CampaignNotesIndex;
    cache: CampaignNotesCache;
    api: CampaignReference;
    tableService: TableGenerationService;
    entitySelector: EntitySelectorService;

    async onload(): Promise<void> {
        console.log("Loading Campaign Notes plugin");

        await this.loadSettings();

        // Initialize the index
        this.index = new CampaignNotesIndex(this);
        this.cache = new CampaignNotesCache(this.app, this.index);
        this.tableService = new TableGenerationService(
            this.app,
            this.index,
            this.cache,
        );
        this.entitySelector = new EntitySelectorService(this.app, this);

        // Initialize the API
        this.api = new CampaignReference(
            this,
            this.index,
            this.cache,
            this.entitySelector,
        );
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

        this.addCommand({
            id: "regenerate-index-tables",
            name: "Regenerate Index Tables",
            callback: async () => {
                // Then generate tables
                await this.tableService.generateTables();
            },
        });

        // Add commands for entity selection
        this.addCommand({
            id: "insert-entity-link",
            name: "Find Entity (open or link)",
            callback: () => {
                const editor = this.app.workspace.activeEditor?.editor ?? null;
                this.entitySelector.openEntitySelector(editor);
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
                this.app.vault.on(
                    "modify",
                    debounce(
                        async (file: TAbstractFile) => {
                            this.cache.removeAllLinks(file.path);
                            if (this.index.fileIncluded(file.path)) {
                                this.index.handleFileModified(file);
                                console.log("File modified:", file, this.index);
                            }
                        },
                        2000,
                        true,
                    ),
                ),
            );

            this.registerEvent(
                this.app.vault.on("delete", (file) => {
                    this.cache.removeAllLinks(file.path);
                    if (this.index.fileIncluded(file.path)) {
                        this.index.handleFileDeleted(file);
                        console.log("File deleted:", file, this.index);
                    }
                }),
            );

            this.registerEvent(
                this.app.vault.on("rename", (file, oldPath) => {
                    this.cache.removeAllLinks(oldPath);
                    if (this.index.fileIncluded(file.path)) {
                        this.index.handleFileRenamed(file, oldPath);
                        console.log("File renamed:", file, this.index);
                    }
                }),
            );
        });
    }

    onunload(): void {
        console.log("Unloading Campaign Notes plugin");
        this.cache.clearAll();
        this.index.clearIndex();

        // Clear the API reference if it exists
        if (window.campaignNotes) {
            window.campaignNotes.api = undefined;
            console.log("Cleared campaignNotes.api reference");
        }
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );
        console.log("Campaign Notes settings", this.settings);
    }

    async saveSettings(): Promise<void> {
        console.log("Saving Campaign Notes settings", this.settings);
        await this.saveData(this.settings);
    }
}

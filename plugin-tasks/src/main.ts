import { Notice, Plugin, type TAbstractFile, debounce } from "obsidian";
import type { ReviewItem, TaskIndexSettings } from "./@types";
import { FileUpdater } from "./FileUpdater";
import { QuestIndex } from "./QuestIndex";
import { ReviewDetector } from "./ReviewDetector";
import { ReviewModal } from "./ReviewModal";
import { DEFAULT_SETTINGS } from "./Settings";
import { TaskIndexSettingsTab } from "./SettingsTab";

export default class TaskIndexPlugin extends Plugin {
    settings: TaskIndexSettings;
    index: QuestIndex;
    detector: ReviewDetector;
    updater: FileUpdater;

    async onload() {
        console.log("Loading Task Index plugin");

        await this.loadSettings();

        // Initialize services
        this.index = new QuestIndex(this.app, this.settings);
        this.detector = new ReviewDetector(this.settings);
        this.updater = new FileUpdater(this.app);

        // Add settings tab
        this.addSettingTab(new TaskIndexSettingsTab(this.app, this));

        // Add commands
        this.addCommand({
            id: "rebuild-task-index",
            name: "Rebuild Task Index",
            callback: async () => {
                await this.index.rebuildIndex();
                new Notice("Task index rebuilt");
            },
        });

        this.addCommand({
            id: "what-needs-review",
            name: "What needs review?",
            callback: () => {
                this.showReviewList();
            },
        });

        this.addCommand({
            id: "plan-this-week",
            name: "Plan this week",
            callback: () => {
                this.showWeeklyPlanning();
            },
        });

        // Start indexing when workspace is ready
        this.app.workspace.onLayoutReady(() => {
            this.index.rebuildIndex();

            // Register file events
            this.registerEvent(
                this.app.vault.on("create", (file) => {
                    this.index.indexFile(file);
                }),
            );

            this.registerEvent(
                this.app.vault.on(
                    "modify",
                    debounce(
                        async (file: TAbstractFile) => {
                            await this.index.indexFile(file);
                        },
                        1000,
                        true,
                    ),
                ),
            );

            this.registerEvent(
                this.app.vault.on("delete", (file) => {
                    this.index.removeFile(file.path);
                }),
            );

            this.registerEvent(
                this.app.vault.on("rename", (file, oldPath) => {
                    this.index.removeFile(oldPath);
                    this.index.indexFile(file);
                }),
            );
        });
    }

    onunload() {
        console.log("Unloading Task Index plugin");
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Show the review list modal
     */
    private showReviewList() {
        const quests = this.index.getAllQuests();
        const reviewItems = this.detector.getReviewList(quests);

        if (reviewItems.length === 0) {
            new Notice("Nothing needs review - great job! 🎉");
            return;
        }

        new Notice(
            `${reviewItems.length} projects need review. Opening first one...`,
        );

        // Start review queue
        this.processReviewQueue(reviewItems, 0);
    }

    /**
     * Process the review queue, showing one item at a time
     */
    private processReviewQueue(
        reviewItems: ReviewItem[],
        currentIndex: number,
    ) {
        if (currentIndex >= reviewItems.length) {
            new Notice("All done with reviews! 🎉");
            return;
        }

        const remaining = reviewItems.length - currentIndex - 1;
        const quest = reviewItems[currentIndex].quest;

        const modal = new ReviewModal(
            this.app,
            quest,
            this.settings,
            async (updated) => {
                // Save changes
                await this.updater.updateQuestFile(updated);
                const file = this.app.vault.getFileByPath(updated.path);
                if (file) {
                    await this.index.indexFile(file);
                }
                new Notice("Quest updated");
            },
            () => {
                // Skip/Next callback - move to next item
                if (remaining > 0) {
                    new Notice(`${remaining} more projects to review`);
                    this.processReviewQueue(reviewItems, currentIndex + 1);
                } else {
                    new Notice("All done with reviews! 🎉");
                }
            },
        );
        modal.open();
    }

    /**
     * Show weekly planning view
     */
    private showWeeklyPlanning() {
        // TODO: Implement weekly planning modal
        const nextTasks = this.index.getTasksByTag("next");

        if (nextTasks.length === 0) {
            new Notice("No #next tasks found. Review your projects first!");
            return;
        }

        new Notice(
            `Found ${nextTasks.length} #next tasks. Weekly planning view coming soon...`,
        );

        // For now, just log them
        console.log("Next tasks:", nextTasks);
    }
}

import { debounce, Notice, Plugin, type TAbstractFile } from "obsidian";
import type { ReviewItem, TaskIndexSettings } from "./@types";
import { FileUpdater } from "./FileUpdater";
import { QuestIndex } from "./QuestIndex";
import { ReviewDetector } from "./ReviewDetector";
import { ReviewModal } from "./ReviewModal";
import { DEFAULT_SETTINGS } from "./Settings";
import { TaskIndexSettingsTab } from "./SettingsTab";
import { TaskIndexAPI } from "./TaskIndex-Api";
import { WeeklyPlanningModal } from "./WeeklyPlanningModal";

export default class TaskIndexPlugin extends Plugin {
    settings: TaskIndexSettings;
    index: QuestIndex;
    detector: ReviewDetector;
    updater: FileUpdater;
    api: TaskIndexAPI;

    async onload() {
        console.log("Loading Task Index plugin");

        await this.loadSettings();

        // Initialize services
        this.index = new QuestIndex(this.app, this.settings);
        this.detector = new ReviewDetector(this.app, this.settings);
        this.updater = new FileUpdater(this.app);
        this.api = new TaskIndexAPI(this.index, this.settings);

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

            // Expose API to window for CustomJS scripts
            if (!window.taskIndex) {
                window.taskIndex = {};
            }
            window.taskIndex.api = this.api;
            console.log(window.taskIndex);

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
        window.taskIndex = {};
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
     * IMPORTANT: Review list is FROZEN at session start to prevent loops.
     * Items won't reappear even if they still need review after updates.
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

        // Start review queue with frozen list
        this.processReviewQueue(reviewItems, 0);
    }

    /**
     * Process the review queue, showing one item at a time
     *
     * Button behaviors:
     * - Save & Next: Saves changes, moves to next
     * - Skip: Just moves to next (marks as "reviewed" for this session)
     * - Defer: Pushes item to END of queue, moves to next (try again later)
     * - Cancel: Exits review session entirely
     */
    private processReviewQueue(
        reviewItems: ReviewItem[],
        currentIndex: number,
    ) {
        if (currentIndex >= reviewItems.length) {
            new Notice("All done with reviews! 🎉");
            return;
        }

        const totalItems = reviewItems.length;
        const reviewItem = reviewItems[currentIndex];
        const quest = reviewItem.quest;

        const modal = new ReviewModal(
            this.app,
            quest,
            this.settings,
            async (updated) => {
                // onSave: Save changes to file and re-index
                await this.updater.updateQuestFile(updated);
                const file = this.app.vault.getFileByPath(updated.path);
                if (file) {
                    await this.index.indexFile(file);
                }
                new Notice("Quest updated");
            },
            this.detector,
            () => {
                // onNext (Skip button): Move to next item without saving
                // This item won't come back in this review session
                this.processReviewQueue(reviewItems, currentIndex + 1);
            },
            () => {
                // onDefer (Defer button): Not ready to decide now
                // Push current item to END of queue and move forward
                // You'll see it again after reviewing everything else
                reviewItems.push(reviewItems[currentIndex]);
                this.processReviewQueue(reviewItems, currentIndex + 1);
            },
            currentIndex + 1,
            totalItems,
            reviewItem.reasons,
        );
        modal.open();
    }

    /**
     * Show weekly planning view
     */
    private showWeeklyPlanning() {
        // Get all quests that have actionable tasks (#next OR due dates)
        const allQuests = this.index.getAllQuests();
        const actionableQuests = allQuests.filter(
            (q) => q.hasNextTasks || q.hasOverdueTasks,
        );

        if (actionableQuests.length === 0) {
            new Notice(
                "No quests with actionable tasks (#next or due dates) found. Review your projects first!",
            );
            return;
        }

        const modal = new WeeklyPlanningModal(
            this.app,
            actionableQuests,
            this.settings,
        );
        modal.open();
    }
}

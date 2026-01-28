import {
    debounce,
    MarkdownView,
    Notice,
    Plugin,
    type TAbstractFile,
    type TFile,
} from "obsidian";
import type { CurrentSettings, ReviewItem, TaskIndexSettings } from "./@types";
import { AllTasksCommand } from "./commands/taskindex-AllTasksCommand";
import { ConversationCommand } from "./commands/taskindex-ConversationCommand";
import { PushTextCommand } from "./commands/taskindex-PushTextCommand";
import { TaskIndexAPI } from "./taskindex-Api";
import { DatedFileModal } from "./taskindex-DatedFileModal";
import { FileUpdater } from "./taskindex-FileUpdater";
import { LastModifiedTracker } from "./taskindex-LastModifiedTracker";
import { PeriodicFinalizer } from "./taskindex-PeriodicFinalizer";
import { QuestIndex } from "./taskindex-QuestIndex";
import { ReviewDetector } from "./taskindex-ReviewDetector";
import { ReviewModal } from "./taskindex-ReviewModal";
import { DEFAULT_SETTINGS } from "./taskindex-Settings";
import { TaskIndexSettingsTab } from "./taskindex-SettingsTab";
import { TaskArchiver } from "./taskindex-TaskArchiver";
import { TaskEngine } from "./taskindex-TaskEngine";
import { WeeklyPlanningModal } from "./taskindex-WeeklyPlanningModal";

export class TaskIndexPlugin extends Plugin implements CurrentSettings {
    settings: TaskIndexSettings;
    index: QuestIndex;
    detector: ReviewDetector;
    updater: FileUpdater;
    taskEngine: TaskEngine;
    lastModifiedTracker: LastModifiedTracker;
    api: TaskIndexAPI;

    current(): TaskIndexSettings {
        return this.settings;
    }

    /**
     * Check if a file should be indexed (quest/area file)
     */
    shouldIndexFile(file: TFile): boolean {
        if (file.extension !== "md") {
            return false;
        }
        return this.settings.questFolders.some((folder) =>
            file.path.startsWith(folder),
        );
    }

    async onload(): Promise<void> {
        console.log("Loading Task Index plugin");

        await this.loadSettings();

        // Initialize stateful services
        this.index = new QuestIndex(this.app, this);
        this.detector = new ReviewDetector(this.app, this);
        this.updater = new FileUpdater(this.app);
        this.taskEngine = new TaskEngine(this.app);
        this.lastModifiedTracker = new LastModifiedTracker(this.app, this);

        // Initialize API with TaskEngine and expose to window
        this.api = new TaskIndexAPI(this.index, this, this.taskEngine);

        if (!window.taskIndex) {
            window.taskIndex = {};
        }
        window.taskIndex.api = this.api;

        // Add settings tab
        this.addSettingTab(new TaskIndexSettingsTab(this.app, this));

        // Add commands
        this.addCommand({
            id: "rebuild-task-index",
            name: "(TI) Rebuild Task Index",
            callback: async () => {
                await this.index.rebuildIndex();
                new Notice("Task index rebuilt");
            },
        });

        this.addCommand({
            id: "what-needs-review",
            name: "(TI) What needs review?",
            callback: () => {
                this.showReviewList();
            },
        });

        this.addCommand({
            id: "plan-this-week",
            name: "(TI) Plan this week",
            callback: () => {
                this.showWeeklyPlanning();
            },
        });

        this.addCommand({
            id: "finalize-periodic-file",
            name: "(TI) Finalize daily/weekly note",
            callback: async () => {
                const finalizer = new PeriodicFinalizer(
                    this.app,
                    this.taskEngine,
                );
                await finalizer.finalizeActiveFile();
                new Notice("Periodic file finalized");
            },
        });

        this.addCommand({
            id: "generate-all-tasks",
            name: "(TI) Generate all-tasks.md",
            callback: async () => {
                const command = new AllTasksCommand(this.app, this.taskEngine);
                await command.execute();
            },
        });

        this.addCommand({
            id: "archive-quest-logs",
            name: "(TI) Archive old quest/area logs",
            callback: async () => {
                new Notice("Archiving old completed tasks...");
                const archiver = new TaskArchiver(
                    this.app,
                    this.settings.minArchiveLines,
                );
                await archiver.cleanupAllQuests();
                new Notice("Quest archival complete");
            },
        });

        this.addCommand({
            id: "validate-quest-logs",
            name: "(TI) Validate quest/area logs",
            callback: async () => {
                new Notice("Validating log sections...");
                const archiver = new TaskArchiver(
                    this.app,
                    this.settings.minArchiveLines,
                );
                await archiver.validateAllQuests();
                new Notice("Log validation complete - see console for issues");
            },
        });

        this.addCommand({
            id: "open-dated-file",
            name: "(TI) Open Dated File",
            callback: () => {
                new DatedFileModal(this).open();
            },
        });

        this.addCommand({
            id: "open-journal",
            name: "(TI) Open Journal",
            callback: () => this.openTodayJournal(),
        });

        this.addCommand({
            id: "create-conversation-entry",
            name: "(TI) Create conversation entry",
            callback: async () => {
                const command = new ConversationCommand(this.app);
                await command.execute();
            },
        });

        this.addCommand({
            id: "push-text",
            name: "(TI) Push text to file",
            callback: async () => {
                const command = new PushTextCommand(this.app);
                await command.execute();
            },
        });

        // Start indexing when workspace is ready
        this.app.workspace.onLayoutReady(() => {
            this.index.rebuildIndex();

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

            // Track editor changes for last_modified updates
            this.registerEvent(
                this.app.workspace.on("editor-change", (_editor, info) => {
                    const file = info.file;
                    if (file) {
                        this.lastModifiedTracker.onEditorChange(file);
                    }
                }),
            );
        });
    }

    onunload(): void {
        console.log("Unloading Task Index plugin");
        window.taskIndex = {};
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    onExternalSettingsChange = debounce(
        async () => {
            console.debug("(TI) external settings changed");
            const incoming = await this.loadData();
            console.debug(
                "(TI) external settings changed",
                this.settings,
                incoming,
            );
            this.settings = Object.assign({}, this.settings, incoming);
            await this.saveSettings();
        },
        2000,
        true,
    );

    /**
     * Show the review list modal
     * IMPORTANT: Review list is FROZEN at session start to prevent loops.
     * Items won't reappear even if they still need review after updates.
     */
    private showReviewList(): void {
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
    ): void {
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
            this,
            async (updated) => {
                await this.updater.updateQuestFile(updated);
                const file = this.app.vault.getFileByPath(updated.path);
                if (file) {
                    await this.index.indexFile(file);
                }
                new Notice("Quest updated");
            },
            this.detector,
            () => {
                this.processReviewQueue(reviewItems, currentIndex + 1);
            },
            () => {
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
     * Open today's journal file, creating it if needed.
     * Reuses existing leaf if already open, positions cursor at end.
     */
    private async openTodayJournal(): Promise<void> {
        const today = window.moment();
        const journalPath = today.format(this.settings.journalFormat);

        // Check if already open in a markdown leaf
        const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
        let found = false;
        for (const leaf of markdownLeaves) {
            const viewState = leaf.getViewState();
            if (viewState.state?.file === journalPath) {
                this.app.workspace.setActiveLeaf(leaf, { focus: true });
                found = true;
                break;
            }
        }

        if (!found) {
            // Create if doesn't exist
            let journalFile = this.app.vault.getAbstractFileByPath(journalPath);
            if (!journalFile) {
                journalFile = await this.app.vault.create(journalPath, "");
            }

            // Open in new leaf in source mode
            await this.app.workspace.openLinkText(journalPath, "", true, {
                state: { mode: "source" },
            });
        }

        // Position cursor at end of file
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.editor) {
            const lastLine = view.editor.lastLine();
            view.editor.setCursor(lastLine);
        }
    }

    private showWeeklyPlanning(): void {
        const allQuests = this.index.getAllQuests();
        const actionableQuests = allQuests.filter(
            (q) => q.hasNextTasks || q.hasOverdueTasks || q.hasCompletedTasks,
        );

        if (actionableQuests.length === 0) {
            new Notice(
                "No quests with actionable tasks (#next, due dates, or completed tasks) found. Review your projects first!",
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

import { type App, Modal, Setting } from "obsidian";
import type { QuestFile, Task, TaskIndexSettings } from "./@types";
import * as TaskParser from "./taskindex-TaskParser";

/**
 * Simple modal showing all quests with actionable tasks (#next or due dates)
 * Provides sphere filtering and links to jump to quest files for planning
 */
export class WeeklyPlanningModal extends Modal {
    private allQuests: QuestFile[];
    private settings: TaskIndexSettings;
    private selectedSphere = "all";
    private filteredQuests: QuestFile[] = [];

    constructor(app: App, quests: QuestFile[], settings: TaskIndexSettings) {
        super(app);
        this.allQuests = quests;
        this.settings = settings;
        this.filteredQuests = quests;
        this.containerEl.id = "weekly-planning-modal";
    }

    onOpen() {
        this.render();
    }

    private render() {
        const { contentEl } = this;
        contentEl.empty();

        // Title
        contentEl.createEl("h2", { text: "Weekly Planning" });

        if (this.allQuests.length === 0) {
            contentEl.createDiv({
                text: "No quests with actionable tasks (#next, due dates, or completed tasks) found. Review your projects first!",
            });
            return;
        }

        // Sphere filter
        this.renderSphereFilter(contentEl);

        // Apply filter
        this.applyFilter();

        if (this.filteredQuests.length === 0) {
            contentEl.createDiv({
                text: "No quests match the selected sphere filter.",
            });
            return;
        }

        // Summary count
        this.renderSummary(contentEl);

        // Group by sphere
        const bySphere = this.groupBySphere(this.filteredQuests);

        // Render each sphere group
        for (const [sphere, questList] of Object.entries(bySphere)) {
            this.renderSphereGroup(contentEl, sphere, questList);
        }

        // Close button
        const buttonSection = contentEl.createDiv({ cls: "button-section" });
        const closeBtn = buttonSection.createEl("button", {
            text: "Close",
            cls: "mod-cta",
        });
        closeBtn.addEventListener("click", () => {
            this.close();
        });
    }

    private renderSphereFilter(container: HTMLElement) {
        const filterSection = container.createDiv({
            cls: "sphere-filter-section",
        });

        new Setting(filterSection)
            .setName("Filter by sphere")
            .setDesc("Show only quests from a specific sphere")
            .addDropdown((dropdown) => {
                dropdown.addOption("all", "All spheres");

                // Add configured spheres
                for (const sphere of this.settings.validSpheres) {
                    dropdown.addOption(sphere, sphere);
                }

                // Add "(no sphere)" if any quests lack a sphere
                if (this.allQuests.some((q) => !q.sphere)) {
                    dropdown.addOption("none", "(no sphere)");
                }

                dropdown.setValue(this.selectedSphere);
                dropdown.onChange((value) => {
                    this.selectedSphere = value;
                    this.render(); // Re-render with new filter
                });
            });
    }

    private applyFilter() {
        if (this.selectedSphere === "all") {
            this.filteredQuests = this.allQuests;
        } else if (this.selectedSphere === "none") {
            this.filteredQuests = this.allQuests.filter((q) => !q.sphere);
        } else {
            this.filteredQuests = this.allQuests.filter(
                (q) => q.sphere === this.selectedSphere,
            );
        }
    }

    private renderSummary(container: HTMLElement) {
        const summary = container.createDiv({ cls: "planning-summary" });

        let totalNextTasks = 0;
        let totalDueTasks = 0;
        let totalCompletedTasks = 0;

        for (const quest of this.filteredQuests) {
            for (const task of quest.tasks) {
                if (task.tags.includes("next")) {
                    totalNextTasks++;
                }
                if (TaskParser.isOverdueOrDueToday(task)) {
                    totalDueTasks++;
                }
                if (task.status === "x" || task.status === "-") {
                    totalCompletedTasks++;
                }
            }
        }

        const parts: string[] = [];
        if (totalNextTasks > 0) {
            parts.push(
                `${totalNextTasks} #next task${totalNextTasks !== 1 ? "s" : ""}`,
            );
        }
        if (totalDueTasks > 0) {
            parts.push(
                `${totalDueTasks} due task${totalDueTasks !== 1 ? "s" : ""}`,
            );
        }
        if (totalCompletedTasks > 0) {
            parts.push(
                `${totalCompletedTasks} completed task${totalCompletedTasks !== 1 ? "s" : ""}`,
            );
        }

        const summaryText = `Found ${parts.join(", ")} across ${this.filteredQuests.length} quest${this.filteredQuests.length !== 1 ? "s" : ""}`;
        summary.createEl("p", { text: summaryText });
    }

    private groupBySphere(quests: QuestFile[]): Record<string, QuestFile[]> {
        const groups: Record<string, QuestFile[]> = {};

        for (const quest of quests) {
            const sphere = quest.sphere || "(no sphere)";
            if (!groups[sphere]) {
                groups[sphere] = [];
            }
            groups[sphere].push(quest);
        }

        // Sort within each group by title
        for (const sphere of Object.keys(groups)) {
            groups[sphere].sort((a, b) => a.title.localeCompare(b.title));
        }

        return groups;
    }

    private renderSphereGroup(
        container: HTMLElement,
        sphere: string,
        quests: QuestFile[],
    ) {
        const section = container.createDiv({ cls: "sphere-group" });

        // Sphere heading
        section.createEl("h3", { text: `${sphere} (${quests.length})` });

        // Quest list
        const list = section.createEl("ul", { cls: "quest-list" });

        for (const quest of quests) {
            this.renderQuest(list, quest);
        }
    }

    private renderQuest(container: HTMLElement, quest: QuestFile) {
        const item = container.createEl("li", { cls: "quest-item" });

        // Quest title as link to ## Tasks section
        const link = item.createEl("a", {
            cls: "internal-link quest-link",
            href: `${quest.path}#Tasks`,
        });
        link.createEl("strong", { text: quest.title });

        // Add cleanup indicator if quest has completed tasks
        if (quest.hasCompletedTasks) {
            item.createSpan({
                text: " 🌪️",
                cls: "cleanup-indicator",
            });
        }

        // Make the link clickable
        link.addEventListener("click", (e) => {
            e.preventDefault();
            // Open the file in a new leaf in the background
            this.app.workspace.openLinkText(
                `${quest.path}#Tasks`,
                "",
                true, // newLeaf
                { active: false }, // Open in background
            );
        });

        // Actionable tasks (#next OR due dates)
        const actionableTasks = this.getActionableTasks(quest);
        if (actionableTasks.length > 0) {
            const taskList = item.createEl("ul", { cls: "actionable-tasks" });

            for (const { task, reason } of actionableTasks) {
                const taskItem = taskList.createEl("li");

                // Show the task text
                const taskSpan = taskItem.createSpan({ text: task.text });

                // Add indicator for why it's actionable
                if (reason === "due") {
                    taskSpan.addClass("task-due");
                    taskItem.createSpan({
                        text: ` {${task.dueDate}}`,
                        cls: "task-due-date",
                    });
                } else if (reason === "next") {
                    taskSpan.addClass("task-next");
                }
            }
        }
    }

    private getActionableTasks(
        quest: QuestFile,
    ): Array<{ task: Task; reason: "next" | "due" | "both" }> {
        const results: Array<{ task: Task; reason: "next" | "due" | "both" }> =
            [];

        for (const task of quest.tasks) {
            const isNext = task.tags.includes("next");
            const isDue = TaskParser.isOverdueOrDueToday(task);

            if (isNext && isDue) {
                results.push({ task, reason: "both" });
            } else if (isDue) {
                results.push({ task, reason: "due" });
            } else if (isNext) {
                results.push({ task, reason: "next" });
            }
        }

        return results;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

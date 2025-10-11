import { type App, Modal, Setting } from "obsidian";
import type {
    QuestFile,
    Task,
    TaskAction,
    TaskIndexSettings,
    TaskTag,
} from "./@types";
import { TaskParser } from "./TaskParser";

/**
 * Modal for reviewing a single quest/area
 */
export class ReviewModal extends Modal {
    private quest: QuestFile;
    private settings: TaskIndexSettings;
    private onSave: (updated: QuestFile) => Promise<void>;
    private onSkip?: () => void;

    // Form state
    private selectedSphere?: string;
    private purposeText: string;
    private taskEdits = new Map<
        number,
        { tag?: TaskTag | null; dueDate?: string | null; status?: string }
    >();

    // Edit mode state
    private isEditMode = false;
    private rawTaskMarkdown = "";
    private editedTasks: Task[] = [];
    private allTaskLines: string[] = []; // All lines from task section (preserves formatting)

    constructor(
        app: App,
        quest: QuestFile,
        settings: TaskIndexSettings,
        onSave: (updated: QuestFile) => Promise<void>,
        onSkip?: () => void,
    ) {
        super(app);
        this.quest = quest;
        this.settings = settings;
        this.onSave = onSave;
        this.onSkip = onSkip;

        this.selectedSphere = quest.sphere;
        this.purposeText = quest.purpose;

        // Use the raw task content which preserves ALL formatting
        this.rawTaskMarkdown = quest.rawTaskContent;
        this.allTaskLines = quest.rawTaskContent.split("\n");
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("task-review-modal");

        // Title
        contentEl.createEl("h2", { text: `Review: ${this.quest.title}` });

        // Sphere selection
        this.renderSphereSection(contentEl);

        // Purpose section
        this.renderPurposeSection(contentEl);

        // Tasks section
        this.renderTasksSection(contentEl);

        // Buttons
        this.renderButtons(contentEl);
    }

    private renderSphereSection(container: HTMLElement) {
        const section = container.createDiv({ cls: "review-section" });
        section.createEl("h3", { text: "Sphere" });

        new Setting(section)
            .setName("Project sphere")
            .setDesc(
                !this.quest.sphere
                    ? "⚠️ This project needs a sphere assigned"
                    : "Which area of life does this belong to?",
            )
            .addDropdown((dropdown) => {
                // Add empty option if no sphere
                if (!this.quest.sphere) {
                    dropdown.addOption("", "-- Select sphere --");
                }

                // Add all valid spheres
                for (const sphere of this.settings.validSpheres) {
                    dropdown.addOption(sphere, sphere);
                }

                dropdown.setValue(this.selectedSphere || "");
                dropdown.onChange((value) => {
                    this.selectedSphere = value || undefined;
                });
            });
    }

    private renderPurposeSection(container: HTMLElement) {
        const section = container.createDiv({ cls: "review-section" });
        section.createEl("h3", { text: "Why this matters" });

        const textArea = section.createEl("textarea", {
            cls: "purpose-textarea",
            attr: {
                rows: "8",
                placeholder: "What is this project about? Why does it matter?",
            },
        });
        textArea.value = this.purposeText;
        textArea.addEventListener("input", () => {
            this.purposeText = textArea.value;
        });

        // Tag picker
        if (this.settings.purposeTags.length > 0) {
            const tagPicker = section.createDiv({ cls: "purpose-tag-picker" });
            tagPicker.createEl("span", {
                text: "Insert tag:",
                cls: "tag-picker-label",
            });

            const tagSelect = tagPicker.createEl("select", {
                cls: "tag-picker-select",
            });

            // Add default option
            tagSelect.createEl("option", {
                value: "",
                text: "-- Select tag --",
            });

            // Add all configured tags
            for (const tag of this.settings.purposeTags) {
                tagSelect.createEl("option", {
                    value: tag,
                    text: tag,
                });
            }

            tagSelect.addEventListener("change", () => {
                const selectedTag = tagSelect.value;
                if (selectedTag) {
                    this.insertTagAtCursor(textArea, selectedTag);
                    // Reset dropdown to default
                    tagSelect.value = "";
                }
            });
        }
    }

    private insertTagAtCursor(textArea: HTMLTextAreaElement, tag: string) {
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        const text = textArea.value;

        // Insert tag at cursor position (or replace selection)
        const before = text.substring(0, start);
        const after = text.substring(end);

        // Add space before tag if needed (and not at start of text)
        const needsSpaceBefore = before.length > 0 && !before.endsWith(" ");
        const tagToInsert = (needsSpaceBefore ? " " : "") + tag;

        const newText = before + tagToInsert + after;
        textArea.value = newText;

        // Update the purposeText state
        this.purposeText = newText;

        // Move cursor to after the inserted tag
        const newCursorPos = start + tagToInsert.length;
        textArea.setSelectionRange(newCursorPos, newCursorPos);

        // Focus back on the textarea
        textArea.focus();
    }

    private renderTasksSection(container: HTMLElement) {
        const section = container.createDiv({ cls: "review-section" });

        // Header with Edit button
        const header = section.createDiv({ cls: "task-section-header" });
        header.createEl("h3", { text: "Tasks" });

        const editBtn = header.createEl("button", {
            text: this.isEditMode ? "Done editing" : "Edit tasks",
            cls: "task-edit-toggle",
        });
        editBtn.addEventListener("click", () => {
            this.toggleEditMode();
        });

        if (this.isEditMode) {
            this.renderTaskEditor(section);
        } else {
            this.renderTaskList(section);
        }
    }

    private renderTaskList(container: HTMLElement) {
        const tasks =
            this.editedTasks.length > 0 ? this.editedTasks : this.quest.tasks;

        if (tasks.length === 0) {
            container.createEl("p", {
                text: "No tasks in this project",
                cls: "task-empty",
            });
            return;
        }

        const taskList = container.createDiv({ cls: "task-list" });

        for (const task of tasks) {
            this.renderTask(taskList, task);
        }
    }

    private renderTaskEditor(container: HTMLElement) {
        const textArea = container.createEl("textarea", {
            cls: "task-editor",
            attr: {
                rows: "15",
                placeholder: "Edit tasks in markdown format...",
            },
        });
        textArea.value = this.rawTaskMarkdown;
        textArea.addEventListener("input", () => {
            this.rawTaskMarkdown = textArea.value;
        });
    }

    private toggleEditMode() {
        this.isEditMode = !this.isEditMode;

        if (!this.isEditMode) {
            // Exiting edit mode - parse the markdown and clear pending actions
            this.parseEditedTasks();
            this.taskEdits.clear();
        } else {
            // Entering edit mode - apply pending edits to current lines
            this.applyPendingEditsToLines();

            // Update markdown from all lines (tasks + formatting)
            this.rawTaskMarkdown = this.allTaskLines.join("\n");

            // Clear pending edits since they're now in the markdown
            this.taskEdits.clear();
        }

        // Re-render the modal
        this.onOpen();
    }

    private applyPendingEditsToLines() {
        if (this.taskEdits.size === 0) {
            return;
        }

        // Get current tasks to edit
        const currentTasks =
            this.editedTasks.length > 0 ? this.editedTasks : this.quest.tasks;

        // Apply edits to tasks and update the corresponding lines
        for (const task of currentTasks) {
            const edit = this.taskEdits.get(task.lineNumber);
            if (!edit) {
                continue;
            }

            // Create updated task
            const updatedTask = { ...task };

            if (edit.status !== undefined) {
                updatedTask.status = edit.status as typeof task.status;
            }

            if (edit.tag !== undefined) {
                if (edit.tag === null) {
                    updatedTask.tags = [];
                } else {
                    updatedTask.tags = [edit.tag];
                }
            }

            if (edit.dueDate !== undefined) {
                updatedTask.dueDate = edit.dueDate || undefined;
            }

            // Rebuild the line and update in allTaskLines
            const newLine = this.rebuildTaskLine(updatedTask);
            this.allTaskLines[task.lineNumber] = newLine;
        }
    }

    private rebuildTaskLine(task: Task): string {
        const indent = " ".repeat(task.indent);
        const checkbox = `[${task.status}]`;

        // Strip existing GTD tags from text (they'll be re-added based on task.tags)
        const cleanText = task.text
            .replace(/#(next|waiting|someday)/g, "")
            .trim();

        // Build the line
        let line = `${indent}- ${checkbox} ${cleanText}`;

        // Add tags from task.tags array
        for (const tag of task.tags) {
            line += ` #${tag}`;
        }

        // Note: Due date handling is simplified - the text might already contain it
        // If we need to update due dates, we'd need to strip and re-add them too

        return line;
    }

    private parseEditedTasks() {
        const lines = this.rawTaskMarkdown.split("\n");
        this.editedTasks = [];
        this.allTaskLines = lines; // Preserve ALL lines

        // Parse tasks from the lines, but keep ALL lines (tasks and non-tasks)
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const task = TaskParser.parseTask(line, i);
            if (task) {
                this.editedTasks.push(task);
            }
        }
    }

    private renderTask(container: HTMLElement, task: Task) {
        const taskRow = container.createDiv({ cls: "task-row" });

        // Task checkbox and text
        const taskText = taskRow.createDiv({ cls: "task-text" });
        const currentEdit = this.taskEdits.get(task.lineNumber);
        const effectiveStatus = currentEdit?.status || task.status;

        taskText.createEl("span", {
            text: `[${effectiveStatus}] ${task.text}`,
            cls: "task-content",
        });

        // Action dropdown
        const actionSelect = taskRow.createEl("select", {
            cls: "task-action-select",
        });

        // Determine current action based on task state
        const effectiveTag =
            currentEdit?.tag !== undefined
                ? currentEdit.tag
                : task.tags[0] || null;

        const actionOptions: Array<{ value: string; label: string }> = [
            { value: "", label: "-- Action --" },
            { value: "next", label: "Mark #next" },
            { value: "waiting", label: "Mark #waiting" },
            { value: "someday", label: "Mark #someday" },
            { value: "complete", label: "Mark complete" },
            { value: "cancel", label: "Cancel task" },
            { value: "clear", label: "Clear tags" },
        ];

        for (const option of actionOptions) {
            const optionEl = actionSelect.createEl("option", {
                value: option.value,
                text: option.label,
            });

            // Pre-select current tag if it matches
            if (option.value === effectiveTag) {
                optionEl.selected = true;
            }
        }

        actionSelect.addEventListener("change", () => {
            const action = actionSelect.value as TaskAction | "clear" | "";
            if (action) {
                this.applyTaskAction(task, action);
                this.refreshTaskRow(taskRow, task);
            }
        });

        // Due date display (if exists)
        if (task.dueDate || currentEdit?.dueDate) {
            const dueDateSpan = taskRow.createDiv({ cls: "task-due-date" });
            const effectiveDueDate = currentEdit?.dueDate || task.dueDate;
            dueDateSpan.createEl("span", {
                text: `Due: ${effectiveDueDate}`,
            });
        }
    }

    private refreshTaskRow(taskRow: HTMLElement, task: Task) {
        // Simple refresh: clear and re-render the task row contents
        taskRow.empty();

        const parent = taskRow.parentElement;
        if (parent) {
            this.renderTask(parent, task);
            // Remove the old taskRow since renderTask creates a new one
            taskRow.remove();
        }
    }

    private applyTaskAction(task: Task, action: TaskAction | "clear" | "") {
        if (!action) {
            return;
        }

        const edit = this.taskEdits.get(task.lineNumber) || {};

        if (action === "complete") {
            edit.status = "x";
            edit.tag = undefined;
        } else if (action === "cancel") {
            edit.status = "-";
            edit.tag = undefined;
        } else if (action === "clear") {
            edit.tag = null;
        } else {
            // next, waiting, someday
            edit.tag = action as TaskTag;
        }

        this.taskEdits.set(task.lineNumber, edit);
    }

    private renderButtons(container: HTMLElement) {
        const buttonRow = container.createDiv({ cls: "modal-button-row" });

        // Cancel button (left side)
        const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => {
            this.close();
        });

        // Spacer to push remaining buttons to the right
        buttonRow.createDiv({ cls: "modal-button-spacer" });

        // Skip button - moves to next without saving
        const skipBtn = buttonRow.createEl("button", { text: "Skip" });
        skipBtn.addEventListener("click", () => {
            this.close();
            if (this.onSkip) {
                this.onSkip();
            }
        });

        // Save & Next button - saves changes and moves to next
        const saveBtn = buttonRow.createEl("button", {
            text: "Save & Next",
            cls: "mod-cta",
        });
        saveBtn.addEventListener("click", async () => {
            await this.saveChanges();
            this.close();
            if (this.onSkip) {
                this.onSkip();
            }
        });
    }

    private async saveChanges() {
        // Get current tasks (edited or original)
        const currentTasks = this.editedTasks.length > 0
            ? this.editedTasks
            : this.quest.tasks;

        // Apply any pending dropdown edits to tasks
        const updatedTasks = currentTasks.map((task) => {
            const edit = this.taskEdits.get(task.lineNumber);
            if (!edit) {
                return task;
            }

            const updatedTask = { ...task };

            // Update status (for complete/cancel)
            if (edit.status !== undefined) {
                updatedTask.status = edit.status as typeof task.status;
            }

            // Update tags
            if (edit.tag !== undefined) {
                if (edit.tag === null) {
                    updatedTask.tags = [];
                } else {
                    updatedTask.tags = [edit.tag];
                }
            }

            // Update due date
            if (edit.dueDate !== undefined) {
                updatedTask.dueDate = edit.dueDate || undefined;
            }

            // Rebuild the line to reflect changes
            updatedTask.line = this.rebuildTaskLine(updatedTask);

            return updatedTask;
        });

        // Build updated quest object
        const updated: QuestFile = {
            ...this.quest,
            sphere: this.selectedSphere,
            purpose: this.purposeText,
            tasks: updatedTasks,
        };

        // Callback to save
        await this.onSave(updated);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

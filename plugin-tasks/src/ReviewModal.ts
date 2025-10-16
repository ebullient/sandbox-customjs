import { type App, Modal, Setting } from "obsidian";
import type { QuestFile, ReviewReason, TaskIndexSettings } from "./@types";
import type { ReviewDetector } from "./ReviewDetector";

/**
 * Modal for reviewing a single quest/area
 * Simplified to use raw markdown editing only
 */
export class ReviewModal extends Modal {
    private quest: QuestFile;
    private settings: TaskIndexSettings;
    private onSave: (updated: QuestFile) => Promise<void>;
    private onNext?: () => void;
    private onDefer?: () => void;

    // Progress tracking
    private currentItem: number;
    private totalItems: number;
    private reviewReasons: ReviewReason[];
    private reviewDetector: ReviewDetector;

    // Form state - just the editable fields
    private selectedSphere?: string;
    private purposeText: string;
    private taskMarkdown: string;
    private taskTextArea?: HTMLTextAreaElement;

    constructor(
        app: App,
        quest: QuestFile,
        settings: TaskIndexSettings,
        onSave: (updated: QuestFile) => Promise<void>,
        reviewDetector: ReviewDetector,
        onNext?: () => void,
        onDefer?: () => void,
        currentItem = 1,
        totalItems = 1,
        reviewReasons: ReviewReason[] = [],
    ) {
        super(app);
        this.quest = quest;
        this.settings = settings;
        this.onSave = onSave;
        this.onNext = onNext;
        this.onDefer = onDefer;
        this.currentItem = currentItem;
        this.totalItems = totalItems;
        this.reviewReasons = reviewReasons;
        this.reviewDetector = reviewDetector;

        // Initialize form state from quest
        this.selectedSphere = quest.sphere;
        this.purposeText = quest.purpose;
        this.taskMarkdown = quest.rawTaskContent;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("task-review-modal");

        // Progress indicator
        const progressEl = contentEl.createDiv({ cls: "review-progress" });
        progressEl.createSpan({
            text: `Reviewing ${this.currentItem} of ${this.totalItems}`,
            cls: "review-progress-text",
        });
        const percentage = Math.round(((this.currentItem - 1) / this.totalItems) * 100);
        progressEl.createDiv({
            text: `${percentage}% complete`,
            cls: "review-progress-percent",
        });

        // Title
        contentEl.createEl("h2", { text: `Review: ${this.quest.title}` });

        // Review reasons - Why does this need attention?
        if (this.reviewReasons.length > 0) {
            this.renderReviewReasons(contentEl);
        }

        // Sphere selection
        this.renderSphereSection(contentEl);

        // Purpose section
        this.renderPurposeSection(contentEl);

        // Tasks section (raw markdown only)
        this.renderTasksSection(contentEl);

        // Buttons
        this.renderButtons(contentEl);
    }

    private renderReviewReasons(container: HTMLElement) {
        const reasonsSection = container.createDiv({ cls: "review-reasons" });
        reasonsSection.createEl("h3", { text: "⚠️ Needs Attention:" });

        const list = reasonsSection.createEl("ul");
        for (const reason of this.reviewReasons) {
            list.createEl("li", { text: this.reviewDetector.getReasonDescription(reason) });
        }
    }

    private renderSphereSection(container: HTMLElement) {
        const section = container.createDiv({ cls: "sphere-section" });
        section.createEl("h3", { text: "Sphere" });

        new Setting(section)
            .setName("Life sphere")
            .setDesc("Which area of life does this belong to?")
            .addDropdown((dropdown) => {
                // Add empty option
                dropdown.addOption("", "(none)");

                // Add configured spheres
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
        const section = container.createDiv({ cls: "purpose-section" });

        const header = section.createDiv({ cls: "purpose-header" });
        header.createEl("h3", { text: "Purpose" });

        // Tag insertion dropdown for purpose
        this.createTagDropdown(header, (tag) => {
            const textArea = section.querySelector("textarea") as HTMLTextAreaElement;
            if (textArea) {
                this.insertTag(textArea, tag);
            }
        });

        const textArea = section.createEl("textarea", {
            cls: "purpose-editor",
            attr: { rows: "8" },
        });
        textArea.value = this.purposeText;
        textArea.addEventListener("input", () => {
            this.purposeText = textArea.value;
        });
    }

    private renderTasksSection(container: HTMLElement) {
        const section = container.createDiv({ cls: "tasks-section" });

        const header = section.createDiv({ cls: "tasks-header" });
        header.createEl("h3", { text: "Tasks" });

        // Tag insertion dropdown for tasks
        this.createTagDropdown(header, (tag) => {
            if (this.taskTextArea) {
                this.insertTag(this.taskTextArea, tag);
            }
        });

        this.taskTextArea = section.createEl("textarea", {
            cls: "task-editor",
            attr: { rows: "15" },
        });
        this.taskTextArea.value = this.taskMarkdown;
        this.taskTextArea.addEventListener("input", () => {
            this.taskMarkdown = this.taskTextArea?.value || "";
        });
    }

    private createTagDropdown(container: HTMLElement, onSelect: (tag: string) => void) {
        const dropdown = container.createEl("select", { cls: "tag-dropdown" });

        // Placeholder option
        const placeholder = dropdown.createEl("option");
        placeholder.value = "";
        placeholder.text = "Insert tag...";
        placeholder.disabled = true;
        placeholder.selected = true;

        // Add GTD tags
        const gtdTags = ["#next", "#waiting", "#someday"];
        for (const tag of gtdTags) {
            const option = dropdown.createEl("option");
            option.value = tag;
            option.text = tag;
        }

        dropdown.addEventListener("change", () => {
            if (dropdown.value) {
                onSelect(dropdown.value);
                dropdown.value = ""; // Reset to placeholder
            }
        });
    }

    private insertTag(textArea: HTMLTextAreaElement, tag: string) {
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        const text = textArea.value;

        // Insert tag at cursor position (with space if needed)
        const before = text.substring(0, start);
        const after = text.substring(end);
        const needsSpaceBefore = before.length > 0 && !before.endsWith(" ");
        const insertion = (needsSpaceBefore ? " " : "") + tag;

        textArea.value = before + insertion + after;

        // Update the state
        if (textArea === this.taskTextArea) {
            this.taskMarkdown = textArea.value;
        } else {
            this.purposeText = textArea.value;
        }

        // Move cursor after inserted tag
        const newPos = start + insertion.length;
        textArea.setSelectionRange(newPos, newPos);
        textArea.focus();
    }

    private renderButtons(container: HTMLElement) {
        const buttonSection = container.createDiv({ cls: "button-section" });

        // Save & Next button
        const saveBtn = buttonSection.createEl("button", {
            text: "Save & Next",
            cls: "mod-cta",
        });
        saveBtn.addEventListener("click", async () => {
            await this.saveChanges();
            this.close();
            if (this.onNext) {
                this.onNext();
            }
        });

        // Skip button (if onNext exists)
        if (this.onNext) {
            const skipBtn = buttonSection.createEl("button", { text: "Skip" });
            skipBtn.addEventListener("click", () => {
                this.close();
                if (this.onNext) {
                    this.onNext();
                }
            });
        }

        // Defer button (if onDefer exists)
        if (this.onDefer) {
            const deferBtn = buttonSection.createEl("button", { text: "Defer" });
            deferBtn.addEventListener("click", () => {
                this.close();
                if (this.onDefer) {
                    this.onDefer();
                }
            });
        }

        // Cancel button
        const cancelBtn = buttonSection.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => {
            this.close();
        });
    }

    private async saveChanges() {
        console.log("[ReviewModal] saveChanges - simplified version");

        // Build updated quest object with edited fields
        const updated: QuestFile = {
            ...this.quest,
            sphere: this.selectedSphere,
            purpose: this.purposeText,
            rawTaskContent: this.taskMarkdown,
            // Note: tasks array will be reparsed by QuestIndex after save
            tasks: this.quest.tasks, // Keep original for now, will be reindexed
        };

        console.log("[ReviewModal] saving with rawTaskContent length:", this.taskMarkdown.length);
        await this.onSave(updated);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

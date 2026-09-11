import { type App, Modal, Setting, setIcon } from "obsidian";

/**
 * Modal presenting a checklist of addable daily tags (tags already present
 * in the note's tagline are expected to be filtered out by the caller).
 *
 * Matches Obsidian's settings-modal behavior: there are no OK/Cancel
 * buttons. Closing via background click or Esc submits the checked tags;
 * only the top-right X button cancels.
 */
export class TaglineModal extends Modal {
    private checked = new Set<string>();
    private cancelled = false;

    constructor(
        app: App,
        private tags: string[],
        private onSubmit: (result: Set<string> | null) => void,
    ) {
        super(app);
        this.containerEl.id = "tagline-modal";
    }

    onOpen() {
        const { contentEl } = this;

        const cancelBtn = this.titleEl.createEl("button", {
            cls: "clickable-icon tagline-cancel",
        });
        setIcon(cancelBtn, "x");
        cancelBtn.addEventListener("click", () => {
            this.cancelled = true;
            this.close();
        });

        contentEl.createEl("h2", { text: "Tagline" });

        for (const tag of this.tags) {
            new Setting(contentEl).setName(tag).addToggle((toggle) =>
                toggle.setValue(false).onChange((value) => {
                    if (value) {
                        this.checked.add(tag);
                    } else {
                        this.checked.delete(tag);
                    }
                }),
            );
        }
    }

    onClose() {
        this.contentEl.empty();
        this.onSubmit(this.cancelled ? null : this.checked);
    }
}

/**
 * Show the tagline checklist modal for the given addable tags.
 * Returns the set of checked tags, or null if cancelled.
 */
export function showTaglineModal(
    app: App,
    tags: string[],
): Promise<Set<string> | null> {
    return new Promise((resolve) => {
        new TaglineModal(app, tags, resolve).open();
    });
}

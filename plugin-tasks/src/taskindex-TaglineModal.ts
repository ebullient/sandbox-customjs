import { type App, Modal, Setting } from "obsidian";

/**
 * Modal presenting a checklist of addable daily tags (tags already present
 * in the note's tagline are expected to be filtered out by the caller).
 *
 * Matches Obsidian's settings-modal behavior: there are no OK/Cancel
 * buttons. Dismissing the modal — via the close button, Esc, or a
 * background click — submits the checked tags.
 */
export class TaglineModal extends Modal {
    private checked = new Set<string>();

    constructor(
        app: App,
        private tags: string[],
        private onSubmit: (result: Set<string>) => void,
    ) {
        super(app);
        this.containerEl.id = "tagline-modal";
    }

    onOpen() {
        const { contentEl } = this;

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
        this.onSubmit(this.checked);
    }
}

/**
 * Show the tagline checklist modal for the given addable tags.
 * Returns the set of checked tags (empty if none were checked).
 */
export function showTaglineModal(
    app: App,
    tags: string[],
): Promise<Set<string>> {
    return new Promise((resolve) => {
        new TaglineModal(app, tags, resolve).open();
    });
}

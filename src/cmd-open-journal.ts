import type { App } from "obsidian";

export class OpenJournal {
    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded OpenJournal");
    }

    /**
     * Open today's journal file
     * Creates the file if it doesn't exist
     * Reuses existing leaf if already open, otherwise opens in a new leaf (split pane)
     */
    async invoke(): Promise<void> {
        // Get today's date
        const today = window.moment();

        // Format the path as chronicles/journal/YYYY/journal-YYYY-MM-DD.md
        const journalPath = today.format(
            "[chronicles/journal/]YYYY[/journal-]YYYY-MM-DD[.md]",
        );

        let found = false;

        // Check if the journal file is already open in a markdown leaf
        const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
        for (const leaf of markdownLeaves) {
            const viewState = leaf.getViewState();
            if (viewState.state?.file === journalPath) {
                // File is already open, activate this leaf and exit
                this.app.workspace.setActiveLeaf(leaf, { focus: true });
                found = true;
                break;
            }
        }

        if (!found) {
            // Check if journal file exists, create if it doesn't
            let journalFile = this.app.vault.getAbstractFileByPath(journalPath);

            if (!journalFile) {
                // Create the journal file (Templater will handle template application)
                journalFile = await this.app.vault.create(journalPath, "");
                console.log("Created journal file:", journalPath);
            }

            // Open in a new leaf (split to the right) in source mode
            await this.app.workspace.openLinkText(journalPath, "", true, {
                state: { mode: "source" },
            });
        }

        // Position cursor at the end of the file
        const view = this.app.workspace.getActiveViewOfType(
            window.customJS.obsidian.MarkdownView,
        );
        if (view?.editor) {
            const lastLine = view.editor.lastLine();
            view.editor.setCursor(lastLine);
        }
    }
}

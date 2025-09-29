import type { App, Editor } from "obsidian";

export class LinkJournal {
    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded LinkJournal");
    }

    /**
     * Insert a link to the journal entry for the current file's date
     * Replaces the Templater template: templates/AllTheThings/link-journal.md
     */
    async invoke(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            console.log("No active file");
            return;
        }

        // Get the active editor
        const activeView = this.app.workspace.getActiveViewOfType(
            window.customJS.obsidian.MarkdownView,
        );
        if (!activeView || !activeView.editor) {
            console.log("No active editor found");
            return;
        }

        const editor = activeView.editor;

        // Parse the file title as a date using moment
        const date = window.moment(activeFile.basename);
        if (!date.isValid()) {
            console.log("File title is not a valid date:", activeFile.basename);
            return;
        }

        // Format the path as YYYY/YYYY-MM-DD
        const path = date.format("YYYY/YYYY-MM-DD");

        // Create the link text: [📖](demesne/self/journal/YYYY/YYYY-MM-DD) #me/✅/✍️
        const linkText = `[📖](demesne/self/journal/${path}) #me/✅/✍️`;

        // Insert the text at the cursor position
        editor.replaceSelection(linkText);
    }
}

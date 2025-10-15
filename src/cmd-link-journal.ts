import type { App } from "obsidian";

export class LinkJournal {
    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded LinkJournal");
    }

    /**
     * Insert a link to the journal entry for the current file's date
     * Handles both daily (YYYY-MM-DD) and weekly (YYYY-MM-DD_week) files
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
        const filename = activeFile.basename;

        // Check if it's a weekly file (ends with _week)
        const isWeekly = filename.endsWith("_week");
        const dateString = isWeekly ? filename.replace("_week", "") : filename;

        // Parse the date using moment
        const date = window.moment(dateString);
        if (!date.isValid()) {
            console.log("File title is not a valid date:", filename);
            return;
        }

        // Format the path as YYYY/YYYY-MM-DD (common for both daily and weekly)
        const path = date.format("YYYY/[journal-]YYYY-MM-DD");
        const weekSuffix = isWeekly ? "_week" : "";
        const linkText = `[📖](chronicles/journal/${path}${weekSuffix}) #me/✅/✍️`;

        // Insert the text at the cursor position
        editor.replaceSelection(linkText);
    }
}

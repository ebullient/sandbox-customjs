import type { App } from "obsidian";

export class Scratch {
    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded Scratch");
    }

    /**
     * Insert a scratch callout block
     * Replaces the Templater template: templates/AllTheThings/scratch.md
     */
    async invoke(): Promise<void> {
        const activeView = this.app.workspace.getActiveViewOfType(
            window.customJS.obsidian.MarkdownView,
        );
        if (!activeView || !activeView.editor) {
            console.log("No active editor found");
            return;
        }

        const editor = activeView.editor;

        // Insert the scratch callout: > [!scratch]\n>
        const scratchText = "> [!scratch]\n> ";

        editor.replaceSelection(scratchText);

        // Position cursor after the "> " on the second line
        const cursor = editor.getCursor();
        editor.setCursor(cursor.line, cursor.ch);
    }
}

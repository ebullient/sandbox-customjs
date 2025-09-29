import type { App } from "obsidian";

export class IndentBlock {
    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded IndentBlock");
    }

    /**
     * Indent the selected text block by 4 spaces
     * Replaces the Templater template: templates/AllTheThings/indent-block.md
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

        // Get the current selection
        if (!editor.somethingSelected()) {
            console.log("No text selected");
            return;
        }

        const selection = editor.getSelection();
        const indent = "    "; // 4 spaces

        // Split by lines, add indent to each line, then join back
        const indentedText = indent + selection.split("\n").join(`\n${indent}`);

        // Replace the selection with the indented text
        editor.replaceSelection(indentedText);
    }
}

import { type App, MarkdownView, Notice, type TFile } from "obsidian";
import {
    getConversationFiles,
    getFileTitle,
    getNoteContext,
    showFileSuggester,
} from "../taskindex-NoteUtils";

/**
 * Command to create a conversation entry for the current day.
 * Replaces the CustomJS Conversation class from cmd-conversation.ts
 *
 * Workflow:
 * 1. Get the current file and extract its date
 * 2. Show a suggester to choose a conversation file
 * 3. Add a dated section to the conversation file (if not already present)
 * 4. Insert a markdown link/embed at the cursor position in the source file
 */
export class ConversationCommand {
    constructor(private app: App) {}

    async execute(): Promise<void> {
        console.log("[Conversation] execute() called");
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            console.log("[Conversation] No active file");
            new Notice("No active file");
            return;
        }
        console.log("[Conversation] Active file:", activeFile.path);

        try {
            // Get the date from the source file (or use current date)
            const sourceContext = getNoteContext(activeFile.path);
            const day =
                sourceContext.date ||
                window.moment(activeFile.basename).format("YYYY-MM-DD");
            console.log("[Conversation] Source context:", sourceContext);
            console.log("[Conversation] Day:", day);

            // Get conversation files
            const files = getConversationFiles(this.app, activeFile);
            console.log(
                "[Conversation] Found conversation files:",
                files.length,
            );

            if (files.length === 0) {
                console.log("[Conversation] No conversation files found");
                new Notice("No conversation files found");
                return;
            }

            // Show file suggester
            const choice = await showFileSuggester(
                this.app,
                files,
                "Choose conversation file",
            );
            console.log("[Conversation] User chose:", choice);

            if (!choice) {
                console.log("[Conversation] User cancelled");
                return; // User cancelled
            }

            const targetContext = getNoteContext(choice);
            console.log("[Conversation] Target context:", targetContext);

            const result = await this.createConversationEntry(
                day,
                targetContext,
            );
            console.log("[Conversation] Result to insert:", result);

            if (result) {
                // Insert the result at cursor position
                const activeView =
                    this.app.workspace.getActiveViewOfType(MarkdownView);

                if (activeView?.editor) {
                    console.log("[Conversation] Inserting at cursor");
                    activeView.editor.replaceSelection(result);
                    console.log("[Conversation] Done");
                } else {
                    console.warn(
                        "[Conversation] No active editor to insert result",
                    );
                }
            } else {
                console.log("[Conversation] No result to insert");
            }
        } catch (error) {
            console.error("[Conversation] Error:", error);
            new Notice("Error creating conversation entry");
        }
    }

    /**
     * Create conversation entry in the specified file for the given day.
     * Adds a dated section if it doesn't exist, then returns markdown for insertion.
     */
    private async createConversationEntry(
        day: string,
        targetContext: { path: string },
    ): Promise<string> {
        console.log("[Conversation.createEntry] Starting with:", {
            day,
            targetPath: targetContext.path,
        });

        const file = this.app.vault.getFileByPath(targetContext.path) as TFile;
        if (!file) {
            console.log(
                `[Conversation.createEntry] File not found: ${targetContext.path}`,
            );
            return "";
        }

        const title = getFileTitle(this.app, file);
        const fileCache = this.app.metadataCache.getFileCache(file);
        const headings = fileCache?.headings?.filter((x) => x.level === 2);

        console.log("[Conversation.createEntry] Title:", title);
        console.log(
            "[Conversation.createEntry] H2 headings:",
            headings?.map((h) => h.heading),
        );

        // Add the day section if it doesn't exist or is not the first heading
        if (!headings || headings.length === 0) {
            console.log(
                "[Conversation.createEntry] No headings, appending section",
            );
            await this.app.vault.process(file, (content) => {
                console.log(
                    "[Conversation.createEntry] File processed (append)",
                );
                return `${content}\n\n## ${day}\n\n`;
            });
        } else if (headings[0].heading !== day) {
            console.log(
                "[Conversation.createEntry] First heading is not day, inserting at line",
                headings[0].position.start.line,
            );
            await this.app.vault.process(file, (content) => {
                const split = content.split("\n");
                split.splice(
                    headings[0].position.start.line,
                    0,
                    `## ${day}\n\n`,
                );
                console.log(
                    "[Conversation.createEntry] File processed (insert)",
                );
                return split.join("\n");
            });
        } else {
            console.log(
                "[Conversation.createEntry] Day section already exists as first heading",
            );
        }

        // Return markdown link and embed for insertion at cursor
        const result = [
            `- [**${title}**](${targetContext.path}#${day})`,
            `    ![${day}](${targetContext.path}#${day})`,
            "",
        ].join("\n");
        console.log("[Conversation.createEntry] Returning result");
        return result;
    }
}

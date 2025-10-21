import type { App, TFile } from "obsidian";
import type { Utils } from "./_utils";

export class Conversation {
    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded Conversation");
    }

    /**
     * Lazy-load utils function - important for dynamic updates
     */
    utils = (): Utils => window.customJS.Utils;

    /**
     * Create a conversation entry for the specified day
     * Replaces the Templater template: templates/AllTheThings/conversation-day.md
     */
    async invoke(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            console.log("No active file");
            return;
        }

        try {
            const day = window.moment(activeFile.basename).format("YYYY-MM-DD");
            const regex = this.utils().segmentFilterRegex(
                "chronicles/conversations",
            );
            const files = this.utils()
                .filesWithPath(activeFile, regex)
                .map((x) => x.path);

            if (files.length === 0) {
                console.log("No conversation files found");
                return;
            }

            // Use Utils showFileSuggester instead of tp.system.suggester
            const choice = await this.utils().showFileSuggester(
                files,
                "Choose conversation file",
            );

            if (!choice) {
                return; // User cancelled
            }

            const result = await this.createConversationEntry(day, choice);

            if (result) {
                // Insert the result at cursor position
                const activeView = this.app.workspace.getActiveViewOfType(
                    window.customJS.obsidian.MarkdownView,
                );

                if (activeView?.editor) {
                    activeView.editor.replaceSelection(result);
                } else {
                    console.warn(
                        "Conversation: no active view or editor to insert result",
                    );
                }
            }
        } catch (error) {
            console.error("Error in Conversation:", error);
        }
    }

    /**
     * Create conversation entry in the specified file for the given day
     * Adapted from Templates.createConversation
     */
    private async createConversationEntry(
        day: string,
        filePath: string,
    ): Promise<string> {
        const file = this.app.vault.getFileByPath(filePath) as TFile;
        if (!file) {
            console.log(`File not found: ${filePath}`);
            return "";
        }

        const fileCache = this.app.metadataCache.getFileCache(file);
        const title = fileCache?.frontmatter?.aliases
            ? fileCache.frontmatter.aliases[0]
            : file.basename;

        const headings = fileCache?.headings?.filter((x) => x.level === 2);

        // Add the day section if it doesn't exist or is not the first heading
        if (!headings || headings.length === 0) {
            await this.app.vault.process(file, (content) => {
                return `${content}\n\n## ${day}\n\n`;
            });
        } else if (headings[0].heading !== day) {
            await this.app.vault.process(file, (content) => {
                const split = content.split("\n");
                split.splice(
                    headings[0].position.start.line,
                    0,
                    `## ${day}\n\n`,
                );
                return split.join("\n");
            });
        }

        return [
            `- [**${title}**](${file.path}#${day})`,
            `    ![${day}](${file.path}#${day})`,
            "",
        ].join("\n");
    }
}

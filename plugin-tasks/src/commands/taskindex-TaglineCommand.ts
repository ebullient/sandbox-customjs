import { type App, Notice, type TFile } from "obsidian";
import type { TaskIndexSettings } from "../@types";
import { DAILY_NOTE_REGEX } from "../taskindex-CommonPatterns";
import { showTaglineModal } from "../taskindex-TaglineModal";

const LOG_HEADING_REGEX = /^##\s+Log\s*$/;

/**
 * Command to set mood/daily tags on the active or today's daily note.
 *
 * 1. Resolves the target daily note (active file if it is one, else today's).
 * 2. Finds the '## Log' heading and reads its first line (the tagline) to
 *    determine which configured tags are already present.
 * 3. Shows a checklist modal of only the tags not already present.
 * 4. On OK, adds the checked tags to the tagline (creating the Log
 *    section and/or tagline if they don't exist).
 */
export class TaglineCommand {
    constructor(
        private app: App,
        private settings: TaskIndexSettings,
    ) {}

    async execute(): Promise<void> {
        const file = this.resolveDailyNote();
        if (!file) {
            new Notice("Not a daily note, and today's daily note not found");
            return;
        }

        if (this.settings.dailyTags.length === 0) {
            new Notice("No daily tags configured");
            return;
        }

        const content = await this.app.vault.read(file);
        const lines = content.split("\n");
        const { headingLine, taglineLine } = this.findLogSection(lines);

        const addableTags = this.settings.dailyTags.filter(
            (tag) =>
                taglineLine === undefined || !lines[taglineLine].includes(tag),
        );
        if (addableTags.length === 0) {
            new Notice("All daily tags already present");
            return;
        }

        const result = await showTaglineModal(this.app, addableTags);
        const missing = addableTags.filter((tag) => result.has(tag));
        if (missing.length === 0) {
            return;
        }

        await this.applyTagline(file, headingLine, taglineLine, missing);
        new Notice("Tagline updated");
    }

    /**
     * Returns the active file if it's a daily note, otherwise looks up
     * today's daily note by the configured format. Does not create it.
     */
    private resolveDailyNote(): TFile | null {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && DAILY_NOTE_REGEX.test(activeFile.path)) {
            return activeFile;
        }

        const todayPath = window.moment().format(this.settings.dailyNoteFormat);
        const file = this.app.vault.getAbstractFileByPath(todayPath);
        return file && "extension" in file ? (file as TFile) : null;
    }

    /**
     * Finds the '## Log' heading and the line index of its first non-empty
     * content line (the tagline), if any.
     */
    private findLogSection(lines: string[]): {
        headingLine: number | undefined;
        taglineLine: number | undefined;
    } {
        const headingLine = lines.findIndex((l) => LOG_HEADING_REGEX.test(l));
        if (headingLine === -1) {
            return { headingLine: undefined, taglineLine: undefined };
        }

        for (let i = headingLine + 1; i < lines.length; i++) {
            if (lines[i].trim().length === 0) {
                continue;
            }
            if (lines[i].startsWith("#")) {
                break;
            }
            return { headingLine, taglineLine: i };
        }

        return { headingLine, taglineLine: undefined };
    }

    private async applyTagline(
        file: TFile,
        headingLine: number | undefined,
        taglineLine: number | undefined,
        missing: string[],
    ): Promise<void> {
        await this.app.vault.process(file, (content) => {
            const lines = content.split("\n");

            if (taglineLine !== undefined) {
                lines[taglineLine] =
                    `${lines[taglineLine]} ${missing.join(" ")}`;
                return lines.join("\n");
            }

            const tagline = `- ${missing.join(" ")}`;

            if (headingLine !== undefined) {
                lines.splice(headingLine + 1, 0, tagline);
                return lines.join("\n");
            }

            while (
                lines.length > 0 &&
                lines[lines.length - 1].trim().length === 0
            ) {
                lines.pop();
            }
            lines.push("", "## Log", tagline);
            return `${lines.join("\n")}\n`;
        });
    }
}

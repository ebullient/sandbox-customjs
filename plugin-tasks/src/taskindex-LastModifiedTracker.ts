import { type App, debounce, type TFile } from "obsidian";
import type { CurrentSettings } from "./@types";

/**
 * Tracks editor changes and updates last_modified frontmatter
 * Only updates if the new date is newer than existing value
 */
export class LastModifiedTracker {
    constructor(
        private app: App,
        private settings: CurrentSettings,
    ) {}

    /**
     * Handle editor change event
     * Debounced to avoid excessive updates during active editing
     */
    readonly onEditorChange = debounce(
        (file: TFile) => {
            if (!this.settings.current().trackLastModified) {
                return;
            }
            if (!this.settings.shouldIndexFile(file)) {
                return;
            }
            this.updateLastModified(file);
        },
        5000,
        true,
    );

    /**
     * Update last_modified frontmatter if needed
     */
    private async updateLastModified(file: TFile): Promise<void> {
        try {
            const today = window.moment().format("YYYY-MM-DD");

            await this.app.fileManager.processFrontMatter(
                file,
                (frontmatter) => {
                    const existing = frontmatter.last_modified;

                    // Only update if no existing value or new date is newer
                    if (!existing || existing < today) {
                        frontmatter.last_modified = today;
                    }
                },
            );
        } catch (error) {
            console.error(
                `[LastModifiedTracker] Failed to update ${file.path}:`,
                error,
            );
        }
    }
}

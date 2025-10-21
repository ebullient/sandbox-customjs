import type { TFolder } from "obsidian";
import type { Templater } from "./@types/templater.types";
import type { Utils } from "./_utils";

/**
 * Templates class for working with Obsidian Templater templates.
 * Provides utilities for file selection, content pushing, and conversation management.
 */
export class Templates {
    constructor() {
        console.log("loaded Templates");
    }

    /**
     * Lazy-load utils function - important for dynamic updates
     */
    private utils = (): Utils => window.customJS.Utils;

    /**
     * Prompt user to choose a file from the vault.
     */
    chooseFile = async (tp: Templater): Promise<string> => {
        const files = this.utils().filePaths();
        return await tp.system.suggester(files, files);
    };

    /**
     * Prompt user to choose a folder from the vault.
     */
    chooseFolder = async (tp: Templater, folder: string): Promise<string> => {
        const folders = this.utils()
            .foldersByCondition(
                folder,
                (tfolder: TFolder) => !tfolder.path.startsWith("assets"),
            )
            .map((f) => f.path);

        folders.unshift("--");
        const choice = await tp.system.suggester(folders, folders);

        if (!choice) {
            console.warn("No choice selected. Using 'athenaeum'");
            return "athenaeum";
        }

        return choice === "--"
            ? await tp.system.prompt("Enter folder path")
            : choice;
    };
}

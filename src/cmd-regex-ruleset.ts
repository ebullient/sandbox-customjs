import type { App } from "obsidian";

export class RegexRuleset {
    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded RegexRuleset");
    }

    /**
     * Copy all files from assets/regex-ruleset to .obsidian/regex-ruleset
     * @returns {Promise<void>}
     */
    async invoke(): Promise<void> {
        const sourcePath = "assets/regex-rulesets";
        const targetPath = ".obsidian/regex-rulesets";

        try {
            const sourceExists =
                await this.app.vault.adapter.exists(sourcePath);
            if (!sourceExists) {
                console.log("assets/regex-ruleset folder not found");
                return;
            }

            await this.copyFolderContents(sourcePath, targetPath);
            console.log("Regex ruleset files copied successfully");
        } catch (error) {
            console.error("Error copying regex ruleset:", error);
        }
    }

    /**
     * Copy all files from source folder to target path using DataAdapter
     * @param {string} sourcePath The source folder path
     * @param {string} targetPath The target folder path
     * @returns {Promise<void>}
     */
    private async copyFolderContents(
        sourcePath: string,
        targetPath: string,
    ): Promise<void> {
        await this.ensureFolderExists(targetPath);

        const sourceFiles = await this.app.vault.adapter.list(sourcePath);

        for (const filePath of sourceFiles.files) {
            // Extract just the filename from the full path
            const fileName = filePath.split("/").pop();
            const sourceFilePath = filePath;
            const targetFilePath = `${targetPath}/${fileName}`;

            console.log(`Copying: ${sourceFilePath} -> ${targetFilePath}`);

            try {
                const content =
                    await this.app.vault.adapter.read(sourceFilePath);
                await this.app.vault.adapter.write(targetFilePath, content);
            } catch (error) {
                console.error(`Error copying ${fileName}:`, error);
                console.error(`Source path was: ${sourceFilePath}`);
                console.error(`Target path was: ${targetFilePath}`);
            }
        }
    }

    /**
     * Ensure the target folder exists, creating it if necessary
     * @param {string} folderPath The folder path to ensure exists
     * @returns {Promise<void>}
     */
    private async ensureFolderExists(folderPath: string): Promise<void> {
        const exists = await this.app.vault.adapter.exists(folderPath);
        if (!exists) {
            await this.app.vault.adapter.mkdir(folderPath);
        }
    }
}

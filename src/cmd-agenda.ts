import type { App, TFile } from "obsidian";

export class Agenda {
    patterns = {
        agenda: /%% agenda %%(([\s\S]*?)%% agenda %%)?/g,
    };

    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded Agenda");
    }

    /**
     * Replace agenda markers in the active file with content from Agenda file
     * @returns {Promise<void>}
     */
    async invoke(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            console.log("No active file");
            return;
        }

        const agendaFile = this.app.vault.getAbstractFileByPath("assets/Agenda.txt") as TFile;
        if (!agendaFile) {
            console.log("assets/Agenda.txt not found");
            return;
        }

        await this.replaceAgendaContent(activeFile, agendaFile);
    }

    /**
     * Replace agenda content in the target file with content from agenda file
     * @param {TFile} targetFile The file to update
     * @param {TFile} agendaFile The agenda file to read from
     * @returns {Promise<void>}
     */
    private async replaceAgendaContent(
        targetFile: TFile,
        agendaFile: TFile,
    ): Promise<void> {
        const agendaContent = await this.app.vault.read(agendaFile);

        await this.app.vault.process(targetFile, (source) => {
            return source.replace(this.patterns.agenda, () => {
                return agendaContent.trim()
                    ? `%% agenda %%\n**Agenda**\n${agendaContent.trim()}\n%% agenda %%`
                    : "%% agenda %%";
            });
        });
    }
}

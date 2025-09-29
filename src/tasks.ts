import type { App, TFile } from "obsidian";
import type { EngineAPI } from "./@types/jsengine.types";
import type { Utils } from "./_utils";

interface FileTasks {
    file: TFile;
    mark: string;
    text: string;
}

export class Tasks {
    taskPattern = /^([\s>]*- )\[(.)\] (.*)$/;
    completedPattern = /\((\d{4}-\d{2}-\d{2})\)/;
    dailyNotePattern = /(\d{4}-\d{2}-\d{2})\.md/;
    //chroniclesPattern = /^chronicles\/\d{4}\/\d{4}\.md$/;
    taskPaths = ["demesne", "quests"];

    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded Tasks");
    }

    utils = (): Utils => window.customJS.Utils;

    /**
     * Retrieve tasks from the current active file.
     * @returns {Promise<Array>} A promise that resolves to an array of tasks from the current active file.
     */
    currentFileTasks = async (): Promise<FileTasks[]> => {
        const tfile = this.app.workspace.getActiveFile();
        return tfile ? this.fileTasks(tfile) : [];
    };

    /**
     * Retrieve tasks from a specified file.
     * @param {TFile} tfile The file to examine.
     * @returns {Promise<Array>} A promise that resolves to an array of tasks from the specified file.
     */
    fileTasks = async (tfile: TFile): Promise<FileTasks[]> => {
        const tasks: FileTasks[] = [];
        const content = await this.app.vault.cachedRead(tfile);
        const split = content?.split("\n");
        if (split) {
            for (const l of split) {
                const taskMatch = this.taskPattern.exec(l);
                if (taskMatch) {
                    //console.log(taskMatch);
                    tasks.push({
                        file: tfile,
                        mark: taskMatch[2],
                        text: taskMatch[3],
                    });
                }
            }
        }
        return tasks;
    };

    /**
     * Retrieve tasks for the week derived from the name of the current active file
     * @param {EngineAPI} engine The engine to create markdown.
     * @returns {Promise<string>} A promise that resolves to a markdown list of tasks for the current week.
     */
    thisWeekTasks = async (engine: EngineAPI): Promise<string> => {
        const tfile = this.app.workspace.getActiveFile();
        const titledate = tfile.name.replace(".md", "").replace("_week", "");
        const begin = window.moment(titledate).day(1);
        const end = window.moment(begin).add(6, "d");
        console.log(
            titledate,
            begin.format("YYYY-MM-DD"),
            end.format("YYYY-MM-DD"),
            engine,
        );

        const files = this.app.vault.getMarkdownFiles();
        const list: string[] = [];
        for (const file of files) {
            if (file.path.includes("archive") || file.path.includes("-test")) {
                continue;
            }
            if (
                this.taskPaths.some((x) => file.path.includes(x))
                // || this.chroniclesPattern.test(file.path)
            ) {
                const tasks = await this.fileTasks(file);
                for (const task of tasks) {
                    if (task.mark.match(/[x-]/)) {
                        let completed = this.completedPattern.exec(task.text);
                        if (!completed) {
                            completed = this.dailyNotePattern.exec(task.text);
                        }

                        if (
                            completed &&
                            window
                                .moment(completed[1])
                                .isBetween(begin, end, "day", "[]")
                        ) {
                            // console.log(file.path, completed);
                            const link = this.utils().markdownLink(task.file);
                            list.push(`- *${link}*: ${task.text}`);
                        }
                    }
                }
            }
        }
        if (list.length === 0) {
            list.push(
                `- No tasks found between ${begin.format("YYYY-MM-DD")} and ${end.format("YYYY-MM-DD")}`,
            );
        }
        return engine.markdown.create(list.join("\n"));
    };
}

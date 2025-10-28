import type { Moment } from "moment";
import type { App, TFile } from "obsidian";
import type { EngineAPI } from "./@types/jsengine.types";
import type { FileFilterFn, Utils } from "./_utils";

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

    thisWeekTasks = async (engine: EngineAPI): Promise<string> => {
        const current =
            engine.instanceId?.executionContext?.file ||
            this.app.workspace.getActiveFile();

        const titledate = current.name.replace(".md", "").replace("_week", "");
        const begin = window.moment(titledate).day(1); // Monday
        return this.findCompletedTasks(
            engine,
            current,
            begin,
            (tfile: TFile) => {
                if (
                    tfile.path.includes("archive") ||
                    tfile.path.includes("-test")
                ) {
                    return false;
                }
                return this.taskPaths.some((x) => tfile.path.includes(x));
            },
        );
    };

    fixedWeekTasks = async (
        engine: EngineAPI,
        beginDate: string,
        tag: string | string[] = [],
        all = false,
    ): Promise<string> => {
        const current =
            engine.instanceId?.executionContext?.file ||
            this.app.workspace.getActiveFile();

        const begin = window.moment(beginDate); // exact day
        return this.findCompletedTasks(
            engine,
            current,
            begin,
            (tfile: TFile) => {
                if (
                    tfile.path.includes("archive") ||
                    tfile.path.includes("-test")
                ) {
                    return false;
                }
                return (
                    this.utils().filterByTag(tfile, tag, all) &&
                    this.taskPaths.some((x) => tfile.path.includes(x))
                );
            },
            (text) => text.replace(/\s+#(chore|routine|trivial)/, ""),
        );
    };

    findCompletedTasks = async (
        engine: EngineAPI,
        current: TFile,
        begin: Moment,
        fn: FileFilterFn,
        map: (t: string) => string = (t) => t,
    ): Promise<string> => {
        const end = window.moment(begin).add(6, "d");

        const ar = window.customJS.AreaRelated;
        const bySphere = new Map<string, string[]>();

        const files = this.utils().filesMatchingCondition(current, fn);

        for (const file of files) {
            const sphere = ar.fileSphere(file) || "(no sphere)";
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
                        const taskLine = `- *${link}*: ${map(task.text)}`;

                        if (!bySphere.has(sphere)) {
                            bySphere.set(sphere, []);
                        }
                        bySphere.get(sphere).push(taskLine);
                    }
                }
            }
        }

        const list: string[] = [];
        if (bySphere.size === 0) {
            list.push(
                `- No tasks found between ${begin.format("YYYY-MM-DD")} and ${end.format("YYYY-MM-DD")}`,
            );
        } else {
            const spheres = Array.from(bySphere.keys()).sort();
            for (const sphere of spheres) {
                const tasks = bySphere.get(sphere);
                tasks.sort();

                list.push(`#### ${sphere}\n`);
                list.push(...tasks);
                list.push("");
            }
        }
        return engine.markdown.create(list.join("\n"));
    };
}

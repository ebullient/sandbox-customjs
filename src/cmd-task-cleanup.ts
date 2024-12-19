import type { Moment } from "moment";
import type { App, HeadingCache, TFile } from "obsidian";

export class TaskCleanup {
    taskPattern = /^([\s>]*- )\[(.)\] (.*)$/;
    completedPattern = /\((\d{4}-\d{2}-\d{2})\)/;
    dailyNotePattern = /(\d{4}-\d{2}-\d{2})\.md/;

    done = /^[\s>]*- (✔️|〰️) .*$/;
    list = /^[\s>]*- .*$/;

    app: App;

    constructor() {
        // Constructor
        this.app = window.customJS.app;
        console.log("loaded TaskCleanup");
    }

    /**
     * Clean up (remove task nature of) old tasks in markdown files.
     * @returns {Promise<void>}
     */
    async invoke(): Promise<void> {
        console.log("Cleaning up old tasks");
        const monthMoment = window.moment().startOf("month");

        console.log(
            "Cleaning up tasks before",
            monthMoment.format("(YYYY-MM-"),
        );

        // Map each file to the result of a cached read
        const promises = this.app.vault.getMarkdownFiles().map((file) => {
            if (
                file.name.match(this.dailyNotePattern) ||
                file.path.startsWith("assets")
            ) {
                return () => true;
            }
            const fileCache = this.app.metadataCache.getFileCache(file);
            if (!fileCache.headings) {
                return () => true;
            }
            const logHeading = fileCache.headings.find((x) =>
                x.heading.endsWith("Log"),
            );
            if (logHeading) {
                return this.updateTasks(file, logHeading, monthMoment);
            }
            return () => true;
        });

        // wait for updates to all relevant files
        await Promise.all(promises);
    }

    /**
     * Update tasks in the Log section of the specified file if the file is older than the specified month.
     * Relies on marked completed tasks: `- [x] task (YYYY-MM-DD)` or `- [-] task (YYYY-MM-DD)`
     * @param {TFile} file The file to update.
     * @param {HeadingCache} logHeading The log heading object containing position information.
     * @param {moment} monthMoment The moment object representing the start of the month.
     * @returns {Promise<void>}
     */
    updateTasks = async (
        file: TFile,
        logHeading: HeadingCache,
        monthMoment: Moment,
    ): Promise<void> => {
        await this.app.vault.process(file, (source) => {
            const split = source.split("\n");
            let i = logHeading.position.start.line + 1;
            for (i; i < split.length; i++) {
                if (split[i].startsWith("#") || split[i] === "---") {
                    break;
                }
                if (split[i].match(this.list)) {
                    if (split[i].match(this.done)) {
                        break;
                    }
                    const taskMatch = this.taskPattern.exec(split[i]);
                    if (taskMatch) {
                        let completedMatch = this.completedPattern.exec(
                            taskMatch[3],
                        );
                        if (!completedMatch) {
                            // get date from daily note reference
                            completedMatch = this.dailyNotePattern.exec(
                                taskMatch[3],
                            );
                        }
                        const mark = taskMatch[2];
                        const completed = completedMatch
                            ? window.moment(completedMatch[1])
                            : null;

                        if (completed?.isBefore(monthMoment)) {
                            if (mark === "x") {
                                split[i] = `${taskMatch[1]} ✔️ ${taskMatch[3]}`;
                            } else {
                                split[i] =
                                    `${taskMatch[1]} 〰️ ~~${taskMatch[3]}~~`;
                            }
                        }
                    }
                }
            }
            return split.join("\n");
        });
    };
}

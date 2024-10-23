import { Moment } from "moment";
import { Utils } from "./_utils";
import { App, HeadingCache, TFile } from "obsidian";



export class TaskCleanup {
    anyTaskMark = new RegExp(/^([\s>]*- )(\[(?:x|-)\]) (.*) \((\d{4}-\d{2}-\d{2})\)\s*$/);
    dailyNote = /^(\d{4}-\d{2}-\d{2}).md$/;
    done = new RegExp(/^[\s>]*- (✔️|〰️) .*$/);
    list = new RegExp(/^[\s>]*- .*$/);

    app: App;

    constructor() {  // Constructor
        this.app = window.customJS.app;
        console.log("loaded TaskCleanup");
    }

    /**
     * Clean up (remove task nature of) old tasks in markdown files.
     * @returns {Promise<void>}
     */
    async invoke(): Promise<void> {
        console.log("Cleaning up old tasks");
        const monthMoment = window.moment().startOf('month');

        console.log("Cleaning up tasks before",  monthMoment.format("(YYYY-MM-"));

        // Map each file to the result of a cached read
        const promises = this.app.vault.getMarkdownFiles()
            .map((file) => {
                if (file.name.match(this.dailyNote) || file.path.startsWith("assets")) {
                    return () => true;
                }
                const fileCache = this.app.metadataCache.getFileCache(file);
                if (!fileCache.headings) {
                    return () => true;
                }
                const logHeading = fileCache.headings.find(x => x.heading.endsWith("Log"));
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
    updateTasks = async (file: TFile, logHeading: HeadingCache, monthMoment: Moment): Promise<void> => {
        await this.app.vault.process(file, (source) => {
            const split = source.split("\n");
            let i = logHeading.position.start.line + 1;
            for (i; i < split.length; i++) {
                if (split[i].startsWith("#") || split[i] == "---") {
                    break;
                }
                if (split[i].match(this.list)) {
                    if (split[i].match(this.done)) {
                        break;
                    }
                    const taskMatch = this.anyTaskMark.exec(split[i]);
                    if (taskMatch) {
                        const mark = taskMatch[2];
                        const completed = window.moment(taskMatch[4]);
                        if (completed.isBefore(monthMoment)) {
                            if (mark == "[x]") {
                                split[i] = `${taskMatch[1]} ✔️ ${taskMatch[3]} (${taskMatch[4]})`;
                            } else {
                                split[i] = `${taskMatch[1]} 〰️ ~~${taskMatch[3]} (${taskMatch[4]})~~`;
                            }
                        }
                    }
                }
            }
            return split.join("\n");
        });
    }
}

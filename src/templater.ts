import {
    App,
    TFolder,
} from "obsidian";
import { Utils } from "./_utils";
import { Templater } from "./@types/templater.types";

interface LineInfo {
    title: string;
    path: string;
    heading: string;
    text: string;
}

export class Templates {
    headerPush = ['Section', 'Log item', 'Tasks item'];
    itemPush = ['Log item', 'Tasks item'];
    dated = /^.*?(\d{4}-\d{2}-\d{2}).*$/;
    completedPattern = /.*\((\d{4}-\d{2}-\d{2})\)\s*$/;
    dailyNotePattern = /(\d{4}-\d{2}-\d{2})\.md/;

    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded Templates");
    }

    utils = (): Utils => window.customJS.Utils;

    /**
     * Add text to a specified section in a file.
     * @param {Templater} tp The templater plugin instance.
     * @param {string} choice The file path to add text to.
     * @param {string} addThis The text to add.
     * @param {string} [section='Log'] The section to add the text to.
     * @returns {Promise<void>}
     */
    addToSection = async (tp: Templater, choice: string, addThis: string, section: string = "Log"): Promise<void> => {
        const file = tp.file.find_tfile(choice);
        const fileCache = this.app.metadataCache.getCache(choice);
        const headings = fileCache.headings
            .filter(x => x.level >= 2)
            .filter(x => x.heading.contains(section));

        if (headings[0]) {
            await this.app.vault.process(file, (content) => {
                const split = content.split("\n");
                split.splice(headings[0].position.start.line + 1, 0, addThis);
                return split.join("\n");
            });
        }
    }

    /**
     * Templater prompt with suggester to choose a file from the vault.
     * @param {Templater} tp The templater plugin instance.
     * @returns {Promise<string>} The chosen file path.
     */
    chooseFile = async (tp: Templater): Promise<string> =>  {
        const files = this.utils().filePaths();
        return await tp.system.suggester(files, files);
    }

    /**
     * Templater prompt with suggester to choose a folder from the vault.
     * @param {Templater} tp The templater plugin instance.
     * @param {string} folder The initial folder path to filter.
     * @returns {Promise<string>} The chosen folder path or a user-entered folder path.
     */
    chooseFolder = async (tp: Templater, folder: string): Promise<string> => {
        const folders = this.utils().foldersByCondition(folder,
            (tfolder: TFolder) =>!tfolder.path.startsWith("assets"))
            .map(f => f.path);

        folders.unshift('--');
        const choice = await tp.system.suggester(folders, folders);
        if (choice) {
            if (choice == '--') {
                return await tp.system.prompt("Enter folder path");
            }
            return choice;
        }
        console.warn("No choice selected. Using 'athenaeum'");
        return 'athenaeum';
    }

    /**
     * Create a conversation entry for the specified day:
     * - Create a new dated section in the relevant file
     * - Add a link to the conversation in the daily log, and embed that section
     * @param {Templater} tp The templater plugin instance.
     * @returns {Promise<string>} The markdown content for the conversation entry.
     */
    createConversation = async (tp: Templater): Promise<string> => {
        let result = "";
        const day = window.moment(tp.file.title).format("YYYY-MM-DD");
        const regex = this.utils().segmentFilterRegex("chronicles/conversations");
        const files = this.utils().filesWithPath(regex)
            .map(x => x.path);

        const choice = await tp.system.suggester(files, files);
        if (choice) {
            const file = tp.file.find_tfile(choice);
            const fileCache = this.app.metadataCache.getFileCache(file);
            const title = fileCache.frontmatter && fileCache.frontmatter.aliases
                ? fileCache.frontmatter.aliases[0]
                : file.basename;

            result = `\n- [**${title}**](${file.path}#${day})\n`;
            result += `    ![${day}](${file.path}#${day})\n`;

            const headings = fileCache.headings
                .filter(x => x.level == 2);
            if (!headings || headings.length == 0) {
                await this.app.vault.process(file, (content) => {
                    return content + `\n\n## ${day}\n`;
                });
            } else if (headings[0].heading != day) {
                await this.app.vault.process(file, (content) => {
                    const split = content.split("\n");
                    split.splice(headings[0].position.start.line, 0, `## ${day}\n\n`);
                    return split.join("\n");
                });
            }
        }
        return result;
    }

    /**
     * Find the current line in the active file and extract relevant information.
     * @param {Templater} tp The templater plugin instance.
     * @returns {Promise<LineInfo>} An object containing the title, path, heading, and text of the current line.
     */
    findLine = async (tp: Templater): Promise<LineInfo> => {
        let line = undefined;

        const split = tp.file.content.split("\n");
        const file = tp.file.find_tfile(tp.file.title);
        const fileCache = this.app.metadataCache.getFileCache(file);
        const title = this.utils().fileTitle(file);

        const view = this.app.workspace.getActiveViewOfType(window.customJS.obsidian.MarkdownView);
        if (view) {
            const cursor = view.editor.getCursor("from").line;
            line = split[cursor];
        }

        let heading = undefined;
        let text = undefined;

        if (line && line.match(/^\s*- .*/)) {
            // Extract text from a task item
            text = line.replace(/^\s*- (?:\[.\] )?(.*)/, "$1").trim();
        } else {
            if (!line || !line.startsWith('#')) {
                // No line, or the line isn't a heading: Find the first h2 heading in the file
                const headings = fileCache.headings
                    .filter(x => x.level == 2);
                line = split[headings[0]?.position.start.line];
            }
            // Extract text from a heading
            heading = line.replace(/#+ /, "").trim();
        }

        return {
            title,
            path: tp.file.path(true),
            heading,
            text
        }
    }

    /**
     * Prompt the user to choose a file and push text to it.
     * @param {Templater} tp The templater plugin instance.
     * @returns {Promise<string>}
     */
    pushText = async (tp: Templater): Promise<void> => {
        const choice = await this.chooseFile(tp);
        if (choice) {
            const lineInfo = await this.findLine(tp);
            if (lineInfo.heading) {
                // pushing header references
                await this.doPushHeader(tp, choice, lineInfo);
            } else {
                // pushing tasks or log items
                await this.doPushText(tp, choice, lineInfo);
            }
        }
    }

    /**
     * Push Header link to the specified file.
     * - Templater prompt with suggester to choose the kind of text to push (Section, Log item, Tasks item)
     * @param {Templater} tp The templater plugin instance.
     * @param {string} choice The file path to push the header to.
     * @param {LineInfo} line information about the line being pushed
     * @returns {Promise<void>}
     */
    doPushHeader = async (tp: Templater, choice: string, line: LineInfo): Promise<void> => {
        const type = await tp.system.suggester(this.headerPush, this.headerPush);
        const date = line.heading.replace(/^.*?(\d{4}-\d{2}-\d{2}).*$/, `$1`);
        const interesting = line.heading.replace(/\s*\d{4}-\d{2}-\d{2}\s*/, '');
        const pretty = line.path.contains("conversations") ? `**${line.title}**` : `_${line.title}_`;
        const linkText = line.path == choice ? '⤴' : `${pretty}`;
        const lineText = interesting ? interesting : '';

        console.log("PUSH HEADER", line, date, interesting, linkText, lineText);

        const anchor = line.heading
            .replace(/\s+/g, ' ')
            .replace(/:/g, '')
            .replace(/ /g, '%20');

        switch (type) {
            case 'Section': {
                // Create a new section with the heading and title
                let addThis = `## ${line.heading} ${line.title}\n`;
                addThis += `![invisible-embed](${line.path}#${anchor})\n\n`;

                const file = tp.file.find_tfile(choice);
                const fileCache = this.app.metadataCache.getCache(choice);
                const headings = fileCache.headings
                    .filter(x => x.level == 2);

                await this.app.vault.process(file, (content) => {
                    const split = content.split("\n");
                    if (headings && headings[0]) {
                        // insert in front of first h2 heading
                        split.splice(headings[0].position.start.line, 0, addThis);
                    } else {
                        // no other headings, just create the new section
                        split.push("");
                        split.push(addThis);
                    }
                    // rejoin the file content
                    return split.join("\n");
                });
                break;
            }
            case 'Tasks item': {
                // Create a new task
                const addThis = `- [ ] [${linkText}](${line.path}#${anchor}): ${lineText}\n`;
                this.addToSection(tp, choice, addThis, 'Tasks');
                break;
            }
            default: { // Log section
                const toDaily = this.dated.test(choice);
                const fromDaily = this.dated.test(line.path);
                const isWeekly = choice.endsWith("_week.md");

                // daily log sections are not tasks.
                const task = !toDaily || isWeekly ? '[x] ' : '';
                // add completion date to tasks
                // if from a daily note, link to it at the end of the line (just like a completion date)
                // otherwise, add the note link as a prefix
                const prefix = fromDaily
                        ? ''
                        : `[${linkText}](${line.path}#${anchor}): `;
                const completed = task
                        ? (fromDaily ? `([${linkText}](${line.path}#${anchor}))` : ` (${date})`)
                        : '';

                const addThis = `- ${task}${prefix}${lineText}${completed}`;
                this.addToSection(tp, choice, addThis);
                break;
            }
        }
    }

    /**
     * Push text to a specified file.
     * @param {Templater} tp The templater plugin instance.
     * @param {string} choice The file path to push the text to.
     * @param {LineInfo} line information about the line being pushed
     * @returns {Promise<void>}
     */
    doPushText = async (tp: Templater, choice: string, line: LineInfo): Promise<void> => {
        const type = await tp.system.suggester(this.itemPush, this.itemPush);
        const fromDaily = this.dated.test(line.path);
        const isDaily = this.dated.test(choice);
        const lineDate = line.text.match(this.dated);
        const pretty = line.path.contains("conversations") ? `**${line.title}**` : `_${line.title}_`;
        const date = lineDate
                ? lineDate[1]
                : (fromDaily ? fromDaily[1] : window.moment().format('YYYY-MM-DD'));
        console.log("PUSH TEXT", `"${line.path}"`, `"${line.text}"`, `"${date}"`);

        switch (type) {
            case 'Tasks item': { // Tasks section
                const from = isDaily ? '' : ` from [${pretty}](${line.path})`;
                const addThis = `- [ ] ${line.text}${from}\n`;
                this.addToSection(tp, choice, addThis, 'Tasks');
                break;
            }
            default: { // Log section
                const from = isDaily ? '' : `[${pretty}](${line.path}): `;
                const isWeekly = choice.endsWith("_week.md");
                const task = (!isDaily || isWeekly) ? '[x] ' : '';
                const completed = task && !lineDate ? ` (${date})` : '';
                const addThis = `- ${task}${from}${line.text}${completed}`;
                this.addToSection(tp, choice, addThis);
                break;
            }
        }
    }
}

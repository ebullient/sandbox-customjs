import {
    App,
    FrontMatterCache,
    TFile,
} from "obsidian";
import { CompareFn, Conditions, FileFilterFn, Utils } from "./_utils";
import { EngineAPI } from "./@types/jsengine.types";
import { Templater } from "./@types/templater.types";

export class AreaPriority {
    app: App;

    urgent = ['yes', 'no'];
    important = ['yes', 'no'];
    role = ['owner', 'collaborator', 'observer']
    unknown = '??';

    priorityVisual: string[];

    roleVisual: Record<string, string> = {
        'owner': '🖐',
        'collaborator': '🤝',
        'observer': '👀',
    }
    status = [
        'active',
        'ongoing',
        'brainstorming',
        'blocked',
        'inactive',
        'complete',
        'ignore'
    ];
    statusVisual: Record<string, string> = {
        'active': '\ud83c\udfca\u200d\u2640\ufe0f', // 🏊‍♀️
        'blocked': '🧱',
        'brainstorming': '🧠',
        'ongoing': '\ud83d\udd1b', // 🔛
        'inactive': '\ud83d\udca4', // 💤
        'complete': '\ud83c\udfc1', // '🏁',
        'ignore': '\ud83e\udee3' // 🫣
    }

    constructor() {
        this.app = window.customJS.app;

        const urgent = '\u23f0'; // ⏰
        const important = '!!'; // ‼️
        const one = '\u0031\ufe0f\u20e3';
        const two = '\u0032\ufe0f\u20e3';
        const three = '\u0033\ufe0f\u20e3';
        const four = '\u0034\ufe0f\u20e3';

        this.priorityVisual = [this.unknown, `${one}${important}${urgent}`, `${two}${important}`, `${three}${urgent}`, `${four}`];

        console.log("loaded AreaPriority");
    }

    utils = (): Utils => window.customJS.Utils;

    /**
     * Create a markdown list of all projects matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {boolean} archived Whether to include archived projects.
     * @param {string|Array} [orOther=''] Additional conditions to apply.
     * @returns {string} A markdown list of all projects matching the specified conditions.
     * @see isArchived
     * @see isProject
     * @see priorityFilesMatchingCondition
     * @see showPriority
     * @see showRole
     * @see showStatus
     * @see utils.filterByConditions
     * @see utils.markdownLink
     */
    allProjects = (engine: EngineAPI, archived: boolean, orOther: Conditions = '') => {
        const list = this.priorityFilesMatchingCondition(
            (tfile: TFile) => this.isProject(tfile) && this.isArchived(tfile, archived))
            .map((tfile: TFile) => `- ${this.showPriority(tfile)}${this.showStatus(tfile)}${this.showRole(tfile)} ${this.utils().markdownLink(tfile)}`);

        return engine.markdown.create(list.join("\n"));
    }

    /**
     * Templater prompt with suggester to choose whether a task is urgent.
     * @param {Tp} tp The templater plugin instance.
     * @returns {Promise<string>} The user's choice of urgency.
     */
    chooseUrgent = async (tp: Templater): Promise<string> => {
        return await tp.system.suggester(['urgent', 'not urgent'], this.urgent);
    }

    /**
     * Templater prompt with suggester to choose whether a task is important.
     * @param {Tp} tp The templater plugin instance.
     * @returns {Promise<string>} The user's choice of importance.
     */
    chooseImportant = async (tp: Templater): Promise<string> => {
        return await tp.system.suggester(['important', 'not important'], this.important);
    }

    /**
     * Templater prompt with suggester to choose a status for a task.
     * @param {Tp} tp The templater plugin instance.
     * @returns {Promise<string>} The user's choice of status.
     */
    chooseStatus = async (tp: Templater) => {
        return await tp.system.suggester(this.status, this.status);
    }

    /**
     * Templater prompt with suggester to choose a role for a task.
     * @param {Tp} tp The templater plugin instance.
     * @returns {Promise<string>} The user's choice of role.
     */
    chooseRole = async (tp: Templater) => {
        return await tp.system.suggester(this.role, this.role);
    }

    /**
     * Retrieves the priority visual representation for a file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} The priority visual representation for the file.
     * @see priorityVisual
     * @see utils.frontmatter
     */
    filePriority = (tfile: TFile): string => {
        const fm = this.utils().frontmatter(tfile);
        return this.priorityVisual[this.priority(fm)];
    }

    /**
     * Retrieves the role visual representation for a file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} The role visual representation for the file.
     * @see roleVisual
     * @see utils.frontmatter
     */
    fileRole = (tfile: TFile): string => {
        const fm = this.utils().frontmatter(tfile);
        return fm.role
            ? this.roleVisual[fm.role]
            : this.unknown;
    }

    /**
     * Retrieves the status visual representation for a file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} The status visual representation for the file.
     * @see statusVisual
     * @see utils.frontmatter
     */
    fileStatus = (tfile: TFile): string => {
        const fm = this.utils().frontmatter(tfile);
        if (fm.status && fm.status.match(/(completed|closed|done)/)) {
            fm.status = 'complete';
        }
        return fm.status
            ? this.statusVisual[fm.status]
            : this.unknown;
    }

    /**
     * Test if a file is archived.
     * @param {TFile} tfile The file to examine.
     * @param {boolean} archived Archived status to test
     * @returns {boolean} True if the file's archive state matches the specified status, false otherwise.
     */
    isArchived = (tfile: TFile, archived: boolean): boolean => {
        return tfile.path.includes("archives") === archived;
    }

    /**
     * Determines if a file is an area.
     * @param {TFile} tfile The file to examine.
     * @returns {boolean} True if the file is an area, false otherwise.
     */
    isArea = (tfile: TFile): boolean => {
        const type = this.utils().frontmatter(tfile).type;
        return type && type === "area";
    }

    /**
     * Determines if a file is a project.
     * @param {TFile} tfile The file to examine.
     * @returns {boolean} True if the file is a project, false otherwise.
     */
    isProject = (tfile: TFile): boolean => {
        const type = this.utils().frontmatter(tfile).type;
        return type && type.match(/(project|quest)/);
    }

    /**
     * Determines if a file is a project or area.
     * @param {TFile} tfile The file to examine.
     * @returns {boolean} True if the file is a project or area, false otherwise.
     */
    isProjectArea = (tfile: TFile): boolean => {
        const type = this.utils().frontmatter(tfile).type;
        return type && type.match(/(project|quest|area)/);
    }

    /**
     * Create an index of other related items (not projects or areas)
     * within the same folder as the current file or matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} conditions Additional conditions to apply.
     * @returns {string} An index of other related items.
     * @see utils.filterByPath
     * @see utils.filterByConditions
     */
    otherRelatedItemsIndex = (engine: EngineAPI, conditions: Conditions) => {
        const current = this.app.workspace.getActiveFile();
        const pathRegex = this.utils().segmentFilterRegex(current.parent.path);
        const compiledConditions = this.utils().createFileConditionFilter(conditions);

        const list = this.utils().filesMatchingCondition((tfile: TFile) => {
            return this.isProjectArea(tfile)
                ? false
                : (this.utils().filterByPath(tfile, pathRegex) || compiledConditions(tfile));
        });
        return this.utils().index(engine, list);
    }

    /**
     * Determine the priority level of a file based on its frontmatter.
     * @param {FrontMatterCache} fm The frontmatter of the file.
     * @returns {number} The priority level of the file.
     */
    priority = (fm: FrontMatterCache): number => {
        if (fm.important == 'yes') {
            return fm.urgent == 'yes' ? 1 : 2;
        }
        return fm.urgent == 'yes' ? 3 : 4;
    }

    /**
     * Retrieve files matching a specified condition and sorts them by priority.
     * @param {FileFilterFn} fn The filter function to apply to files.
     * @returns {Array<TFile>} An array of files matching the specified condition, sorted by priority.
     * @see sortProjects
     */
    priorityFilesMatchingCondition = (fn: FileFilterFn): Array<TFile> => {
        const current = this.app.workspace.getActiveFile();
        return this.app.vault.getMarkdownFiles()
            .filter(tfile => tfile !== current)
            .filter(tfile => fn(tfile))
            .sort(this.sortProjects);
    }

    /**
     * Create a markdown list of related areas matching the specified conditions.
     * Will constrain to archived areas if the current file is archived.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of related areas matching the specified conditions.
     * @see relatedAreasList
     */
    relatedAreas = (engine: EngineAPI, conditions: Conditions = ''): string => {
        const current = this.app.workspace.getActiveFile();
        return this.relatedAreasList(engine, current.path.contains("archives"), conditions);
    }

    /**
     * Create a markdown list of active related areas matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of active related areas matching the specified conditions.
     * @see relatedAreasList
     */
    relatedAreasActive = (engine: EngineAPI, conditions = '') => {
        return this.relatedAreasList(engine, false, conditions);
    }

    /**
     * Create a markdown list of archived related areas matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of archived related areas matching the specified conditions.
     * @see relatedAreasList
     */
    relatedAreasArchived = (engine: EngineAPI, conditions = '') => {
        return this.relatedAreasList(engine, true, conditions);
    }

    /**
     * Create a markdown list of related areas matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {boolean} archived Whether to include archived areas.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of related areas matching the specified conditions.
     * @see isArchived
     * @see isArea
     * @see priorityFilesMatchingCondition
     * @see showRole
     * @see utils.filterByConditions
     * @see utils.filterByPath
     * @see utils.markdownLink
     */
    relatedAreasList = (engine: EngineAPI, archived: boolean, conditions: Conditions = '') => {
        const current = this.app.workspace.getActiveFile();
        const pathRegex = this.utils().segmentFilterRegex(current.parent.path);
        const compiledConditions = this.utils().createFileConditionFilter(conditions);

        const list = this.priorityFilesMatchingCondition((tfile: TFile) => {
            const areaIncluded = this.isArea(tfile) && this.isArchived(tfile, archived)
            const inFolder = this.utils().filterByPath(tfile, pathRegex);
            return conditions
                ? areaIncluded && (inFolder || compiledConditions(tfile))
                : areaIncluded && inFolder;
        }).map((tfile: TFile) => `- ${this.showRole(tfile)} ${this.utils().markdownLink(tfile)}`);

        return engine.markdown.create(list.join("\n"));
    }

    /**
     * Create a markdown list of related projects matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of related projects matching the specified conditions.
     * @see relatedProjectsList
     */
    relatedProjects = (engine: EngineAPI, conditions = ''): string => {
        const current = this.app.workspace.getActiveFile();
        return this.relatedProjectsList(engine, current.path.contains("archives"), conditions);
    }

    /**
     * Create a markdown list of active related projects matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of active related projects matching the specified conditions.
     * @see relatedProjectsList
     */
    relatedProjectsActive = (engine: EngineAPI, conditions = '') => {
        return this.relatedProjectsList(engine, false, conditions);
    }

    /**
     * Create a markdown list of archived related projects matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of archived related projects matching the specified conditions.
     * @see relatedProjectsList
     */
    relatedProjectsArchived = (engine: EngineAPI, conditions = '') => {
        return this.relatedProjectsList(engine, true, conditions);
    }

    /**
     * Create a markdown list of related projects matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {boolean} archived Whether to include archived projects.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of related projects matching the specified conditions.
     * @see isArchived
     * @see isProject
     * @see priorityFilesMatchingCondition
     * @see showPriority
     * @see showRole
     * @see showStatus
     * @see utils.filterByConditions
     * @see utils.filterByPath
     * @see utils.markdownLink
     */
    relatedProjectsList = (engine: EngineAPI, archived: boolean, conditions: Conditions = '') => {
        const current = this.app.workspace.getActiveFile();
        const pathRegex = this.utils().segmentFilterRegex(current.parent.path);
        const compiledConditions = this.utils().createFileConditionFilter(conditions);

        const list = this.priorityFilesMatchingCondition((tfile: TFile) => {
            const projectIncluded = this.isProject(tfile) && this.isArchived(tfile, archived)
            const inFolder = this.utils().filterByPath(tfile, pathRegex);
            return conditions
                ? projectIncluded && (inFolder || compiledConditions(tfile))
                : projectIncluded && inFolder;
        }).map((tfile: TFile) => `- ${this.showPriority(tfile)}${this.showStatus(tfile)}${this.showRole(tfile)} ${this.utils().markdownLink(tfile)}`);

        return engine.markdown.create(list.join("\n"));
    }

    /**
     * Generates the HTML for displaying the priority of a file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} The HTML for displaying the priority of the file.
     * @see priorityVisual
     */
    showPriority = (tfile: TFile): string => {
        const fm = this.utils().frontmatter(tfile);
        return `<span class="ap-priority">${this.priorityVisual[this.priority(fm)]}</span>`
    }

    /**
     * Generates the HTML for displaying the role of a file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} The HTML for displaying the role of the file.
     * @see roleVisual
     */
    showRole = (tfile: TFile): string => {
        const fm = this.utils().frontmatter(tfile);
        const role = fm.role
            ? this.roleVisual[fm.role]
            : this.unknown;
        return `<span class="ap-role">${role}</span>`
    }

    /**
     * Generates the HTML for displaying the status of a file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} The HTML for displaying the status of the file.
     * @see statusVisual
     */
    showStatus = (tfile: TFile): string => {
        const fm = this.utils().frontmatter(tfile);
        if (fm.status && fm.status.match(/(completed|closed|done)/)) {
            fm.status = 'complete';
        }
        const status = fm.status
            ? this.statusVisual[fm.status]
            : this.unknown;
        return `<span class="ap-status">${status}</span>`
    }

    /**
     * Sorts projects based on priority, status, role, and name.
     * @param {TFile} tfile1 The first file to compare.
     * @param {TFile} tfile2 The second file to compare.
     * @returns {number} A negative number if tfile1 should come before tfile2,
     *      a positive number if tfile1 should come after tfile2,
     *      or 0 if they are considered equal.
     * @see test
     * @see testName
     * @see testPriority
     */
    sortProjects = (tfile1: TFile, tfile2: TFile): number => {
        const fm1 = this.utils().frontmatter(tfile1);
        const fm2 = this.utils().frontmatter(tfile2);
        return this.testPriority(fm1, fm2,
            () => this.test(fm1, fm2, this.status, 'status',
                () => this.test(fm1, fm2, this.role, 'role',
                    () => this.testName(tfile1, tfile2))));
    }

    /**
     * Compares two files based on a specified field and fallback function.
     * @param {Object} fm1 The frontmatter of the first file.
     * @param {Object} fm2 The frontmatter of the second file.
     * @param {Array} values The array of possible values for the field.
     * @param {string} field The field to compare.
     * @param {CompareFn} fallback The fallback function to use if the field values are equal.
     * @returns {number} A negative number if fm1 should come before fm2,
     *      a positive number if fm1 should come after fm2,
     *      or the result of the fallback function if they are considered equal.
     */
    test = (fm1: FrontMatterCache, fm2: FrontMatterCache, values: string[], field: string, fallback: CompareFn): number => {
        const test1 = values.indexOf(fm1[field]);
        const test2 = values.indexOf(fm2[field]);
        if (test1 == test2) {
            return fallback();
        }
        return test1 - test2;
    }

    /**
     * Compares two files based on priority and a fallback function.
     * @param {Object} fm1 The frontmatter of the first file.
     * @param {Object} fm2 The frontmatter of the second file.
     * @param {CompareFn} fallback The fallback function to use if the priority values are equal.
     * @returns {number} A negative number if fm1 should come before fm2,
     *      a positive number if fm1 should come after fm2,
     *      or the result of the fallback function if they are considered equal.
     */
    testPriority = (fm1: FrontMatterCache, fm2: FrontMatterCache, fallback: CompareFn): number => {
        const test1 = this.priority(fm1);
        const test2 = this.priority(fm2)
        if (test1 == test2) {
            return fallback();
        }
        return test1 - test2;
    }
    /**
     * Compares two files based on their names.
     * @param {TFile} tfile1 The first file to compare.
     * @param {TFile} tfile2 The second file to compare.
     * @returns {number} A negative number if tfile1 should come before tfile2,
     *      a positive number if tfile1 should come after tfile2,
     *      or 0 if they are considered equal.
     */
    testName = (tfile1: TFile, tfile2: TFile): number => {
        return tfile1.name.localeCompare(tfile2.name);
    }
}

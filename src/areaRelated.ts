import type { App, TFile } from "obsidian";
import type { EngineAPI } from "./@types/jsengine.types";
import type { TaskIndex } from "./@types/taskIndex.types";
import type { Templater } from "./@types/templater.types";
import type { Conditions, FileFilterFn, Utils } from "./_utils";

export class AreaRelated {
    app: App;

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded AreaRelated");
    }

    utils = (): Utils => window.customJS.Utils;

    taskIndex = (): TaskIndex => window.taskIndex.api;

    /**
     * Create a markdown list of all projects matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {boolean} archived Whether to include archived projects.
     * @param {string|Array} [orOther=''] Additional conditions to apply.
     * @returns {string} A markdown list of all projects matching the specified conditions.
     */
    allProjects = (
        engine: EngineAPI,
        archived: boolean,
        orOther: Conditions = "",
    ) => {
        const testFn = this.utils().createFileConditionFilter(orOther);
        const list = this.filesMatchingCondition(
            (tfile: TFile) =>
                this.isProject(tfile) &&
                this.isArchived(tfile, archived) &&
                testFn(tfile),
        ).map(
            (tfile: TFile) =>
                `- ${this.showRole(tfile)} ${this.utils().markdownLink(tfile)}`,
        );

        return engine.markdown.create(list.join("\n"));
    };

    /**
     * Templater prompt with suggester to choose a role for a project/area.
     * @param {Tp} tp The templater plugin instance.
     * @returns {Promise<string>} The user's choice of role.
     */
    chooseRole = async (tp: Templater) => {
        const roles = this.taskIndex().getValidRoles();
        return await tp.system.suggester(roles, roles);
    };

    /**
     * Templater prompt with suggester to choose a sphere for a project/area.
     * @param {Tp} tp The templater plugin instance.
     * @returns {Promise<string>} The user's choice of sphere.
     */
    chooseSphere = async (tp: Templater) => {
        const spheres = this.taskIndex().getValidSpheres();
        return await tp.system.suggester(spheres, spheres);
    };

    /**
     * Retrieves the role visual representation for a file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} The role visual representation for the file.
     */
    fileRole = (tfile: TFile): string => {
        const fm = this.utils().frontmatter(tfile);
        return this.taskIndex().getRoleVisual(fm.role);
    };

    /**
     * Retrieves the role visual representation for a file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} The role visual representation for the file.
     */
    fileSphere = (tfile: TFile): string => {
        const fm = this.utils().frontmatter(tfile);
        return fm.sphere;
    };

    /**
     * Test if a file is archived.
     * @param {TFile} tfile The file to examine.
     * @param {boolean} archived Archived status to test
     * @returns {boolean} True if the file's archive state matches the specified status, false otherwise.
     */
    isArchived = (tfile: TFile, archived: boolean): boolean => {
        return tfile.path.includes("archives") === archived;
    };

    /**
     * Determines if a file is an area.
     * @param {TFile} tfile The file to examine.
     * @returns {boolean} True if the file is an area, false otherwise.
     */
    isArea = (tfile: TFile): boolean => {
        const type = this.utils().frontmatter(tfile).type;
        return type && type === "area";
    };

    /**
     * Determines if a file is a project.
     * @param {TFile} tfile The file to examine.
     * @returns {boolean} True if the file is a project, false otherwise.
     */
    isProject = (tfile: TFile): boolean => {
        const type = this.utils().frontmatter(tfile).type;
        return type?.match(/(project|quest)/);
    };

    /**
     * Determines if a file is a project or area.
     * @param {TFile} tfile The file to examine.
     * @returns {boolean} True if the file is a project or area, false otherwise.
     */
    isProjectArea = (tfile: TFile): boolean => {
        const type = this.utils().frontmatter(tfile).type;
        return type?.match(/(project|quest|area)/);
    };

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
        const compiledConditions =
            this.utils().createFileConditionFilter(conditions);

        const list = this.utils().filesMatchingCondition((tfile: TFile) => {
            return this.isProjectArea(tfile)
                ? false
                : this.utils().filterByPath(tfile, pathRegex) ||
                      compiledConditions(tfile);
        });
        return this.utils().index(engine, list);
    };

    /**
     * Retrieve files matching a specified condition and sorts them by role and name.
     * @param {FileFilterFn} fn The filter function to apply to files.
     * @returns {Array<TFile>} An array of files matching the specified condition, sorted by role and name.
     * @see sortProjects
     */
    filesMatchingCondition = (fn: FileFilterFn): Array<TFile> => {
        const current = this.app.workspace.getActiveFile();
        return this.app.vault
            .getMarkdownFiles()
            .filter((tfile) => tfile !== current)
            .filter((tfile) => fn(tfile))
            .sort(this.sortProjects);
    };

    /**
     * Create a markdown list of related areas matching the specified conditions.
     * Will constrain to archived areas if the current file is archived.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of related areas matching the specified conditions.
     * @see relatedAreasList
     */
    relatedAreas = (engine: EngineAPI, conditions: Conditions = ""): string => {
        const current = this.app.workspace.getActiveFile();
        return this.relatedAreasList(
            engine,
            current.path.contains("archives"),
            conditions,
        );
    };

    /**
     * Create a markdown list of active related areas matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of active related areas matching the specified conditions.
     * @see relatedAreasList
     */
    relatedAreasActive = (engine: EngineAPI, conditions = "") => {
        return this.relatedAreasList(engine, false, conditions);
    };

    /**
     * Create a markdown list of archived related areas matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of archived related areas matching the specified conditions.
     * @see relatedAreasList
     */
    relatedAreasArchived = (engine: EngineAPI, conditions = "") => {
        return this.relatedAreasList(engine, true, conditions);
    };

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
    relatedAreasList = (
        engine: EngineAPI,
        archived: boolean,
        conditions: Conditions = "",
    ) => {
        const current = this.app.workspace.getActiveFile();
        const pathRegex = this.utils().segmentFilterRegex(current.parent.path);
        const compiledConditions =
            this.utils().createFileConditionFilter(conditions);

        const list = this.filesMatchingCondition((tfile: TFile) => {
            const areaIncluded =
                this.isArea(tfile) && this.isArchived(tfile, archived);
            const inFolder = this.utils().filterByPath(tfile, pathRegex);
            return conditions
                ? areaIncluded && (inFolder || compiledConditions(tfile))
                : areaIncluded && inFolder;
        }).map(
            (tfile: TFile) =>
                `- ${this.showRole(tfile)} ${this.utils().markdownLink(tfile)}`,
        );

        return engine.markdown.create(list.join("\n"));
    };

    /**
     * Create a markdown list of related projects matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of related projects matching the specified conditions.
     * @see relatedProjectsList
     */
    relatedProjects = (engine: EngineAPI, conditions = ""): string => {
        const current = this.app.workspace.getActiveFile();
        return this.relatedProjectsList(
            engine,
            current.path.contains("archives"),
            conditions,
        );
    };

    /**
     * Create a markdown list of active related projects matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of active related projects matching the specified conditions.
     * @see relatedProjectsList
     */
    relatedProjectsActive = (engine: EngineAPI, conditions = "") => {
        return this.relatedProjectsList(engine, false, conditions);
    };

    /**
     * Create a markdown list of archived related projects matching the specified conditions.
     * @param {EngineAPI} engine The engine to create markdown.
     * @param {string|Array} [conditions=''] Additional conditions to apply.
     * @returns {string} A markdown list of archived related projects matching the specified conditions.
     * @see relatedProjectsList
     */
    relatedProjectsArchived = (engine: EngineAPI, conditions = "") => {
        return this.relatedProjectsList(engine, true, conditions);
    };

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
    relatedProjectsList = (
        engine: EngineAPI,
        archived: boolean,
        conditions: Conditions = "",
    ) => {
        const current = this.app.workspace.getActiveFile();
        const pathRegex = this.utils().segmentFilterRegex(current.parent.path);
        const compiledConditions =
            this.utils().createFileConditionFilter(conditions);

        const list = this.filesMatchingCondition((tfile: TFile) => {
            const projectIncluded =
                this.isProject(tfile) && this.isArchived(tfile, archived);
            const inFolder = this.utils().filterByPath(tfile, pathRegex);
            return conditions
                ? projectIncluded && (inFolder || compiledConditions(tfile))
                : projectIncluded && inFolder;
        }).map(
            (tfile: TFile) =>
                `- ${this.showRole(tfile)} ${this.utils().markdownLink(tfile)}`,
        );

        return engine.markdown.create(list.join("\n"));
    };

    /**
     * Generates the HTML for displaying the role of a file.
     * @param {TFile} tfile The file to examine.
     * @returns {string} The HTML for displaying the role of the file.
     * @see roleVisual
     */
    showRole = (tfile: TFile): string => {
        const fm = this.utils().frontmatter(tfile);
        const sphere = fm.sphere
            ? `<span class="ap-sphere">${fm.sphere}</span>`
            : "";
        const role = this.taskIndex().getRoleVisual(fm.role);
        return `<span class="ap-role">${role}</span>${sphere}`;
    };

    /**
     * Sorts projects based on role and name.
     * @param {TFile} tfile1 The first file to compare.
     * @param {TFile} tfile2 The second file to compare.
     * @returns {number} A negative number if tfile1 should come before tfile2,
     *      a positive number if tfile1 should come after tfile2,
     *      or 0 if they are considered equal.
     */
    sortProjects = (tfile1: TFile, tfile2: TFile): number => {
        const fm1 = this.utils().frontmatter(tfile1);
        const fm2 = this.utils().frontmatter(tfile2);

        // Sort by sphere first (only if both have spheres)
        if (fm1.sphere && fm2.sphere) {
            const sphere = fm1.sphere.localeCompare(fm2.sphere);
            if (sphere !== 0) {
                return sphere;
            }
        }

        // Sort by role
        const sortRole = this.taskIndex().compareRoles(fm1.role, fm2.role);
        if (sortRole !== 0) {
            return sortRole;
        }

        // Then by name
        return tfile1.name.localeCompare(tfile2.name);
    };
}

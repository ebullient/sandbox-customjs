import type { TFile } from "obsidian";
import type { CurrentSettings, QuestFile } from "./@types";
import type { EngineAPI } from "./@types/jsengine.types";
import type { QuestIndex } from "./taskindex-QuestIndex";
import type { TaskEngine } from "./taskindex-TaskEngine";

/**
 * Public API for CustomJS scripts and templates
 * Provides access to quest index, task engine, and configuration
 */
export class TaskIndexAPI {
    constructor(
        private index: QuestIndex,
        private settings: CurrentSettings,
        private taskEngine: TaskEngine,
    ) {}

    // ============================================================
    // Configuration Constants
    // ============================================================

    /**
     * Get valid role options.
     * @returns {string[]} Array of valid role values.
     */
    getValidRoles = (): string[] => {
        return ["owner", "collaborator", "observer"];
    };

    compareRoles = (role1: string, role2: string): number => {
        const roles = this.getValidRoles();
        return roles.indexOf(role1) - roles.indexOf(role2);
    };

    /**
     * Get role visual representation.
     * @param {string} role The role value from frontmatter.
     * @returns {string} The visual emoji for the role.
     */
    getRoleVisual = (role?: string): string => {
        const roleVisual: Record<string, string> = {
            owner: "🖐",
            collaborator: "🤝",
            observer: "👀",
        };
        return role ? roleVisual[role] || "??" : "??";
    };

    /**
     * Get valid sphere options from settings.
     * @returns {string[]} Array of valid sphere values.
     */
    getValidSpheres = (): string[] => {
        return this.settings.current().validSpheres;
    };

    // ============================================================
    // Quest Index Access
    // ============================================================

    /**
     * Get all indexed quests.
     * @returns {QuestFile[]} Array of all quest files.
     */
    getAllQuests = (): QuestFile[] => {
        return this.index.getAllQuests();
    };

    /**
     * Get a specific quest by path.
     * @param {string} path The file path.
     * @returns {QuestFile | undefined} The quest file or undefined.
     */
    getQuest = (path: string): QuestFile | undefined => {
        return this.index.getQuest(path);
    };

    /**
     * Get all quests in a specific sphere.
     * @param {string} sphere The sphere name.
     * @returns {QuestFile[]} Array of quest files in the sphere.
     */
    getQuestsBySphere = (sphere: string): QuestFile[] => {
        return this.index.getQuestsBySphere(sphere);
    };

    // ============================================================
    // Task Service Methods (for CustomJS scripts)
    // ============================================================

    /**
     * Generate completed tasks for a week (Monday-Sunday)
     * Used by weekly planning files
     * @param {TFile} current Current (weekly) file
     * @returns {Promise<string>} Markdown formatted task list
     */
    generateWeeklyTasks = async (current: TFile): Promise<string> => {
        return this.taskEngine.generateWeeklyTasks(current);
    };

    /**
     * Generate completed tasks for a fixed date range with optional tag filter
     * Used by retrospective/review files
     * @param {TFile} current Current (weekly) file
     * @param {string} startDate Date string (YYYY-MM-DD format)
     * @param {string | string[]} tag Optional tag filter
     * @param {boolean} all Match all tags (default: false)
     * @returns {Promise<string>} Markdown formatted task list
     */
    generateFixedWeekTasks = async (
        current: TFile,
        startDate: string,
        tag?: string | string[],
        all = false,
    ): Promise<string> => {
        return this.taskEngine.generateFixedWeekTasks(
            current,
            startDate,
            tag,
            all,
        );
    };

    // ============================================================
    // JSEngine Helper Methods
    // ============================================================

    /**
     * Generate weekly tasks for use in JSEngine templates
     * Automatically detects current file from JSEngine context or active file
     * @param {EngineAPI} engine JSEngine instance
     * @returns {Promise<string>} Markdown formatted task list
     */
    generateWeeklyTasksForEngine = async (
        engine: EngineAPI,
    ): Promise<string> => {
        const current =
            engine.instanceId?.executionContext?.file ||
            engine.app.workspace.getActiveFile();
        return this.taskEngine.generateWeeklyTasks(current);
    };

    /**
     * Generate fixed week tasks for use in JSEngine templates
     * Automatically detects current file from JSEngine context or active file
     * @param {EngineAPI} engine JSEngine instance
     * @param {string} startDate Date string (YYYY-MM-DD format)
     * @param {string | string[]} tag Optional tag filter
     * @param {boolean} all Match all tags (default: false)
     * @returns {Promise<string>} Markdown formatted task list
     */
    generateFixedWeekTasksForEngine = async (
        engine: EngineAPI,
        startDate: string,
        tag?: string | string[],
        all = false,
    ): Promise<string> => {
        const current =
            engine.instanceId?.executionContext?.file ||
            engine.app.workspace.getActiveFile();
        return this.taskEngine.generateFixedWeekTasks(
            current,
            startDate,
            tag,
            all,
        );
    };
}

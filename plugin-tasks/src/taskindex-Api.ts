import type { CurrentSettings, QuestFile } from "./@types";
import type { QuestIndex } from "./taskindex-QuestIndex";

/**
 * Public API for CustomJS scripts and templates
 * Read-only access to quest index and configuration
 */
export class TaskIndexAPI {
    constructor(
        private index: QuestIndex,
        private settings: CurrentSettings,
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
}

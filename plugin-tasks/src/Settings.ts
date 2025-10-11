import type { TaskIndexSettings } from "./@types";

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: TaskIndexSettings = {
    validSpheres: ["work", "home", "community"],
    currentSphereFocus: undefined,

    staleProjectWeeks: 4,
    waitingTaskDays: 14,

    questFolders: ["areas", "projects"],
    validTypes: ["quest", "area", "project", "demesne"],

    purposeTags: ["#me/🎯/🤓", "#me/🧬/creativity/curiosity"],
};

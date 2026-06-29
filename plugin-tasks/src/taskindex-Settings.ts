import type { TaskIndexSettings } from "./@types";

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: TaskIndexSettings = {
    validSpheres: ["work", "home", "community"],

    staleProjectWeeks: 4,
    waitingTaskDays: 14,

    minArchiveLines: 50,

    questFolders: ["areas", "quests", "queue"],
    validTypes: ["quest", "area", "project", "demesne"],

    purposeTags: ["#me/🎯/🤓", "#me/🧬/creativity/curiosity"],

    excludeYears: [],
    workSummaryPattern: "chronicles/work/YYYY/YYYY-MM-DD_work.md",
    journalFormat: "[chronicles/journal/]YYYY[/journal-]YYYY-MM-DD[.md]",

    trackLastModified: true,
};

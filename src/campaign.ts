import type { App, TFile, TFolder } from "obsidian";
import type { RollResult } from "./@types/diceroller.types";
import type { Templater } from "./@types/templater.types";
import type { Utils } from "./_utils";

interface Date {
    year: number;
    month: number;
    monthName: string;
    day: number;
}

interface DateTag {
    date: string;
    tag: string;
    parsed: Date;
}

interface HarptosDay {
    filename: string;
    sort: string;
    heading: string;
    season: string;
    date: { year: number; month: number; day: number };
    monthName: string;
}

interface PrevNext {
    prev?: string;
    prevFile?: string;
    prevName?: string;
    next?: string;
    nextFile?: string;
    nextName?: string;
    tag?: string;
}

export class Campaign {
    EVENT_CODES = [
        "🪕",
        "📰",
        "🧵",
        "👤",
        "😈",
        "🗣️",
        "🗿",
        "🐲",
        "😵",
        "🥸",
        "🦹",
        "👺",
        "💃",
        "🧝🏿",
        "🌿",
        "🪬",
        "🎻",
        "🏰",
        "🌹",
        "🧙‍♀️",
        "👾",
        "⚔️",
        "🐀",
    ];

    monsterSize = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
    monsterType = [
        "Aberration",
        "Beast",
        "Celestial",
        "Construct",
        "Dragon",
        "Elemental",
        "Fey",
        "Fiend",
        "Giant",
        "Humanoid",
        "Monstrosity",
        "Ooze",
        "Plant",
        "Undead",
    ];

    eventRegexp = /(<span[^>]*>)([\s\S]*?)<\/span>/g;

    app: App;

    constructor() {
        // Constructor
        this.app = window.customJS.app;
        console.log("loaded Campaign");
    }

    utils = (): Utils => window.customJS.Utils;

    allTags = (): string[] => this.utils().allTags();

    /**
     * Prompt to select a target folder from a list of potential folders
     * for a new file from a filtered list of subfolders of
     * the specified folder (specify "/" or "" for the vault root)
     */
    chooseFolder = async (
        tp: Templater,
        folderPath: string,
    ): Promise<string> => {
        const folders = this.utils()
            .foldersByCondition(folderPath, (tfolder: TFolder) =>
                this.chooseFolderFilter(tfolder.path),
            )
            .map((f) => f.path);

        if (folders.length > 0) {
            const choice = await tp.system.suggester(folders, folders);
            if (!choice) {
                console.warn("No choice selected. Using 'compendium'");
                return "compendium";
            }
            return choice;
        }
        return folderPath;
    };

    /**
     * Folders that should be skipped when prompting for a folder
     * to add a new note to.
     * @param {string} fullname full path of folder (from vault root)
     * @return {boolean} true to include folder, false to exclude it
     */
    chooseFolderFilter = (fullname: string): boolean =>
        !fullname.startsWith("assets") &&
        !fullname.contains("archive") &&
        !fullname.contains("compendium/5e");

    /**
     * Prompt to select a monster size
     * @param {Templater} tp The templater object
     * @returns {string} The chosen monster size
     */
    chooseMonsterSize = async (tp: Templater): Promise<string> => {
        return await tp.system.suggester(this.monsterSize, this.monsterSize);
    };

    /**
     * Prompt to select a monster type
     * @param {Templater} tp The templater object
     * @returns {string} The chosen monster type
     */
    chooseMonsterType = async (tp: Templater): Promise<string> => {
        return await tp.system.suggester(this.monsterType, this.monsterType);
    };

    /**
     * Prompt to select a tag from a list of potential tags for a new file.
     * The list will contain all tags that match the specified prefix,
     * and will include '--' to indicate none. If no value is chosen,
     * it will return the provided default value.
     * @param {Templater} tp The templater object
     * @param {string[]} allTags All tags in the vault
     * @param {string} prefix The prefix to filter tags by
     * @param {string} defaultValue The default value to use if no value is chosen
     * @returns {string} The chosen tag
     */
    chooseTag = async (
        tp: Templater,
        allTags: string[],
        prefix: string,
        defaultValue: string = undefined,
    ): Promise<string> => {
        const filter = prefix;

        // tags for all files, not current file
        const values = allTags.filter((tag) => tag.startsWith(filter)).sort();
        console.log("chooseTag", filter, defaultValue, values);

        values.unshift("--"); // add to the beginning

        const choice = await tp.system.suggester(values, values);
        if (!choice || choice === "--") {
            console.log(`No choice selected. Using ${defaultValue}`);
            return defaultValue;
        }
        return choice;
    };

    /**
     * Prompt to select a tag from a list of potential tags for a new file.
     * The list will contain all tags that match the specified prefix,
     * and will include '--' to indicate none. If no value is chosen,
     * it will return an empty string.
     * @param {Templater} tp The templater object
     * @param {string} prefix The prefix to filter tags by
     * @returns {string} The chosen tag or an empty string
     */
    chooseTagOrEmpty = async (
        tp: Templater,
        allTags: string[],
        prefix: string,
    ): Promise<string> => {
        const result = await this.chooseTag(tp, allTags, prefix, "--");
        if (result && result !== "--") {
            return result;
        }
        return "";
    };

    /**
     * Map a folder to a tag
     * @param {string} folder full path of folder (from vault root)
     * @returns {string} tag that should be associated with this folder
     */
    folderToTag = (foldername: string): string =>
        foldername.substring(0, foldername.indexOf("/"));

    /**
     * Find the last file in a filtered list of files
     * @param {Templater} tp The templater object
     * @returns {TFile | null} The name of the last file in the current folder
     * @see prevNextFilter
     */
    lastFile = async (tp: Templater, path = ""): Promise<TFile | null> => {
        const folder = path ? path : tp.file.folder(true);

        const pathRegexp = this.utils().segmentFilterRegex(folder);
        const fileList = this.utils()
            .filesWithPath(pathRegexp, true)
            .filter((f) => this.prevNextFilter(f));
        return fileList.length > 0 ? fileList[fileList.length - 1] : null;
    };

    nextSession = async (
        tp: Templater,
        padSize = 3,
        path = "",
    ): Promise<PrevNext> => {
        const lastFile = await this.lastFile(tp, path);
        if (!lastFile) {
            return {
                next: "1",
                nextFile: "001-",
            };
        }
        const session = lastFile.name.replace(/^(\d+).*$/g, "$1");
        const next = Number.parseInt(session, 10) + 1;
        const nextPrefix = `${next}`.padStart(padSize, "0");
        return {
            next: nextPrefix,
            nextName: `${nextPrefix}-`,
            nextFile: `${lastFile.parent.path}/${nextPrefix}-.md`,
            prev: session,
            prevName: lastFile.name.replace(".md", ""),
            prevFile: lastFile.path,
            tag: this.folderToTag(lastFile.parent.path),
        };
    };

    /**
     * Pad a string to two characters with a leading 0 (month or day)
     * @param {string} x
     * @returns {string}
     */
    pad = (x: string | number): string => {
        return `${x}`.padStart(2, "0");
    };

    /**
     * Links for previous and next document (based on name-sort)
     */
    prevNext = async (tp: Templater): Promise<PrevNext> => {
        const folder = tp.file.folder(true);
        const filename = `${tp.file.title}.md`;

        // remove files that don't match the filter from the list
        const pathRegexp = this.utils().segmentFilterRegex(folder);
        const fileList = this.utils()
            .filesWithPath(pathRegexp, true)
            .filter((f) => this.prevNextFilter(f));
        console.log(fileList);

        const result: PrevNext = {};
        for (let i = 0; i < fileList.length; i++) {
            if (fileList[i].name === filename) {
                if (i > 0) {
                    result.prevFile = fileList[i - 1].path;
                    result.prev = `[← previous](${fileList[i - 1].path})`;
                }
                if (i < fileList.length - 1) {
                    result.nextFile = fileList[i + 1].path;
                    result.next = `[next →](${fileList[i + 1].path})`;
                }
                break;
            }
        }
        console.log("prevNext", filename, result);
        // result: { prev?: .., next?: ... }
        return result;
    };

    /**
     * Files that should be skipped when calculating previous and next links.
     * Must return a boolean.
     * @param {TFile} file The file to check
     * @return {boolean} true to include file, false to exclude it
     */
    prevNextFilter = (file: TFile): boolean => {
        return (
            !this.utils().isFolderNote(file) &&
            !file.name.contains("Untitled") &&
            !file.name.contains("encounter")
        ); // encounter log
    };

    /**
     *
     */
    sessionFileNamePattern = (folder: string): RegExp => {
        if (folder.startsWith("witchlight")) {
            return /^session-(\d{3}).*$/g;
        }
        return /^.*(\d{4}-\d{2}-\d{2}).*$/g;
    };

    tableRoll = async (lookup: string): Promise<string> => {
        const current = this.app.workspace.getActiveFile();
        const diceRoller = window.DiceRoller;
        const re = /dice: (\[\]\(.*?\))/g;

        let match = re.exec(lookup);
        let result: RollResult = null;
        let input: string;

        do {
            input = match ? match[1] : lookup;
            result = await diceRoller.parseDice(
                input,
                current ? current.path : "",
            );
            match = re.exec(result.result);
            console.log("tableRoll", input, result.result, match);
        } while (match != null);

        return result.result;
    };

    /**
     * Change a Title string into a desired filename format,
     * e.g. "Pretty Name" to pretty-name (lower-kebab / slugified)
     */
    toFileName = (name: string): string => {
        return this.utils().lowerKebab(name);
    };

    // --- Campaign-specific functions

    // Resolve table roll from template
    faire = async (type: string): Promise<string> => {
        return await this.tableRoll(
            `dice: [](heist/waterdeep/places/sea-maidens-faire.md#^${type})`,
        );
    };

    // Resolve table roll from template
    mood = async (): Promise<string> => {
        return await this.tableRoll(
            "dice: [](assets/tables/mood-tables.md#^mood-table)",
        );
    };

    // Resolve table roll from template
    news = async (): Promise<string> => {
        const paper = await this.tableRoll(
            "dice: [](heist/tables/news.md#^papers)",
        );
        const news = await this.tableRoll(
            "dice: [](heist/tables/news.md#^news)",
        );
        return `${paper} ${news}`;
    };
    thread = async (): Promise<string> => {
        const paper = await this.tableRoll(
            "dice: [](heist/tables/news.md#^papers)",
        );
        const news = await this.tableRoll(
            "dice: [](heist/tables/news.md#^thread)",
        );
        return `${paper} ${news}`;
    };
    reviews = async (): Promise<string> => {
        const paper = await this.tableRoll(
            "dice: [](heist/tables/news.md#^papers)",
        );
        const news = await this.tableRoll(
            "dice: [](heist/tables/news.md#^reviews)",
        );
        return `${paper} ${news}`;
    };
    rumors = async (): Promise<string> => {
        return await this.tableRoll("dice: [](heist/tables/rumors.md#^rumors)");
    };

    // Resolve table roll from template
    tavern = async (type: string): Promise<string> => {
        let result = await this.tableRoll(
            `dice: [](heist/tables/trollskull-manor-tables.md#^${type})`,
        );
        if (type === "visiting-patrons") {
            result = result.replace(/,? ?\(\d+\) /g, "\n    - ");
        }
        while (result.contains("%mood%")) {
            const mood = await this.mood();
            result = result.replace("%mood%", `_[${mood}]_`);
        }
        if (result.contains("🔹")) {
            result = result.replace(/\s*🔹\s*/g, "\n    > ");
            console.log(result);
        }
        return result;
    };

    // Resolve table roll from template
    weather = async (season: string): Promise<string> => {
        return await this.tableRoll(
            `dice: [](heist/tables/waterdeep-weather.md#^${season})`,
        );
    };

    eventSpan = (match: string[], suffix = "") => {
        const text = match[1];
        const sort = text.replace(/.*data-date=['"](.*?)['"].*/g, "$1");
        const date = text.replace(/.*data-date=['"](.*?)-\d{2}['"].*/g, "$1");

        let name = text.contains('data-name="')
            ? text.replace(/.*data-name="(.*?)".*/g, "$1")
            : text.replace(/.*data-name='(.*?)'.*/g, "$1");
        if (!name.endsWith(".") && !name.endsWith("!")) {
            name += ".";
        }

        let data = match[2].trim();
        if (data.length > 0 && !data.endsWith(".") && !data.endsWith("!")) {
            data += ".";
        }

        return `<span class="timeline" data-date="${sort}">\`${date}\` *${name}* ${data} ${suffix}</span>`;
    };

    // Harptos Calendar

    compareHarptosDate = (a: string, b: string): number => {
        const as = a.toLowerCase().split("-");
        const bs = b.toLowerCase().split("-");
        // compare year as[0], then month as[1], then day as[2], then offset as as[3]
        if (as[0] === bs[0]) {
            if (as[1] === bs[1]) {
                if (as[2] === bs[2]) {
                    if (as.length > 3 && bs.length > 3) {
                        return Number(as[3]) - Number(bs[3]);
                    }
                    return 0;
                }
                return Number(as[2]) - Number(bs[2]);
            }
            return this.monthSort(as[1]) - this.monthSort(bs[1]);
        }
        return Number(as[0]) - Number(bs[0]);
    };

    /**
     * Get the faerun season for a given month and day
     * @param {string|number} month a number (human index, or bumped crazy non-human index) or name of the month
     * @param {number} d The day of the month
     * @returns {string} the season
     */
    faerunSeason = (m: string | number, d: number): string => {
        let month = m;
        if (typeof month === "string") {
            month = month.toLowerCase();
        }
        switch (month) {
            case "hammer":
            case 30:
            case 1:
            case "midwinter":
            case 31:
            case "alturiak":
            case 2:
            case 32:
                return "winter";

            case "tarsakh":
            case 34:
            case 4:
            case "mirtul":
            case 36:
            case 5:
            case "greengrass":
            case 35:
                return "spring";

            case "flamerule":
            case 38:
            case 7:
            case "eleasis":
            case 41:
            case 8:
            case "midsummer":
            case 39:
            case "shieldmeet":
            case 40:
                return "summer";

            case "marpenoth":
            case 44:
            case 10:
            case "uktar":
            case 45:
            case 11:
            case "highharvestide":
            case 43:
            case "the feast of the moon":
            case "feast of the moon":
            case 46:
                return "autumn";

            case "ches":
            case 33:
            case 3:
                return d < 19 ? "winter" : "spring";
            case "kythorn":
            case 37:
            case 6:
                return d < 20 ? "spring" : "summer";
            case "elient":
            case 42:
            case 9:
                return d < 21 ? "summer" : "autumn";
            case "nightal":
            case 47:
            case 12:
                return d < 20 ? "autumn" : "winter";
        }
    };

    /**
     * Create a sorting value for months that is out of the confusing
     * human range (where humans use 1-12, but calendarium uses 0-indexed numbers
     * that include intercalary days as months)
     * @param {string} m Month name
     * @returns number for sorting bumped by 30
     */
    monthSort = (m: string): number => {
        switch (m) {
            case "hammer":
                return 30;
            case "midwinter":
                return 31;
            case "alturiak":
                return 32;
            case "ches":
                return 33;
            case "tarsakh":
                return 34;
            case "greengrass":
                return 35;
            case "mirtul":
                return 36;
            case "kythorn":
                return 37;
            case "flamerule":
                return 38;
            case "midsummer":
                return 39;
            case "shieldmeet":
                return 40;
            case "eleasis":
                return 41;
            case "eleint":
                return 42;
            case "highharvestide":
                return 43;
            case "marpenoth":
                return 44;
            case "uktar":
                return 45;
            case "feast":
            case "feast of the moon":
                return 46;
            case "nightal":
                return 47;
        }
    };

    /**
     * Map the month and day to pretty names according to the Harptos Calendar.
     */
    monthName = (m: string | number): string => {
        if (typeof m === "string") {
            return m;
        }

        switch (m) {
            case 30:
            case 1:
                return "Hammer";
            case 31:
                return "Midwinter";
            case 32:
            case 2:
                return "Alturiak";
            case 33:
            case 3:
                return "Ches";
            case 34:
            case 4:
                return "Tarsakh";
            case 35:
                return "Greengrass";
            case 36:
            case 5:
                return "Mirtul";
            case 37:
            case 6:
                return "Kythorn";
            case 38:
            case 7:
                return "Flamerule";
            case 39:
                return "Midsummer";
            case 40:
                return "Shieldmeet";
            case 41:
            case 8:
                return "Elesias";
            case 42:
            case 9:
                return "Eleint";
            case 43:
                return "Highharvestide";
            case 44:
            case 10:
                return "Marpenoth";
            case 45:
            case 11:
                return "Uktar";
            case 46:
                return "Feast of the Moon";
            case 47:
            case 12:
                return "Nightal";
        }
    };

    /**
     * Harptos filename and heading
     * @param {string} dateStr date to use for new file (result of prompt)
     * @returns {object} filename (padded date), pretty heading (formatted date), season, date object, monthName
     */
    harptosDay = (dateStr: string): HarptosDay => {
        const date = this.splitDateString(dateStr);
        return {
            filename:
                `${date.year}-${date.monthName}-${this.pad(date.day)}`.toLowerCase(),
            sort: `${date.year}-${date.month}-${this.pad(date.day)}`,
            heading: `${date.monthName} ${date.day}, ${date.year}`,
            season: this.faerunSeason(date.month, date.day),
            date: date,
            monthName: date.monthName,
        };
    };

    /**
     * Calculate the next day that should be logged, according to the Harptos calendar.
     * This assumes files with the following format:
     * - single day:   1498-ches-09
     * - several days: 1498-klythorn-09-11-optional-other-stuff
     *
     * Once it has found the last day.. figure out the _next_ day, with rollover
     * for the year.
     * @return {DateTag} the discovered date (proposal) and the tag associated with this folder
     */
    nextHarptosDay = async (tp: Templater): Promise<DateTag> => {
        const folder = tp.file.folder(true);
        console.log("Looking for files in %s", folder);

        const pathRegexp = this.utils().segmentFilterRegex(folder);
        const files = this.utils()
            .filesWithPath(pathRegexp)
            .filter((f) => f.name.match(/^.*\d{4}-[^-]+-.*/))
            .map((f) => f.path);

        // sort by harptos date in filename
        files.sort((a, b) =>
            this.compareHarptosDate(
                a.slice(a.lastIndexOf("/")),
                b.slice(b.lastIndexOf("/")),
            ),
        );

        const lastLog = files.pop();
        const date = this.splitDateString(lastLog);
        console.log("Found lastlog", lastLog, date);

        // Find the next available day
        /* eslint-disable no-fallthrough */
        switch (date.month) {
            // biome-ignore lint/suspicious/noFallthroughSwitchClause: intentional fall through
            case 39: // midsummer
                if (date.year % 4 === 0) {
                    date.day = 2; // Shieldmeet is 2nd day of intercalary month
                    date.month += 1;
                    break;
                }
            case 31: // midwinter
            case 35: // greengrass
            case 40: // shieldmeet
            case 43: // highharvestide
            case 46: // feast of the moon
                date.day = 1;
                date.month += 1;
                break;
            case 47: // nightal, end of year
                if (date.day === 30) {
                    date.month = 30;
                    date.year += 1;
                    date.day = 1;
                } else {
                    date.day += 1;
                }
                break;
            default:
                if (date.day === 30) {
                    date.day = 1;
                    date.month += 1;
                } else {
                    date.day += 1;
                }
                break;
        }
        /* eslint-enable no-fallthrough */
        return {
            date: `${date.year}-${this.monthName(date.month)}-${this.pad(date.day)}`,
            tag: this.folderToTag(folder),
            parsed: date,
        };
    };

    /**
     * Split a string into harptos calendar compatible segments.
     * This assumes files with the following format:
     * - single day:   1498-ches-09     -> { year: 1498, month: 33, day: 9}
     * - several days: 1498-tarsakh-09-11  -> { year: 1498, month: 34, day: 11}
     * (This doesn't work for ranges that span special days or months)
     * @param {string} str A date string
     * @returns {Date} date object containing year, month, day
     */
    splitDateString = (input: string): Date => {
        let str = input;
        if (str.contains("/")) {
            const pos = str.lastIndexOf("/") + 1;
            str = str.substring(pos);
        }
        str = str.replace(".md", "");
        const segments = str.toLowerCase().split("-");

        let day = Number(segments[2]);
        // Find last day of range: 1499-mirtul-01-11
        if (segments.length > 3) {
            const lastDay = Number(segments[3]);
            day = Number.isNaN(lastDay) ? day : lastDay;
        }
        const month = this.monthSort(segments[1]);
        return {
            year: Number(segments[0]),
            month: month,
            monthName: this.monthName(month),
            day: day,
        };
    };
}

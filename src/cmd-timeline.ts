import { Campaign } from "./campaign";
import { RenderFn, Utils } from "./_utils";
import { App, TFile } from "obsidian";
import { CalendarAPI, CalEvent } from "./@types/calendarium.types";

type EventsByString = { [key: string]: CalEvent[] };
type EventsByYear = { [key: number]: CalEvent[] };

export class Timeline {
    RENDER_TIMELINE = /([\s\S]*?<!--TIMELINE BEGIN-->)[\s\S]*?(<!--TIMELINE END-->[\s\S]*?)/i;
    app: App;
    utils: Utils;
    campaign: Campaign;
    event_codes: string[];

    constructor() {  // Constructor
        this.app = window.customJS.app;
        this.utils = window.customJS.Utils;
        this.campaign = window.customJS.Campaign;
        this.event_codes = this.campaign.EVENT_CODES;
        console.log("loaded Timeline renderer");
    }

    async invoke() {
        console.log("Render timelines");
        const timeline = this.app.vault.getFileByPath("heist/all-timeline.md");
        const groupedTimeline = this.app.vault.getFileByPath("heist/grouped-timeline.md");

        const HeistAPI = window.Calendarium.getAPI("Heist");
        const events = HeistAPI.getEvents();
        console.log(events);

        const groupByYear = this.groupByYear(HeistAPI, events);
        await this.renderTimeline(timeline, () => {
            let result = '\n';
            for (const year of Object.keys(groupByYear)) {
                result += this.list(groupByYear, 2, year, '');
            }
            return result;
        });

        const emoji = this.groupByEmoji(HeistAPI, events);
        await this.renderTimeline(groupedTimeline, () => {
            let result = '\n';
            result += this.list(emoji, 2, '📰', "Set up");
            result += '\n';

            result += this.list(emoji, 3, "🗣️", "Dagult Neverember");
            result += this.list(emoji, 3, "🐲", "Aurinax");
            result += this.list(emoji, 3, "😵", "Dalahkar's Trail");
            result += this.list(emoji, 3, "🗿", "Where is the Stone?");

            result += this.list(emoji, 2, "🧵", "Central thread");

            result += '\n';
            result += '## Allied Factions\n';
            result += '\n';

            result += this.list(emoji, 3, "⚔️", "Doom Raiders");
            result += this.list(emoji, 3, "🪬", "Force Grey");
            result += this.list(emoji, 3, "🎻", "Harpers");

            result += '\n';
            result += '## Opposing Factions\n';
            result += '\n';

            result += this.list(emoji, 3, "🧝🏿", "Bregan D'aerthe");
            result += this.list(emoji, 3, "👺", "Cassalanters");
            result += this.list(emoji, 3, "💃", "Gralhund's (Cassalanters / Zhenterim)");
            result += this.list(emoji, 3, "🦹", "Manshoon Clone / Zhenterim");
            result += this.list(emoji, 3, "👾", "Xanathar Guild");

            result += '\n';
            result += '## Nusiances\n';
            result += '\n';

            result += this.list(emoji, 3, '🥸', 'Emmek Frewn');
            result += this.list(emoji, 3, "🐀", "Shard Shunners");

            result += '\n';
            result += '## Other factions and actors\n';
            result += '\n';

            result += this.list(emoji, 3, "🌿", "Emerald Enclave");
            result += this.list(emoji, 3, "🏰", "Lords' Alliance");
            result += this.list(emoji, 3, "🌹", "Order of the Gauntlet");
            result += this.list(emoji, 3, "🧙‍♀️", "Watchful Order");
            return result;
        });
    }

    renderTimeline = async (file: TFile, renderer: RenderFn) => {
        await this.app.vault.process(file, (source) => {
            const match = this.RENDER_TIMELINE.exec(source);
            if (match) {
                source = match[1];
                source += renderer();
                source += match[2];
            }
            return source;
        });
    }

    groupByYear = (API: CalendarAPI, events: CalEvent[]): EventsByString => {
        const years: number[] = [];
        const groups = events.reduce((acc: EventsByYear, event) => {
            const year = Number(event.date?.year);
            if (isNaN(year) || !year) { // Filter out recurring events
                return acc;
            }
            if (!acc[year]) {
                acc[year] = [];
                years.push(year);
            }
            acc[year].push(event); // Add the event to its corresponding group
            return acc;
        }, {});
        years.sort();

        // Create a new collection in sorted order by year
        const sortedGroups = years.reduce((acc: EventsByString, key) => {
            groups[key].sort(API.compareEvents); // Sort the values
            acc[key] = groups[key];  // Add the sorted group to the result
            return acc;
        }, {});

        return sortedGroups;
    }

    groupByEmoji = (API: CalendarAPI, events: CalEvent[]): EventsByString => {
        const emoji = events.reduce((acc: EventsByString, event) => {
            // for each event
            this.event_codes.forEach(e => {
                // for each emoji
                if (event.name.contains(e)) {
                    acc[e] = acc[e] || [];
                    acc[e].push(event);
                }
            });
            return acc;
        }, {});
        Object.values(emoji).forEach(events => {
            events.sort(API.compareEvents);
        });
        return emoji;
    }

    list = (groups: EventsByString, level: number, key: string, description: string) => {
        let result = '';
        const group: CalEvent[] = groups[key];
        if (group) {
            result += `${"#".repeat(level)} ${key} ${description}\n`;
            result += "\n";
            groups[key].forEach((e) => {
                result += `- ${this.eventText(e)}\n`
            });
            result += "\n";
        }
        return result;
    }

    /**
     * @param {CalEvent} event
     * @returns {string} HTML span with event display data
     * @see punctuate
     * @see harptosEventDate
     */
    eventText = (event: CalEvent) => {
        const name = this.punctuate(event.name);
        const date = this.harptosEventDate(event);
        const data = this.punctuate(event.description);
        const suffix = event.note ? ` [➹](${event.note})` : '';

        return `<span data-timeline="${event.sort.timestamp}">\`${date}\` *${name}* ${data}${suffix}</span>`;
    }

    /**
     * @param {CalEvent} event
     * @returns {string} Display date string for the Harptos event
     * @see harptosZeroIndexMonth
     * @see harptosDay
     */
    harptosEventDate = (event: CalEvent): string => {
        const month = this.harptosZeroIndexMonth(event);
        const day = this.harptosDay(event);
        return `${event.date.year}-${month}${day}`;
    }

    /**
     * Return the numeric day segment for a Harptos event.
     * For special days (e.g. Midwinter, Shieldmeet), return an empty string.
     * @param {CalEvent} event
     * @returns {string} `-${day}` for non-special days, or an empty string for special days.
     */
    harptosDay = (event: CalEvent): string => {
        switch(event.date.month) {
            case 1:
            case 5:
            case 9:
            case 12:
                return '';
            default:
                return `-${event.date.day}`;
        }
    }

    /**
     * Map a zero-indexed Calendarium month to a Harptos month name.
     * @param {CalEvent} event
     * @returns {string} Month name
     */
    harptosZeroIndexMonth = (event: CalEvent): string => {
        switch (event.date.month) {
            case 0:
                return 'Hammer';
            case 1:
                return 'Midwinter';
            case 2:
                return 'Alturiak';
            case 3:
                return 'Ches';
            case 4:
                return 'Tarsakh';
            case 5:
                return 'Greengrass';
            case 6:
                return 'Mirtul';
            case 7:
                return 'Kythorn';
            case 8:
                return 'Flamerule';
            case 9:
                if (event.date.day == 2) {
                    return 'Shieldmeet';
                }
                return 'Midsummer';
            case 10:
                return 'Elesias';
            case 11:
                return 'Eleint';
            case 12:
                return 'Highharvestide';
            case 13:
                return 'Marpenoth';
            case 14:
                return 'Uktar';
            case 15:
                return 'Feast of the Moon';
            case 16:
                return 'Nightal';
        }
    }

    punctuate = (str: string): string => {
        str = str.trim();
        if (!str.match(/.*[.!?]$/)) {
            str += '.';
        }
        return str;
    }
}

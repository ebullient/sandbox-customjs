import { Moment } from "moment";
import {
    App,
    TFile,
} from "obsidian";

interface Birthdays {
    [padMonth: string]: BirthdayDate[]
}

interface BirthdayDate {
    date: string,
    text: string
    year?: string,
}

interface DailyInfo {
    dates: ParsedDates,
    header: string,
    dailyFile: string
}

interface MonthlyDates {
    monthYear: string;
    month: string;
    monthFile: string;
    year: string;
    lastMonth: string;
    lastMonthFile: string;
    nextMonth: string;
    nextMonthFile: string;
    firstMonday: Moment;
}

interface MonthInfo {
    dates: MonthlyDates,
    yearEmbed: string,
    header: string
}

interface MonthOfYear {
    month: string;
    monthFile: string;
}

interface ParsedDates {
    day: Moment;
    nextWorkDay: Moment;
    nextWorkDayName: string;
    lastMonday: Moment;
    monday: Moment;
    nextMonday: Moment;
}

interface WeekInfo {
    dates: ParsedDates,
    header: string,
    log: string,
    weeklyProjects: string,
    upcoming: string,
    weekFile: string,
    lastWeekFile: string,
    monthName: string,
    monthlyReflection: string,
    weeklyReflection: string,
}

interface YearInfo {
    year: string,
    yearFile: string,
    header: string,
    birthdays: Record<string, string>,
    yearByWeek: string
}

export class Dated {
    app: App;
    birthdayFile: TFile;

    constructor() {
        this.app = window.customJS.app;
        this.birthdayFile = this.app.vault.getFileByPath("assets/birthdays.json");
    }

    /**
     * Parse the date from a filename and calculate related dates.
     * @param {string} filename The filename to parse.
     * @returns {Object} An object containing:
     *  the parsed date, next workday, next workday name, last Monday, this Monday, and next Monday.
     */
    parseDate = (filename: string): ParsedDates => {
        const titledate = filename.replace("_week", '');
        const day = window.moment(titledate);
        const dayOfWeek = day.isoWeekday();

        let theMonday = window.moment(day).day(1);
        let nextWorkDay = window.moment(day).add(1, 'd');
        let nextWorkDayName = 'tomorrow';
        if (dayOfWeek === 0 || dayOfWeek === 7) {
            theMonday = window.moment(day).add(-1, 'week').day(1);
        } else if (dayOfWeek > 4) {
            nextWorkDay = window.moment(theMonday).add(1, 'week');
            nextWorkDayName = 'Monday';
        }

        return {
            day: day,
            nextWorkDay: nextWorkDay,
            nextWorkDayName: nextWorkDayName,

            lastMonday: window.moment(theMonday).add(-1, 'week'),
            monday: theMonday,
            nextMonday: window.moment(theMonday).add(1, 'week')
        }
    }

    /**
     * Create the file path for a specific day of the week.
     * @param {Moment} monday The Monday of the week.
     * @param {number} dayOfWeek The day of the week (1 for Monday, 7 for Sunday).
     * @returns {string} The file path for the specified day of the week.
     */
    dayOfWeekFile = (monday: Moment, dayOfWeek: number): string => {
        return this.dailyFile(window.moment(monday).day(dayOfWeek));
    }

    /**
     * Create the file path for a specific date.
     * @param {Moment} target The date to generate the file path for.
     * @returns {string} The file path for the specified date.
     */
    dailyFile = (target: Moment): string => {
        return target.format("[/chronicles]/YYYY/YYYY-MM-DD[.md]");
    }

    /**
     * Create the file path for a specific Monday.
     * @param {Moment} monday The Monday to generate the file path for.
     * @returns {string} The file path for the specified Monday.
     */
    weeklyFile = (monday: Moment): string => {
        return monday.format("[/chronicles]/YYYY/YYYY-MM-DD[_week.md]");
    }

    /**
     * Create the file path for a specific month.
     * @param {Moment} target The date to generate the file path for.
     * @returns {string} The file path for the specified month.
     */
    monthlyFile = (target: Moment): string => {
        return target.format("[/chronicles]/YYYY/YYYY-MM[_month.md]");
    }

    /**
     * Create the file path for a specific year.
     * @param {Moment} target The date to generate the file path for.
     * @returns {string} The file path for the specified year.
     */
    yearlyFile = (target: Moment): string => {
        return target.format("[/chronicles]/YYYY/YYYY[.md]");
    }

    /**
     * Create information for the daily note template for a specific date.
     * @param {string} filename The filename to parse.
     * @returns {Object} An object containing the dates, header, and daily file path.
     */
    daily = (filename: string): DailyInfo => {
        const dates = this.parseDate(filename);
        const header = '# My Day\n'
            + dates.day.format("dddd, MMMM DD, YYYY")
            + ' .... [' + dates.nextWorkDayName + '](' + this.dailyFile(dates.nextWorkDay) + ')  \n'
            + 'Week of [' + dates.monday.format("MMMM DD") + '](' + this.weeklyFile(dates.monday) + ')  \n';

        return {
            dates,
            header,
            dailyFile: this.dailyFile(dates.day).replace('.md', '')
        }
    }

    /**
     * Create information for the weekly note template for a specific date.
     * @param {string} filename The filename to parse.
     * @returns {Object} An object containing the dates, header, log, weekly projects, upcoming, week file path, last week file path, month name, monthly reflection, and weekly reflection.
     */
    weekly = (filename: string): WeekInfo => {
        const dates = this.parseDate(filename);
        const weekFile = this.weeklyFile(dates.monday);
        const thisMonthFile = this.monthlyFile(dates.monday);
        const lastWeekFile = this.weeklyFile(dates.lastMonday);
        const lastMonthFile = this.monthlyFile(dates.lastMonday);
        let monthlyReflection = '';
        let upcoming = `> ![Upcoming](${this.yearlyFile(dates.monday)}#${dates.monday.format("MMMM")})\n`;

        let header = `# Week of ${dates.monday.format("MMM D")}\n`
            + `[< ${dates.lastMonday.format("MMM D")}](${lastWeekFile}) --`
            + ` [Mo](${this.dayOfWeekFile(dates.monday, 1)})`
            + ` [Tu](${this.dayOfWeekFile(dates.monday, 2)})`
            + ` [We](${this.dayOfWeekFile(dates.monday, 3)})`
            + ` [Th](${this.dayOfWeekFile(dates.monday, 4)})`
            + ` [Fr](${this.dayOfWeekFile(dates.monday, 5)})`
            + ` -- [${dates.nextMonday.format("MMM D")} >](${this.weeklyFile(dates.nextMonday)})  \n`
            + `Goals for [${dates.monday.format("MMMM")}](${thisMonthFile})`;

        if (dates.monday.month() !== dates.nextMonday.month()) {
            header += `, [${dates.nextMonday.format("MMMM")}](${this.monthlyFile(dates.nextMonday)})`;
            upcoming += `\n> ![Upcoming](${dates.nextMonday.format("YYYY")}.md#${dates.nextMonday.format("MMMM")})`
            monthlyReflection =
                `- [ ] [Reflect on last month](${lastMonthFile})\n`
                + `- [ ] [Goals for this month](${this.monthlyFile(dates.nextMonday)})`;
        } else if (dates.monday.month() !== dates.lastMonday.month()) {
            monthlyReflection =
                `- [ ] [Reflect on last month](${lastMonthFile})\n`
                + `- [ ] [Goals for this month](${thisMonthFile})`;
        }

        const log =
            `### Log ${this.dayOfWeekFile(dates.monday, 1)}\n`
            + `![invisible-embed](${this.dayOfWeekFile(dates.monday, 1)}#Log)\n\n`
            + `### Log ${this.dayOfWeekFile(dates.monday, 2)}\n`
            + `![invisible-embed](${this.dayOfWeekFile(dates.monday, 2)}#Log)\n\n`
            + `### Log ${this.dayOfWeekFile(dates.monday, 3)}\n`
            + `![invisible-embed](${this.dayOfWeekFile(dates.monday, 3)}#Log)\n\n`
            + `### Log ${this.dayOfWeekFile(dates.monday, 4)}\n`
            + `![invisible-embed](${this.dayOfWeekFile(dates.monday, 4)}#Log)\n\n`
            + `### Log ${this.dayOfWeekFile(dates.monday, 5)}\n`
            + `![invisible-embed](${this.dayOfWeekFile(dates.monday, 5)}#Log)\n\n`
            + `### Log ${this.dayOfWeekFile(dates.monday, 6)}\n`
            + `![invisible-embed](${this.dayOfWeekFile(dates.monday, 6)}#Log)\n\n`
            + `### Log ${this.dayOfWeekFile(dates.monday, 7)}\n`
            + `![invisible-embed](${this.dayOfWeekFile(dates.monday, 7)}#Log)\n\n`;

        const weeklyProjects =
            `js-engine
const { Tasks } = await window.cJS();
return await Tasks.thisWeekTasks(engine);`

        return {
            dates,
            header,
            log,
            weeklyProjects,
            upcoming,
            weekFile: weekFile.replace('.md', ''),
            lastWeekFile,
            monthName: `${dates.monday.format("MMMM")}`,
            monthlyReflection: monthlyReflection,
            weeklyReflection: `${lastMonthFile}#${dates.lastMonday.format("YYYY-MM-DD")}`,
        }
    }

    /**
     * Parse the date from a monthly filename and calculate related dates.
     * @param {string} fileName The filename to parse.
     * @returns {Object} An object containing the month year, month, month file path, year, last month, last month file path, next month, next month file path, and first Monday of the month.
     */
    monthlyDates = (fileName: string): MonthlyDates => {
        const dateString = fileName.replace('.md', '').replace('_month', '-01');
        const date = window.moment(dateString);
        const lastMonth = window.moment(date).add(-1, 'month');
        const nextMonth = window.moment(date).add(1, 'month');

        const firstMonday = window.moment(date).startOf('month').day("Monday");
        if (firstMonday.date() > 7) {
            // We might be at the end of the previous month. So
            // find the next Monday.. the first Monday *in* the month
            firstMonday.add(7, 'd');
        }

        return {
            monthYear: date.format("MMMM YYYY"),
            month: date.format("MMMM"),
            monthFile: this.monthlyFile(date).replace('.md', ''),
            year: date.format("YYYY"),
            lastMonth: lastMonth.format("MMMM"),
            lastMonthFile: this.monthlyFile(lastMonth),
            nextMonth: nextMonth.format("MMMM"),
            nextMonthFile: this.monthlyFile(nextMonth),
            firstMonday
        }
    }

    /**
     * Create information for the monthly note template for a specific date.
     * @param {string} filename The filename to parse.
     * @returns {Object} An object containing the dates, year embed, and header.
     */
    monthly = (filename: string): MonthInfo => {
        const dates = this.monthlyDates(filename);
        const header = `# Goals for ${dates.monthYear}\n`
            + `[< ${dates.lastMonth}](${dates.lastMonthFile}) -- [${dates.nextMonth} >](${dates.nextMonthFile})`;

        return {
            dates: dates,
            yearEmbed: `![${dates.month}](${this.yearlyFile(dates.firstMonday)}#${dates.month})`,
            header: header
        }
    }

    /**
     * Create information for the yearly note template for a specific date.
     * @param {string} filename The filename to parse.
     * @returns {Object} An object containing the year, year file path, header, birthdays, and year by week.
     */
    yearly = async (filename: string): Promise<YearInfo> => {
        const dateString = filename.replace('.md', '') + '-01-01';
        console.log(this.birthdayFile, dateString);

        const date = window.moment(dateString);
        const year = date.format("YYYY");
        const yearFile = this.yearlyFile(date);
        const lastYear = window.moment(date).add(-1, 'year');
        const lastYearFile = this.yearlyFile(lastYear);
        const nextYear = window.moment(date).add(1, 'year');
        const nextYearFile = this.yearlyFile(nextYear);
        const header = `# Overview of ${year}\n`
            + `[< ${lastYear.format("YYYY")}](${lastYearFile}) -- [${nextYear.format("YYYY")} >](${nextYearFile})`;

        const birthdays: Record<string, string> = {};
        const contents = await this.app.vault.cachedRead(this.birthdayFile);
        const dates: Birthdays = JSON.parse(contents);

        for (const [MM, value] of Object.entries(dates)) {
            let list = '';
            value.forEach(v => {
                if (v.year) {
                    const diff = Number(year) - Number(v.year);
                    list += `> - ${v.date}: ${v.text} (${diff})\n`;
                } else {
                    list += `> - ${v.date}: ${v.text}\n`;
                }
            });
            birthdays[MM] = list;
        }

        const yearByWeek =
            `js-engine
const { Utils } = await window.cJS();
return Utils.listFilesWithPath(engine, /chronicles\\/${year}\\/${year}-\\d{2}-\\d{2}_week\\.md/);`

        return {
            year,
            yearFile: yearFile.replace('.md', ''),
            header,
            birthdays,
            yearByWeek
        }
    }

    /**
     * Create month information for the yearly note template.
     * @param {number} year The year to generate the file path for.
     * @param {number} i The month index (0 for January, 11 for December).
     * @returns {Object} An object containing the month name and month file path.
     */
    monthOfYear = (year: number, i: number): MonthOfYear => {
        const month = window.moment([year, i, 1]);
        return {
            month: month.format("MMMM"),
            monthFile: this.monthlyFile(month)
        }
    }

    /**
     * Filter lines containing leftover/unfinished tasks.
     * @param {string} line The line to check.
     * @returns {boolean} True if the line contains a leftover task, false otherwise.
     */
    filterLeftoverTasks = (line: string): boolean => {
        return line.match(/- \[[^x-]\] /) !== null;
    }
}

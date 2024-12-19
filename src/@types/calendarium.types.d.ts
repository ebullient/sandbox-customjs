export interface Calendarium {
    getAPI(calendarName?: string): CalendarAPI;
}

export interface CalendarAPI {
    compareEvents(event1: CalEvent, event2: CalEvent): number;
    getEvents(): CalEvent[];
}

export type CalEventInfo =
    | DatedCalEventInfo
    | RangedCalEventInfo
    | RangeCalEventInfo
    | UndatedCalEventInfo;

export type CalEvent =
    | DatedCalEvent
    | RecurringCalEvent
    | RangeCalEvent
    | UndatedCalEvent;

export type CalEventSort = {
    timestamp: number;
    order: string;
};

export type OneTimeCalEventDate = {
    year: number;
    month: number;
    day: number;
};

export type RecurringCalEventDate = {
    year: FullCalEventDateBit;
    month: FullCalEventDateBit;
    day: FullCalEventDateBit;
};

export type CalDate = {
    year: number;
    month: number;
    day: number;
};

export type UndatedCalDate = {
    year: null;
    month: null;
    day: null;
};

export enum EventType {
    Date = "Date",
    Recurring = "Recurring",
    Range = "Range",
    Undated = "Undated",
}

export type TimeSpan = {
    name: string | null;
    id: string;
};

export enum TimeSpanType {
    Era = "era",
    Day = "day",
    LeapDay = "leapday",
    Month = "month",
    IntercalaryMonth = "intercalary",
    Year = "year",
}

export type EventLikeType = TimeSpanType | EventType;

export interface EventLike {
    id: string;
    name: string;
    type: EventLikeType;
    date: CalEventDate | UndatedCalDate;
    category: string | null;
    description?: string | null;
    note?: string | null;
    sort?: CalEventSort;
}
interface BaseCalEvent extends EventLike {
    type: EventType;
    img?: string | null;
}

export type CalEventDate = OneTimeCalEventDate | RecurringCalEventDate;

export type RecurringCalEventDateBit = [number | null, number | null];
export type FullCalEventDateBit = RecurringCalEventDateBit | number;

export type DatedCalEventInfo = {
    type: typeof EventType.Date;
    date: OneTimeCalEventDate;
};
export type DatedCalEvent = BaseCalEvent & DatedCalEventInfo;

export type UndatedCalEventInfo = {
    type: typeof EventType.Undated;
    date: UndatedCalDate;
};
export type UndatedCalEvent = BaseCalEvent & UndatedCalEventInfo;

export type RangeCalEventInfo = {
    type: typeof EventType.Range;
    date: OneTimeCalEventDate;
    end: OneTimeCalEventDate;
};
export type RangeCalEvent = BaseCalEvent & RangeCalEventInfo;

export type RangedCalEventInfo = {
    type: typeof EventType.Recurring;
    date: RecurringCalEventDate;
};
export type RecurringCalEvent = BaseCalEvent & RangedCalEventInfo;

declare global {
    interface Window {
        Calendarium: Calendarium;
    }
}

import type { moment } from "obsidian";

/**
 * Per-file frontmatter override for the archive cutoff.
 * "yearly" is the default (previous calendar years, gated to start in
 * February) and is used when archiveInterval is unset or unrecognized.
 */
export type ArchiveInterval = "weekly" | "monthly" | "yearly";

export function parseArchiveInterval(value: unknown): ArchiveInterval {
    return value === "weekly" || value === "monthly" ? value : "yearly";
}

/**
 * Resolves the cutoff moment for denaturing (checkbox -> emoji conversion).
 * "yearly" always denatures monthly, same as today's default behavior;
 * "weekly"/"monthly" tighten denaturing to match their archive cutoff.
 */
export function resolveDenatureCutoff(
    interval: ArchiveInterval,
    monthMoment: moment.Moment,
    weekMoment: moment.Moment,
): moment.Moment {
    return interval === "weekly" ? weekMoment : monthMoment;
}

/**
 * Resolves the cutoff moment for archiving to a separate file.
 * "yearly" archives nothing until February (shouldArchiveByYear), at which
 * point the cutoff is the start of the current year.
 */
export function resolveArchiveCutoff(
    interval: ArchiveInterval,
    monthMoment: moment.Moment,
    weekMoment: moment.Moment,
    yearMoment: moment.Moment,
    shouldArchiveByYear: boolean,
): moment.Moment | null {
    if (interval === "weekly") {
        return weekMoment;
    }
    if (interval === "monthly") {
        return monthMoment;
    }
    return shouldArchiveByYear ? yearMoment : null;
}

export function shouldArchiveEntry(
    completedMoment: moment.Moment | null,
    cutoff: moment.Moment | null,
): boolean {
    return cutoff !== null && !!completedMoment?.isBefore(cutoff);
}

/**
 * A non-default archiveInterval overrides minArchiveLines - the point is to
 * keep sweeping a chatty log out on a tight cadence, regardless of size.
 */
export function bypassesMinLines(interval: ArchiveInterval): boolean {
    return interval !== "yearly";
}

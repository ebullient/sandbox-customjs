import moment from "moment";
import { describe, expect, it } from "vitest";
import {
    bypassesMinLines,
    parseArchiveInterval,
    resolveArchiveCutoff,
    resolveDenatureCutoff,
    shouldArchiveEntry,
} from "./taskindex-ArchiveRules";

describe("parseArchiveInterval", () => {
    it("accepts monthly and weekly", () => {
        expect(parseArchiveInterval("monthly")).toBe("monthly");
        expect(parseArchiveInterval("weekly")).toBe("weekly");
    });

    it("defaults to yearly for unknown values and missing frontmatter", () => {
        expect(parseArchiveInterval("daily")).toBe("yearly");
        expect(parseArchiveInterval(undefined)).toBe("yearly");
        expect(parseArchiveInterval(null)).toBe("yearly");
        expect(parseArchiveInterval("yearly")).toBe("yearly");
    });
});

describe("resolveDenatureCutoff", () => {
    const monthMoment = moment("2026-07-01");
    const weekMoment = moment("2026-06-29"); // Monday

    it("uses the week cutoff for weekly", () => {
        expect(resolveDenatureCutoff("weekly", monthMoment, weekMoment)).toBe(
            weekMoment,
        );
    });

    it("uses the month cutoff for monthly", () => {
        expect(resolveDenatureCutoff("monthly", monthMoment, weekMoment)).toBe(
            monthMoment,
        );
    });

    it("uses the month cutoff for yearly (denaturing always stays monthly)", () => {
        expect(resolveDenatureCutoff("yearly", monthMoment, weekMoment)).toBe(
            monthMoment,
        );
    });
});

describe("resolveArchiveCutoff", () => {
    const monthMoment = moment("2026-07-01");
    const weekMoment = moment("2026-06-29"); // Monday
    const yearMoment = moment("2026-01-01");

    it("uses the week cutoff for weekly", () => {
        expect(
            resolveArchiveCutoff(
                "weekly",
                monthMoment,
                weekMoment,
                yearMoment,
                true,
            ),
        ).toBe(weekMoment);
    });

    it("uses the month cutoff for monthly", () => {
        expect(
            resolveArchiveCutoff(
                "monthly",
                monthMoment,
                weekMoment,
                yearMoment,
                true,
            ),
        ).toBe(monthMoment);
    });

    it("uses the year cutoff for yearly when shouldArchiveByYear is true", () => {
        expect(
            resolveArchiveCutoff(
                "yearly",
                monthMoment,
                weekMoment,
                yearMoment,
                true,
            ),
        ).toBe(yearMoment);
    });

    it("archives nothing for yearly when shouldArchiveByYear is false (January)", () => {
        expect(
            resolveArchiveCutoff(
                "yearly",
                monthMoment,
                weekMoment,
                yearMoment,
                false,
            ),
        ).toBeNull();
    });
});

describe("shouldArchiveEntry", () => {
    const cutoff = moment("2026-06-29");

    it("archives entries before the cutoff", () => {
        expect(shouldArchiveEntry(moment("2026-06-20"), cutoff)).toBe(true);
    });

    it("does not archive entries on/after the cutoff", () => {
        expect(shouldArchiveEntry(moment("2026-06-30"), cutoff)).toBe(false);
    });

    it("never archives when cutoff is null (yearly, gated in January)", () => {
        expect(shouldArchiveEntry(moment("2020-01-01"), null)).toBe(false);
    });

    it("never archives when there is no completion date", () => {
        expect(shouldArchiveEntry(null, cutoff)).toBe(false);
    });
});

describe("bypassesMinLines", () => {
    it("bypasses the threshold only for non-default intervals", () => {
        expect(bypassesMinLines("weekly")).toBe(true);
        expect(bypassesMinLines("monthly")).toBe(true);
        expect(bypassesMinLines("yearly")).toBe(false);
    });
});

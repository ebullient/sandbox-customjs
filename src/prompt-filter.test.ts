import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { PromptFilter } from "./prompt-filter";

const fixture = (name: string) =>
    readFileSync(
        fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url)),
        "utf-8",
    );

beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = {
        customJS: { app: null },
        journal: {},
    };
});

describe("tierFilter", () => {
    it("marks a short, tagless entry as a short entry with no tier tag", () => {
        const filter = new PromptFilter();
        const result = filter.tierFilter(fixture("test-tier1.md"));

        expect(result).toContain("Short entry: ✔️ - use lightweight check-in");
        expect(result).toContain("Self-assessment: none");
    });

    it("extracts tier tag, vitamins, and hyperfocus signals from a tier4 entry", () => {
        const filter = new PromptFilter();
        const result = filter.tierFilter(fixture("test-tier4.md"));

        expect(result).toContain("Self-assessment: tier4");
        expect(result).toContain("vitamins: ✔️");
        expect(result).toContain("hyperfocus: ✔️");
    });

    it("detects mixed hyperfocus emoji and a completed chore", () => {
        const filter = new PromptFilter();
        const result = filter.tierFilter(fixture("test-mixed.md"));

        expect(result).toContain("hyperfocus: ✔️");
    });

    it("still reports as a short entry even with a tier-assessment block", () => {
        const filter = new PromptFilter();
        const result = filter.tierFilter(fixture("test-iteration2.md"));

        // under the 50-word threshold, so iteration count isn't shown
        expect(result).toContain("Short entry: ✔️ - use lightweight check-in");
        expect(result).toContain("Can ask more questions: no");
    });

    it("extracts workday, completion, and hyperfocus from the complete example", () => {
        const filter = new PromptFilter();
        const result = filter.tierFilter(fixture("test-complete-example.md"));

        expect(result).toContain("Workday: yes (Wednesday)");
        expect(result).toContain("Self-assessment: tier2");
        expect(result).toContain("hyperfocus: ✔️");
        expect(result).toContain("Iteration: 2 of 4");
    });
});

describe("extractWorkday (via tierFilter output)", () => {
    it("flags PTO/vacation mentions as not a workday", () => {
        const filter = new PromptFilter();
        const result = filter.tierFilter(
            "Took the day off. Vacation with the kids at the lake, no work today.",
        );

        expect(result).toContain("Workday: no (time off)");
    });

    it("flags weekend day names as not a workday", () => {
        const filter = new PromptFilter();
        const result = filter.tierFilter(
            "Saturday was quiet, mostly rested and read a book.",
        );

        expect(result).toContain("Workday: no (weekend)");
    });
});

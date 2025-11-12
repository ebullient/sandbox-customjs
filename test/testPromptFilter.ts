#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { PromptFilter } from "../src/prompt-filter";

const filename = process.argv[2];

if (!filename) {
    console.error("Usage: node testPrefilter.js <filename>");
    process.exit(1);
}

// Mock the window object for testing
(globalThis as any).window = {
    customJS: { app: null } as any,
    journal: {}
};

try {
    const content = readFileSync(filename, "utf-8");
    const promptFilter = new PromptFilter();
    const result = promptFilter.tierFilter(content);

    console.log(result);
} catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
}

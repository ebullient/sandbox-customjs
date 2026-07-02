import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            obsidian: fileURLToPath(
                new URL("./test/obsidian-shim.ts", import.meta.url),
            ),
        },
    },
    test: {
        include: ["**/*.test.ts"],
        exclude: ["**/node_modules/**", "**/dist/**"],
    },
});

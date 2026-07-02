// Minimal runtime shim for the `obsidian` package under Vitest.
// `obsidian` ships types only (package.json "main" is empty) - at runtime
// inside the Obsidian app, `moment` is provided by the host. Source files
// import { moment } from "obsidian" as a value, so tests need a real
// implementation; the `moment` npm package is what Obsidian re-exports.
export { default as moment } from "moment";

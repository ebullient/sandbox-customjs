import type { App, LinkCache, TFile } from "obsidian";
import type { RenderFn, Utils } from "./_utils";

type FileReferences = Record<string, number>;

export class Missing {
    RENDER_MISSING =
        /([\s\S]*?<!--MISSING BEGIN-->)[\s\S]*?(<!--MISSING END-->[\s\S]*?)/i;

    app: App;

    targetFile = "assets/no-sync/missing.md";

    ignoreAnchors = [
        "card",
        "center",
        "callout",
        "gallery",
        "portrait",
        "right",
        "symbol",
        "token",
    ];

    // add additional files to ignore here
    ignoreFiles = [
        this.targetFile,
        "${result.lastSession}",
        "${result}",
        "${file.path}",
        "${y[0].file.path}",
        "/${p.file.path}",

        "assets/Publications.bib",
        "assets/Readit.bib",
        "assets/birthdays.json",
        "assets/pandoc",
        "assets/templates/periodic-daily.md",
        "assets/templates/encounter-create.md",
        "assets/templates/group-create.md",
        "assets/templates/img-full-width.md",
        "assets/templates/img-portrait.md",
        "assets/templates/indent-block.md",
        "assets/templates/location-area-create.md",
        "assets/templates/location-create.md",
        "assets/templates/location-shop-create.md",
        "assets/templates/mood-roll.md",
        "assets/templates/note-create-rename.md",
        "assets/templates/note-prev-next.md",
        "assets/templates/note-preview-mode.md",
        "assets/templates/note-rename.md",
        "assets/templates/npc-block.md",
        "assets/templates/npc-create.md",
        "assets/templates/npc-mood-block.md",
        "assets/templates/npc-mood-roll.md",
        "assets/templates/pc-skill-check.md",
        "assets/templates/scene-option.md",
        "assets/templates/scene.md",
        "assets/templates/session-create.md",
        "assets/templates/session-recap.md",
        "assets/templates/session-scene-option.md",
        "assets/templates/statblock-create.md",
        "assets/templates/statblock.md",
        "assets/templates/tyrant-of-zhentil-keep.md",
        "assets/templates/waterdeep-new-day.md",
        "assets/templates/waterdeep-news.md",
        "assets/templates/waterdeep-random-encounter.md",
        "assets/templates/waterdeep-rumor.md",
        "assets/templates/waterdeep-session.md",
        "assets/templates/waterdeep-tavern-funds.md",
        "assets/templates/waterdeep-tavern-patron.md",
        "assets/templates/waterdeep-tavern-time.md",
        "assets/templates/waterdeep-timeline.md",
        "assets/templates/waterdeep-weather-10.md",
        "assets/templates/waterdeep-weather.md",
        "assets/templates/witchlight-session.md",

        "quests/obsidian-theme-plugins/ebullientworks-theme/links.md",
        "quests/obsidian-theme-plugins/ebullientworks-theme/obsidian-theme-test.md",
    ];

    ignoreUnreferencedPath = ["compendium/5e"];

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded Missing");
    }

    utils = (): Utils => window.customJS.Utils;

    /**
     * Find all missing references and update the target file with the results.
     * @returns {Promise<void>}
     */
    async invoke(): Promise<void> {
        console.log("Finding lost things");
        const missing = this.app.vault.getFileByPath(this.targetFile);
        if (!missing) {
            console.log(`${this.targetFile} file not found`);
            return;
        }

        // create a map of not-markdown/not-canvas files that could be referenced
        // ignore templates and other assets
        const fileMap: FileReferences = {};

        for (const file of this.app.vault.getFiles()) {
            if (
                file.path.endsWith(".canvas") ||
                file.path.endsWith(".md") ||
                this.ignoreFiles.includes(file.path) ||
                file.path.contains("assets/regex") ||
                file.path.contains("assets/templates") ||
                file.path.contains("assets/customjs")
            ) {
                fileMap[file.path] = 0;
            } else {
                fileMap[file.path] = 1;
            }
        }

        // Find all markdown files that are not in the ignore list
        const files = this.app.vault
            .getMarkdownFiles()
            .filter((x) => !this.ignoreFiles.includes(x.path));

        console.log("Finding lost things: reading files");

        const leaflet: string[][] = [];
        const anchors: string[][] = [];
        const rows: string[][] = [];

        // read all the files and extract the text
        const promises = files.map((file) =>
            this.app.vault
                .cachedRead(file)
                .then((txt) =>
                    this.findReferences(
                        txt,
                        file,
                        leaflet,
                        rows,
                        anchors,
                        fileMap,
                    ),
                ),
        );
        await Promise.all(promises);

        console.log("Finding lost things: writing result");
        await this.renderMissing(missing, () => {
            const result = ["\n"];
            result.push("## Missing reference\n");
            result.push(this.renderTable(["Source", "Target"], rows));
            result.push("\n");

            result.push("## Missing heading or block reference");
            result.push(
                this.renderTable(["Source", "Anchor", "Target"], anchors),
            );
            result.push("\n");

            result.push("## Missing leaflet reference\n");
            result.push(
                this.renderTable(["Leaflet Source", "Missing"], leaflet),
            );
            result.push("\n");

            result.push("## Unreferenced Things\n");
            const keys = Object.keys(fileMap)
                .filter((x) => fileMap[x] !== 0)
                .filter((x) => !x.endsWith(".md"))
                .filter((x) =>
                    this.ignoreUnreferencedPath.every((y) => !x.startsWith(y)),
                )
                .filter((x) => {
                    if (x.contains("excalidraw")) {
                        const file =
                            this.app.metadataCache.getFirstLinkpathDest(
                                x.replace(/\.(svg|png)/, ".md"),
                                x,
                            );
                        // only excalidraw images where drawing is MIA
                        return file == null;
                    }
                    return true;
                })
                .sort();
            for (const x of keys) {
                result.push(`- ${this.pathToMdLink(x)}`);
            }
            return result.join("\n");
        });
        console.log("Finding lost things: Done! 🫶 ");
    }

    /**
     * Find references (links) in the text and update the file map.
     * @param {string} txt The text to search for references.
     * @param {TFile} file The file being processed.
     * @param {Array} leaflet The array to store missing leaflet references.
     * @param {Array} rows The array to store missing file references.
     * @param {Array} anchors The array to store missing anchor references.
     * @param {FileReferences} fileMap The map of files to update.
     */
    findReferences = (
        txt: string,
        file: TFile,
        leaflet: string[][],
        rows: string[][],
        anchors: string[][],
        fileMap: FileReferences,
    ) => {
        const fileCache = this.app.metadataCache.getFileCache(file);

        if (fileCache.embeds) {
            for (const x of fileCache.embeds) {
                this.findLink(file, x, rows, anchors, fileMap);
            }
        }
        if (fileCache.links) {
            for (const x of fileCache.links) {
                this.findLink(file, x, rows, anchors, fileMap);
            }
        }

        if (txt.contains("```leaflet")) {
            // find all lines matching "image: (path to image)" and extract the image name
            for (const x of txt.matchAll(/image: (.*)/g)) {
                const imgName = x[1];
                const tgtFile = this.app.metadataCache.getFirstLinkpathDest(
                    imgName,
                    file.path,
                );
                if (tgtFile == null) {
                    // The image this leaflet needs is missing
                    leaflet.push([this.pathToMdLink(file.path), imgName]);
                } else {
                    // We found the image,
                    fileMap[tgtFile.path] = 0;
                }
            }
        }
    };

    /**
     * Finds a link in the file and updates the file map.
     * @param {TFile} source The file being processed.
     * @param {Object} lc The link object to process.
     * @param {Array} rows The array to store missing file references.
     * @param {Array} anchors The array to store missing anchor references.
     * @param {Object} fileMap The map of files to update.
     * @returns {Promise<void>}
     */
    findLink = async (
        source: TFile,
        lc: LinkCache,
        rows: string[][],
        anchors: string[][],
        fileMap: FileReferences,
    ): Promise<void> => {
        const now = window.moment();
        const cleanLink = this.utils().cleanLinkTarget(lc);
        const target = cleanLink.link;

        let tgtFile = source;
        if (target) {
            // If we have a target file (not an internal anchor/block reference)

            // ignore external links and ignored files
            if (
                target.startsWith("http") ||
                target.startsWith("mailto") ||
                target.startsWith("view-source") ||
                this.ignoreFiles.includes(target)
            ) {
                return;
            }

            // ignore missing links for periodic notes in the future
            let match = /.*(\d{4}-\d{2}-\d{2})(_week)?\.md/.exec(target);
            if (match != null) {
                const filedate = window.moment(match[1]);
                if (filedate.isAfter(now)) {
                    return;
                }
            }
            match = /.*(\d{4}-\d{2})_month\.md/.exec(target);
            if (match != null) {
                const filedate = window.moment(`${match[1]}-01`);
                if (filedate.isAfter(now)) {
                    return;
                }
            }
            match = /.*(\d{4})\.md/.exec(target);
            if (match != null) {
                const filedate = window.moment(`${match[1]}-01-01`);
                if (filedate.isAfter(now)) {
                    return;
                }
            }

            // find the target file
            tgtFile = this.app.metadataCache.getFirstLinkpathDest(
                target,
                source.path,
            );
            if (tgtFile == null) {
                console.debug(source.path, " has lost ", target);
                rows.push([this.pathToMdLink(source.path), target]);
            } else {
                // found a reference to that file
                fileMap[tgtFile.path] = 0;
            }
        }

        if (cleanLink.anchor && tgtFile) {
            const anchor = cleanLink.anchor;
            const tgtFileCache = this.app.metadataCache.getFileCache(tgtFile);
            if (!tgtFileCache) {
                // unlikely...
                anchors.push([
                    this.pathToMdLink(source.path),
                    "--",
                    "missing cache",
                ]);
            } else if (this.ignoreAnchors.includes(anchor)) {
                // no-op: skip ignored anchors
            } else if (anchor.startsWith("^")) {
                const blockref = anchor.substring(1);
                const tgtBlock = tgtFileCache.blocks
                    ? tgtFileCache.blocks[blockref]
                    : "";
                if (!tgtBlock) {
                    console.log(
                        "MISSING:",
                        `${tgtFile.path}#${anchor}`,
                        "referenced from",
                        source.path,
                        tgtFileCache.blocks,
                    );
                    anchors.push([
                        this.pathToMdLink(source.path),
                        `#${anchor}`,
                        target,
                    ]);
                }
            } else {
                const lower = cleanLink.anchor
                    .toLowerCase()
                    .replace(/[.]/g, "");
                const tgtHeading = tgtFileCache.headings
                    ? tgtFileCache.headings.find(
                          (x) =>
                              lower ===
                              x.heading
                                  .toLowerCase()
                                  .replace(/[?:.]/g, "")
                                  .replace("#", " "),
                      )
                    : "";
                if (!tgtHeading) {
                    console.log(
                        "MISSING:",
                        `${tgtFile.path}#${anchor}`,
                        "referenced from",
                        source.path,
                        tgtFileCache.headings,
                    );
                    anchors.push([
                        this.pathToMdLink(source.path),
                        `#${anchor}`,
                        target,
                    ]);
                }
            }
        }
    };

    pathToMdLink = (path: string): string => {
        return `[${path}](${path.replace(/ /g, "%20")})`;
    };

    /**
     * Render the missing references in the specified file.
     * @param {TFile} file The file to update.
     * @param {Function} renderer The function to generate the missing references content.
     * @returns {Promise<void>}
     */
    renderMissing = async (file: TFile, renderer: RenderFn): Promise<void> => {
        await this.app.vault.process(file, (src) => {
            let source = src;
            const match = this.RENDER_MISSING.exec(source);
            if (match) {
                source = match[1];
                source += renderer();
                source += match[2];
            }
            return source;
        });
    };

    /**
     * Create a markdown table with the specified headers and rows.
     * @param {Array<string>} headers The headers for the table.
     * @param {Array<Array<string>>} rows The rows for the table.
     * @returns {string} A markdown table with the specified headers and rows.
     */
    renderTable = (headers: string[], rows: string[][]): string => {
        let result = "";
        result += "|";
        for (const th of headers) {
            result += ` ${th} |`;
        }
        result += "\n";

        result += "|";
        for (const _ of headers) {
            result += " --- |";
        }
        result += "\n";

        for (const tr of rows) {
            result += "|";
            for (const td of tr) {
                result += ` ${td} |`;
            }
            result += "\n";
        }
        return result;
    };
}

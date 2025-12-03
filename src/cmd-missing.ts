import type { App, LinkCache, TFile } from "obsidian";
import type { RenderFn, Utils } from "./_utils";

type FileReferences = Record<string, number>;

interface MissingConfig {
    ignoreAnchors: string[];
    ignoreFiles: string[];
    ignoreUnreferencedPath: string[];
}

export class Missing {
    RENDER_MISSING =
        /([\s\S]*?<!--MISSING BEGIN-->)[\s\S]*?(<!--MISSING END-->[\s\S]*?)/i;

    app: App;

    targetFile = "assets/no-sync/missing.md";
    configFile = "assets/config/missing-config.yaml";

    // Default values (fallback if config file can't be loaded)
    ignoreAnchors: string[] = [
        "card",
        "center",
        "callout",
        "gallery",
        "portrait",
        "right",
        "symbol",
        "token",
    ];

    ignoreFiles: string[] = [this.targetFile];

    ignoreUnreferencedPath: string[] = ["compendium/5e"];

    constructor() {
        this.app = window.customJS.app;
        console.log("loaded Missing");
    }

    utils = (): Utils => window.customJS.Utils;

    /**
     * Load configuration from YAML file
     */
    async loadConfig(): Promise<void> {
        try {
            const configFile = this.app.vault.getFileByPath(this.configFile);
            if (!configFile) {
                console.warn(
                    `Missing config file ${this.configFile}, using defaults`,
                );
                return;
            }

            const configText = await this.app.vault.cachedRead(configFile);
            const config = window.customJS.obsidian.parseYaml(
                configText,
            ) as MissingConfig;

            if (config.ignoreAnchors) {
                this.ignoreAnchors = config.ignoreAnchors;
            }
            if (config.ignoreFiles) {
                // Always include the target file
                this.ignoreFiles = [this.targetFile, ...config.ignoreFiles];
            }
            if (config.ignoreUnreferencedPath) {
                this.ignoreUnreferencedPath = config.ignoreUnreferencedPath;
            }

            console.log("Loaded missing configuration from", this.configFile);
        } catch (error) {
            console.error("Failed to load missing configuration:", error);
            console.log("Using default configuration");
        }
    }

    /**
     * Find all missing references and update the target file with the results.
     * @returns {Promise<void>}
     */
    async invoke(): Promise<void> {
        console.log("Finding lost things");

        // Load configuration from YAML file
        await this.loadConfig();

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
                    if (!x.includes("/attachments/")) {
                        return false; // exclude PDFs/images outside attachments
                    }
                    return true; // include everything else
                })
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
            // Match: YYYY-MM-DD with optional suffix like _week, _20, etc.
            let match = /.*(\d{4}-\d{2}-\d{2})(?:_\w+)?\.md/.exec(target);
            if (match != null) {
                const filedate = window.moment(match[1]);
                const nowYMD = now.format("YYYY-MM-DD");
                if (filedate.isAfter(now) || match[1] === nowYMD) {
                    return;
                }
            }
            // Match: YYYY-MM with _month or other suffix
            match = /.*(\d{4}-\d{2})_\w+\.md/.exec(target);
            if (match != null) {
                const filedate = window.moment(`${match[1]}-01`);
                if (filedate.isAfter(now)) {
                    return;
                }
            }
            // Match: YYYY.md (year files)
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
                // Handle URL decoding and normalization for heading comparison
                const decodeAndNormalize = (text: string): string => {
                    return decodeURIComponent(text)
                        .toLowerCase()
                        .replace(/%23/g, "")
                        .replace(/[?:.]/g, "")
                        .replace(/\s+/g, " ")
                        .trim();
                };

                const normalizedAnchor = decodeAndNormalize(cleanLink.anchor);

                const tgtHeading = tgtFileCache.headings
                    ? tgtFileCache.headings.find(
                        (x) =>
                            normalizedAnchor ===
                            decodeAndNormalize(x.heading),
                    )
                    : "";
                if (!tgtHeading) {
                    console.log(
                        "MISSING HEADING DEBUG:",
                        "anchor:",
                        cleanLink.anchor,
                        "normalized:",
                        normalizedAnchor,
                        "available headings:",
                        tgtFileCache.headings?.map((h) => h.heading),
                        "file:",
                        tgtFile.path,
                    );
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

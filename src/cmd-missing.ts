import moment from "moment";
import { RenderFn, Utils } from "./_utils";
import { App, LinkCache, TFile } from "obsidian";

type FileReferences = Record<string, number>;

export class Missing {
    RENDER_MISSING = /([\s\S]*?<!--MISSING BEGIN-->)[\s\S]*?(<!--MISSING END-->[\s\S]*?)/i;

    app: App;
    utils: Utils;

    targetFile = "assets/no-sync/missing.md";

    // add additional files to ignore here
    ignoreFiles = [
        this.targetFile,
        "${result.lastSession}",
        "${result}",
        "${file.path}",
        "${y[0].file.path}",
        "/${p.file.path}",
        "assets/templates/periodic-daily.md",
        "assets/Publications.bib",
        "assets/Readit.bib",
        "assets/birthdays.json",
        "quests/obsidian-theme-plugins/ebullientworks-theme/links.md",
        "quests/obsidian-theme-plugins/ebullientworks-theme/obsidian-theme-test.md"
    ];

    ignoreAnchors = [
        "callout", "portrait"
    ]

    constructor() {
        this.app = window.customJS.app;
        this.utils = window.customJS.Utils;
        console.log("loaded Missing");
    }

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

        this.app.vault.getFiles()
            .filter(x => !x.path.endsWith('.canvas'))
            .filter(x => !x.path.endsWith('.md'))
            .filter(x => !this.ignoreFiles.includes(x.path))
            .filter(x => !x.path.contains('assets/regex'))
            .filter(x => !x.path.contains('assets/templates'))
            .filter(x => !x.path.contains('assets/customjs'))
            .forEach((f) => {
                fileMap[f.path] = 1;
            });

        // Find all markdown files that are not in the ignore list
        const files = this.app.vault.getMarkdownFiles()
            .filter(x => !this.ignoreFiles.includes(x.path));

        console.log("Finding lost things: reading files");

        const leaflet: string[][] = [];
        const anchors: string[][] = [];
        const rows: string[][] = [];

        // read all the files and extract the text
        const promises = files.map(file => this.app.vault.cachedRead(file)
            .then((txt) => this.findReferences(txt, file, leaflet, rows, anchors, fileMap)));
        await Promise.all(promises);

        console.log("Finding lost things: writing result");
        await this.renderMissing(missing, () => {
            const result = ['\n'];
            result.push('## Missing reference\n');
            result.push(this.renderTable(['Source', 'Target'], rows));
            result.push('\n');

            result.push('## Missing heading or block reference');
            result.push(this.renderTable(['Source', 'Anchor', 'Target'], anchors));
            result.push('\n');

            result.push('## Missing leaflet reference\n');
            result.push(this.renderTable(['Leaflet Source', 'Missing'], leaflet));
            result.push('\n');

            result.push('## Unreferenced Things\n');
            const keys = Object.keys(fileMap).sort();
            keys.filter(x => fileMap[x] != 0)
                .filter(x => !x.endsWith('.md'))
                .filter(x => {
                    if (x.contains('excalidraw')) {
                        const file = this.app.metadataCache.getFirstLinkpathDest(x.replace(/\.(svg|png)/, '.md'), x);
                        // only excalidraw images where drawing is MIA
                        return file == null;
                    }
                    return true;
                }).forEach(x => result.push('- ' + this.pathToMdLink(x)));

            return result.join('\n');
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
    findReferences = (txt: string, file: TFile,
        leaflet: string[][], rows: string[][], anchors: string[][],
        fileMap: FileReferences) => {

        const fileCache = this.app.metadataCache.getFileCache(file);

        if (fileCache.embeds) {
            fileCache.embeds.forEach(x => this.findLink(file, x, rows, anchors, fileMap));
        }
        if (fileCache.links) {
            fileCache.links.forEach(x => this.findLink(file, x, rows, anchors, fileMap));
        }

        if (txt.contains('```leaflet')) {
            // find all lines matching "image: (path to image)" and extract the image name
            [...txt.matchAll(/image: (.*)/g)].forEach((x) => {
                const imgName = x[1];
                const tgtFile = this.app.metadataCache.getFirstLinkpathDest(imgName, file.path);
                if (tgtFile == null) {
                    // The image this leaflet needs is missing
                    leaflet.push([this.pathToMdLink(file.path), imgName]);
                } else {
                    // We found the image,
                    fileMap[tgtFile.path] = 0;
                }
            });
        }
    }

    /**
     * Finds a link in the file and updates the file map.
     * @param {TFile} source The file being processed.
     * @param {Object} lc The link object to process.
     * @param {Array} rows The array to store missing file references.
     * @param {Array} anchors The array to store missing anchor references.
     * @param {Object} fileMap The map of files to update.
     * @returns {Promise<void>}
     */
    findLink = async (source: TFile, lc: LinkCache,
        rows: string[][], anchors: string[][],
        fileMap: FileReferences): Promise<void> => {

        const now = window.moment();
        const cleanLink = this.utils.cleanLinkTarget(lc);
        const target = cleanLink.link;

        let tgtFile = source;
        if (target) {
            // If we have a target file (not an internal anchor/block reference)

            // ignore external links and ignored files
            if (target.startsWith('http')
                || target.startsWith('mailto')
                || target.startsWith('view-source')
                || this.ignoreFiles.includes(target)) {
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
            tgtFile = this.app.metadataCache.getFirstLinkpathDest(target, source.path);
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
            if (this.ignoreAnchors.includes(cleanLink.anchor)) {
                return;
            }
            const tgtFileCache = this.app.metadataCache.getFileCache(tgtFile);
            if (!tgtFileCache) { // unlikely...
                anchors.push([this.pathToMdLink(source.path), `--`, 'missing cache']);
            } else if (anchor.startsWith('^')) {
                const blockref = anchor.substring(1);
                const tgtBlock = tgtFileCache.blocks ? tgtFileCache.blocks[blockref] : '';
                if (!tgtBlock) {
                    console.log("MISSING:", `${tgtFile.path}#${anchor}`, "referenced from", source.path, tgtFileCache.blocks);
                    anchors.push([this.pathToMdLink(source.path), '#' + anchor, target]);
                }
            } else {
                const lower = cleanLink.anchor.toLowerCase();
                const tgtHeading = tgtFileCache.headings
                    ? tgtFileCache.headings.find(x => lower == x.heading.toLowerCase()
                        .replace(/[?:]/g, '')
                        .replace('#', ' '))
                    : '';
                if (!tgtHeading) {
                    console.log("MISSING:", `${tgtFile.path}#${anchor}`, "referenced from", source.path, tgtFileCache.headings);
                    anchors.push([this.pathToMdLink(source.path), '#' + anchor, target]);
                }
            }
        }
    }

    pathToMdLink = (path: string): string => {
        return `[${path}](${path.replace(/ /g, '%20')})`;
    }

    /**
     * Render the missing references in the specified file.
     * @param {TFile} file The file to update.
     * @param {Function} renderer The function to generate the missing references content.
     * @returns {Promise<void>}
     */
    renderMissing = async (file: TFile, renderer: RenderFn): Promise<void> => {
        await this.app.vault.process(file, (source) => {
            const match = this.RENDER_MISSING.exec(source);
            if (match) {
                source = match[1];
                source += renderer();
                source += match[2];
            }
            return source;
        });
    }

    /**
     * Create a markdown table with the specified headers and rows.
     * @param {Array<string>} headers The headers for the table.
     * @param {Array<Array<string>>} rows The rows for the table.
     * @returns {string} A markdown table with the specified headers and rows.
     */
    renderTable = (headers: string[], rows: string[][]): string => {
        let result = '';
        result += '|';
        headers.forEach((h) => {
            result += ` ${h} |`;
        });
        result += '\n';

        result += '|';
        headers.forEach(() => {
            result += ' --- |';
        });
        result += '\n';

        rows.forEach((r) => {
            result += '|';
            r.forEach((c) => {
                result += ` ${c} |`;
            });
            result += '\n';
        });
        return result;
    }
}
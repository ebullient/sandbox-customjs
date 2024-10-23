import { RenderFn, Utils } from "./_utils";
import { App, CachedMetadata, TFile } from "obsidian";

interface FileContent {
    file: TFile;
    cache: CachedMetadata;
    text: string;
}

export class HeistSummaries {
    SUMMARIES = /([\s\S]*?<!--indexOf SUMMARIES-->)[\s\S]*?(<!--indexOf END SUMMARIES-->[\s\S]*?)/i;

    app: App;
    utils: Utils;

    targetFile = "heist/all-summaries.md";

    constructor() {  // Constructor
        this.app = window.customJS.app;
        console.log("loaded HeistSummary renderer");
    }

    async invoke() {
        const { Campaign } = await window.cJS();

        const allSummaries = this.app.vault.getFileByPath(this.targetFile);
        if (!allSummaries) {
            console.log(`${this.targetFile} file not found`);
            return;
        }

        const files = this.app.vault.getMarkdownFiles()
            .filter(t => t.path.startsWith("heist/sessions")
                && !t.path.contains("sessions.md")
                && !t.path.includes("encounter"))
            .sort((a, b) => a.path.localeCompare(b.path));

        const promises: Promise<FileContent>[] = files
            .map(file => this.app.vault.cachedRead(file)
                .then(txt => {
                    return {
                        file: file,
                        cache: this.app.metadataCache.getFileCache(file),
                        text: txt
                    };
                })
            );

        const data: FileContent[] = await Promise.all(promises);

        await this.renderSummaries(allSummaries, () => {
            const result = ['\n'];
            for (const d of data) {
                const summary = d.cache.headings.find((h) => h.heading === "Summary");
                const blockHeadingIndex = d.cache.headings.indexOf(summary);
                let txt = d.text;

                const start = summary.position.end.offset;
                let endNum = summary.position.end.offset;
                for (const h of d.cache.headings.slice(blockHeadingIndex + 1)) {
                    if (h.level <= summary.level) {
                        endNum = h.position.start.offset;
                        break;
                    }
                }
                if (endNum - start > 30) {
                    txt = txt.slice(start, endNum);
                    txt = txt.replace(/%%.*?%%/, '').trim();
                }
                result.push(`\n## [${d.file.name}](${d.file.path})\n`);
                result.push(txt.replace(Campaign.eventRegexp, (match, p1, p2) => this.summaryEventSpan([match, p1, p2])));
                result.push('\n');
            }
            return result.join('\n');
        });
    }

    renderSummaries = async (file: TFile, renderer: RenderFn): Promise<void> => {
        await this.app.vault.process(file, (source) => {
            const match = this.SUMMARIES.exec(source);
            if (match) {
                source = match[1];
                source += renderer();
                source += match[2];
            }
            return source;
        });
    }

    summaryEventSpan = (match: string[], suffix: string = ''): string => {
        const text = match[1];
        const date = text.replace(/.*data-date=['"](.*?)-\d{2}['"].*/g, '$1');

        let name = text.contains('data-name="')
            ? text.replace(/.*data-name="(.*?)".*/g, '$1')
            : text.replace(/.*data-name='(.*?)'.*/g, '$1');
        if (!name.endsWith('.') && !name.endsWith('!')) {
            name += '.';
        }

        let data = match[2].trim();
        if (data.length > 0 && !data.endsWith('.') && !data.endsWith('!')) {
            data += '.';
        }

        return `\`${date}\` *${name}* ${data} ${suffix}`;
    }
}

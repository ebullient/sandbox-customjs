import { App } from "obsidian";
import { Reference } from "./reference";

export class TagLists {
    TABLE_SECTION = /([\s\S]*?<!--\s*tagConnection:begin tag="([^"]+?)" type="([^"]+?)"\s*-->)[\s\S]*?(<!--\s*tagConnection:end\s*-->[\s\S]*?)/gi;

    app: App;

    inspectPaths = [
        'heist/tables/waterdeep-connection-tables.md',
    ]

    constructor() {  // Constructor
        this.app = window.customJS.app;
        console.log("loaded TagLists renderer");
    }

    async invoke() {
        const promises = this.inspectPaths.map(path => this.processFile(path));
        return Promise.all(promises);
    }

    async processFile(path: string): Promise<void> {
        const reference: Reference = window.customJS.Reference;
        const file = this.app.vault.getFileByPath(path);
        if (!file) {
            console.log(`${path} file not found`);
            return;
        }

        this.app.vault.process(file, content => {
            const matches = content.matchAll(this.TABLE_SECTION);
            if (!matches) {
                console.log(`No tagConnection section found in ${path}`);
                return content;
            }

            let updatedContent = content; // Use a separate variable to store updated content

            for(const match of matches) {
                console.log(`Found tagConnection section in ${path}`, match);
                const prefix = match[1];
                const tag = match[2];
                const type = match[3];
                const suffix = match[4];

                const items = reference.itemsForTagRaw(tag, type, false);
                console.log(items);

                const generated = ['\n'];
                generated.push(`| ${type} for ${tag} |`);
                generated.push(`|--------|`);
                generated.push(...items.map(i => i.replace(/\s?- /, '| ') + ' |'));
                generated.push(`\n^${type}-items-${tag.replace('/', '-')}\n\n`);

                updatedContent = updatedContent.replace(match[0], prefix + generated.join("\n") + suffix);
            }
            return updatedContent;
        });
    }
}

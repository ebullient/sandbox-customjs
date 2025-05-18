import {
    type App,
    type Editor,
    type FuzzyMatch,
    FuzzySuggestModal,
} from "obsidian";
import { type CampaignEntity, EntityType } from "./@types";
import type CampaignNotesPlugin from "./main";

export class EntitySelectorService {
    app: App;
    plugin: CampaignNotesPlugin;

    constructor(app: App, plugin: CampaignNotesPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    /**
     * Open the entity selector modal
     *
     * @param editor The editor instance (optional)
     * @param type Filter by entity type (optional)
     * @param scopePattern Filter by scope pattern (optional)
     * @param options Link formatting options (optional)
     */
    openEntitySelector(editor: Editor | null = null): void {
        const modal = new EntitySelectorModal(this.plugin, editor);
        modal.open();
    }
}

class EntitySelectorModal extends FuzzySuggestModal<CampaignEntity> {
    plugin: CampaignNotesPlugin;
    editor: Editor | null;
    chosen: CampaignEntity;

    constructor(plugin: CampaignNotesPlugin, editor: Editor | null) {
        super(plugin.app);
        this.plugin = plugin;
        this.editor = editor;
        this.chosen = null;

        this.setPlaceholder("Select an entity");
        this.setInstructions([
            {
                command: "Enter/Click",
                purpose: "Select entity",
            },
            {
                command: "Shift+Enter/Click",
                purpose: "Create link with first name only (NPCs)",
            },
            {
                command: "Esc",
                purpose: "Close modal",
            },
        ]);

        // Add Shift+Enter handler
        this.scope.register(["Shift"], "Enter", (evt: KeyboardEvent) => {
            this.selectActiveSuggestion(evt);
            this.close();
            evt.preventDefault();
            return false;
        });
    }

    getItems(): CampaignEntity[] {
        const scopePattern = this.plugin.settings.defaultScopePattern;
        return this.plugin.index.getEntities(scopePattern);
    }

    getItemText(entity: CampaignEntity): string {
        // Return formatted text for fuzzy search
        const scope = entity.scope ? `[${entity.scope}] ` : "";
        return `${scope}${entity.name} (${entity.type})`;
    }

    renderSuggestion(item: FuzzyMatch<CampaignEntity>, el: HTMLElement): void {
        const entity = item.item;
        const scope = entity.scope ? `[${entity.scope}] ` : "";
        el.createEl("span", {
            text: scope,
            cls: "scope",
        });
        el.createEl("span", {
            text: entity.name,
            cls: "name",
        });
        el.createEl("span", {
            text: `${entity.type}`,
            cls: "type",
        });
    }

    onChooseItem(
        entity: CampaignEntity,
        evt: MouseEvent | KeyboardEvent,
    ): void {
        this.chosen = entity;
        if (this.editor && entity) {
            let name = entity.name;
            if (evt.shiftKey && entity.type === EntityType.NPC) {
                // If Shift+Enter is pressed and the entity is an NPC, use only the first name
                name = name.split(" ")[0];
            }
            const link = `[${name}](${entity.id})`;
            this.editor.replaceSelection(link);
        }
        this.close();
    }
}

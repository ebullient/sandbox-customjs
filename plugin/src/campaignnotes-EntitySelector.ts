import {
    type App,
    type Editor,
    type FuzzyMatch,
    FuzzySuggestModal,
} from "obsidian";
import { type CampaignEntity, EntityType } from "./@types";
import type { CampaignNotesPlugin } from "./campaignnotes-Plugin";

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
                purpose: "Open the entity",
            },
            {
                command: "Shift+Enter/Click",
                purpose: "Open the entity in a new tab",
            },
            {
                command: "Tab",
                purpose: "Create a link to the entity",
            },
            {
                command: "Shift+Tab",
                purpose: "Create link with first name only (NPCs)",
            },
            {
                command: "Esc",
                purpose: "Close modal",
            },
        ]);

        this.scope.register([], "Tab", this.acceptSuggestion.bind(this));
        this.scope.register(["Shift"], "Tab", this.acceptSuggestion.bind(this));
        this.scope.register(
            ["Shift"],
            "Enter",
            this.acceptSuggestion.bind(this),
        );
    }

    acceptSuggestion(evt: KeyboardEvent): boolean {
        this.selectActiveSuggestion(evt);
        this.close();
        evt.preventDefault();
        return false;
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
        console.log(
            "onChooseItem",
            evt.type,
            (evt as KeyboardEvent).key,
            (evt as KeyboardEvent).shiftKey,
        );
        this.chosen = entity;

        // If Tab key is pressed (and we're in an editor), create a link
        if (
            this.editor &&
            this.chosen &&
            evt instanceof KeyboardEvent &&
            evt.key === "Tab"
        ) {
            let name = entity.name;
            if (evt.shiftKey && entity.type === EntityType.NPC) {
                // If Shift+Enter is pressed and the entity is an NPC, use only the first name
                name = name.split(" ")[0];
            }
            const link = `[${name}](${entity.id})`;
            this.editor.replaceSelection(link);
            this.close();
            return;
        }

        const isEnterKey =
            evt instanceof KeyboardEvent
                ? evt.key === "Enter"
                : evt.type === "click";

        if (isEnterKey) {
            this.plugin.app.workspace.openLinkText(entity.id, "", evt.shiftKey);
        }
        this.close();
    }
}

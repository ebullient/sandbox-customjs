# Campaign Notes Plugin

A plugin for indexing and managing TTRPG campaign notes in Obsidian.

This plugin provides APIs for indexing and cross-referencing campaign content, with support for multiple campaigns sharing common elements (like factions that exist across different adventures).

## Vault Structure Assumptions

Content can be shared across campaigns through the scoping system, and should be organized in folders matching that scope.

### Example Structure

```text
vault/
├── faerûn/              # Shared world content
│   ├── groups/          # Cross-campaign organizations
│   ├── npcs/            # World NPCs
│   └── places/          # Regional places
├── heist/               # Campaign-specific content (Waterdeep)
│   ├── characters/      # Campaign NPCs
│   ├── encounters/      # Story encounters
│   ├── sessions/        # Session notes
│   └── waterdeep/       # Waterdeep-specific items
│       ├── groups/      # Cross-campaign organizations
│       ├── npcs/        # World NPCs
│       └── places/      # Regional places
└── assets/
    └── templates/       # Note creation templates (optional)
```

## Note Structure and Frontmatter

### Tags

The plugin relies on a hierarchical tagging system to classify and cross-reference content:

#### Entity Type Tags

- `type/npc` - Non-player characters
- `type/place/[subtype]` - Locations (shop, manor, city, etc.)
- `type/group/[subtype]` - Organizations (faction, family, etc.)
- `type/pc` - Player characters
- `item/[classification]` - Items and equipment

#### Hierarchical Reference Tags

- `place/[region]/[area]/[location]` - Geographic hierarchy
- `group/[organization]/[subdivision]` - Organizational hierarchy, last section is free-form
- `region/[world]/[area]` - Regional classification
- `area/[city]/[district]` - Urban area classification

#### Campaign-Specific Tags

- `[campaign]/iff/[relationship]` - Friend/foe relationships ([NPC_IFF](./src/@types/index.d.ts))
- `[campaign]/npc/[status]` - Alive, dead, undead... (default alive) ([NPCStatus](./src/@types/index.d.ts))
- `[campaign]/events/[type]` - Event categorization (pc, npc, world)

### Defining multiple items in a note

Where there is more than one item in a note (both a Place and an NPC, or multiple NPCs),
frontmatter can be used to identify the item and provide the link to relevant content in the note:

```yaml
---
aliases:
- Kettlewhistle Sisters
npc:
- name: Euphemia Kettlewhistle
  notes: ...
- name: Lidda Kettlewhistle
  notes: ...
- name: Trym Kettlewhistle
  notes: ...
tags:
- heist/iff/family
- place/waterdeep/trollskull-alley/trollskull-manor
- place/waterdeep/trollskull-alley/stone-and-sky
- area/waterdeep/north-ward/trollskull-alley
---
```

This example uses some default behavior:

- All of the NPCs inherit the note tags (linking them to places and iff status)
- The reference link will target a section using their name (a header reference)
- There will be individual notes for each

An alternate (complicated) example is the Guilds of Waterdeep, which are smashed together in one big note.
The frontmatter defines disambiguating/unique tags for each Guild. Links will still reference a heading,
but this allows association for each specific guild, rather than having one document per guild:

```yaml
---
aliases:
- Guilds of Waterdeep
- "#group/waterdeep/guild"
icon: 🦺
group:
  - name: "Bakers' Guild"
    idTag: group/waterdeep/guild/bakers
  - name: "Carpenters', Roofers' and Plasterers' Guild"
    idTag: group/waterdeep/guild/carpenters-roofers-and-plasterers
  - name: "Cellarers' and Plumbers' Guild"
    idTag: group/waterdeep/guild/cellarers-and-plumbers
  - name: "Coopers' Guild"
    idTag: group/waterdeep/guild/coopers
  - name: Council of Farmer-Grocers
...
```

### Multi-Campaign Support

For content shared across campaigns, use campaign-scoped state data:

```yaml
---
aliases: ["Bregan D'aerthe"]
icon: 🧝🏿
state:
  heist:
    status: active
    renown: 3
    notes: Current campaign relationship details
  other_campaign:
    status: unknown
    notes: Different campaign context
tags:
  - group/bregan-daerthe
  - type/group/faction/political
---
```

## Configuration

The plugin uses these settings to determine scope:

- **campaignScopes**: Array of campaign identifiers (e.g., `["faerûn", "heist"]`)
- **includeFolders**: Folders to index (matching campaign scopes)
- **defaultScopePattern**: Regex pattern for automatic scope detection

## Note Templates

The plugin works with Templater templates that:

1. **Prompt for metadata** during creation (tags, relationships, locations)
2. **Auto-generate hierarchical tags** based on user selections
3. **Create cross-references** through embedded queries
4. **Maintain consistent structure** across note types

### Example NPC Frontmatter

```yaml
---
aliases: ["Davil Starsong"]
tags:
  - type/npc
  - place/waterdeep/yawning-portal
  - group/zhenterim/the-doom-raiders
  - area/waterdeep/castle-ward
  - heist/iff/positive
---
```

### Example Session Frontmatter

```yaml
---
tags:
  - timeline
  - heist/events/pc
  - place/waterdeep/yawning-portal
played: 2022-02-06
---
```

## Plugin Architecture and Code Flow

### Initialization and Index Building

When the plugin loads, it follows this initialization sequence:

1. **Load Settings** - Read configuration from `data.json`
2. **Initialize Services** - Create core service instances:
   - `CampaignNotesIndex` - Main entity indexing service
   - `CampaignNotesCache` - Caching layer for performance
   - `TableGenerationService` - Static content generation
   - `EntitySelectorService` - Entity selection modal
3. **Expose API** - Make `CampaignReference` available at `window.campaignNotes.api`
4. **Register Commands** - Add Obsidian commands for user interaction
5. **Start Indexing** - Build initial index when workspace is ready
6. **Register File Events** - Monitor vault changes to keep index current

### Index Building Process

The index building process (`CampaignNotesIndex.rebuildIndex()`) works as follows:

1. **Clear Existing Index** - Remove all cached entity data
2. **Scan Included Folders** - Find all markdown files in configured `includeFolders`
3. **Process Each File** - For each file:
   - Parse frontmatter and extract metadata
   - Identify entity types from tags (e.g., `type/npc`, `type/place`)
   - Create entity objects with hierarchical tag relationships
   - Build cross-reference indexes by tag, type, and file path
4. **Generate Secondary Indexes** - Create lookup maps for:
   - Entities by tag (`group/harpers` → all Harper entities)
   - Entities by type (`EntityType.NPC` → all NPCs)
   - Entities by file path (for file modification tracking)

### Real-time Index Updates

The plugin monitors vault changes and updates the index automatically:

- **File Creation** - Process new files and add entities to index
- **File Modification** - Re-parse changed files and update entity data
- **File Deletion** - Remove entities and clear cached references
- **File Rename** - Update file path references throughout the index

## Commands and Content Generation

The plugin provides three main commands accessible through Obsidian's command palette:

### 1. Rebuild Campaign Notes Index

**Command ID**: `rebuild-campaign-notes-index`

Manually triggers a complete index rebuild. Useful when:

- Changing plugin configuration
- Recovering from index corruption
- After bulk file operations outside Obsidian

### 2. Regenerate Index Tables

**Command ID**: `regenerate-index-tables`

Scans notes for static content sections and regenerates them with current index data. Looks for HTML comment markers like:

```html
<!-- NPCS BEGIN -->
(generated content will be replaced here)
<!-- NPCS END -->
```

Supported section types:

- `ENCOUNTERS` - List of encounter entities
- `GROUPS` - List of group/faction entities
- `NPCS` - List of NPC entities
- `PLACES` - List of place/location entities
- `RENOWN` - Renown/reputation tables
- `tagConnection` - Custom tag-based connection tables

### 3. Find Entity (Entity Selector Modal)

**Command ID**: `insert-entity-link`

Opens a fuzzy search modal for finding and linking to indexed entities. Features:

- **Fuzzy Search** - Type partial names to find entities
- **Multiple Actions**:
    - `Enter/Click` - Open the entity file
    - `Shift+Enter/Click` - Open in new tab
    - `Tab` - Insert link to entity at cursor
    - `Shift+Tab` - Insert link using first name only (for NPCs)

The modal searches across all indexed entities and provides contextual information like:

- Entity name and aliases
- Entity type and status indicators
- File location and scope information

## API Integration

The plugin exposes functionality through `window.campaignNotes.api` for use in CustomJS scripts and templates, enabling:

- Dynamic entity selection and filtering
- Cross-reference generation
- Timeline and event management
- Table generation for random encounters
- Relationship tracking and visualization

### Types

See [types](src/@types/index.d.ts) to understand the TypeScript interfaces for each entity type: Encounter, NPC, Group (faction), Place/Area, and their associated metadata structures.

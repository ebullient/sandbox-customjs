# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This project has three main parts:
- **`src/`** - CustomJS scripts
- **`plugin/`** - Campaign Notes Obsidian plugin (bundled with esbuild, provides APIs to CustomJS scripts)
- **`plugin-tasks/`** - Task Index Obsidian plugin with ADHD-friendly review workflow

All sources are compiled to JavaScript, then deployed as vault assets.

## Your Role

You are a senior development peer working alongside a Senior Software Engineer (25+ years, primarily Java background) on this hobby TypeScript project. Act as a collaborative partner for:
- **Code review and feedback** when requested - focus on patterns, maintainability, and TypeScript/JS idioms
- **Implementation assistance** when explicitly asked - suggest approaches, don't implement unless requested
- **Technical discussion** and problem-solving - challenge assumptions, ask probing questions, offer alternatives

## Development Guidelines

**Core Principles:**
- **Follow existing patterns** - Find similar functions in the same module and emulate them
- **Understand before acting** - Read project structure, but defer extensive file reading until user specifies what to work on
- **Ask for clarification** when implementation choices or requirements are unclear
- **Be direct and concise** - Assume high technical competence, reference specific files/line numbers
- **Respect privacy** - Do not read .env* files unless instructed
- **Never speculate** - Don't make up code unless asked
- **Point out issues proactively** but wait for explicit requests to fix them

**API Requirements:**
This project creates tools for working with Obsidian notes, relying on several plugins (CustomJS, JSEngine, and Templater). All types and parameters must function with these plugin expectations:
- Obsidian: node_modules/obsidian/obsidian.d.ts
- Templater: https://silentvoid13.github.io/Templater/
- JSEngine: https://www.moritzjung.dev/obsidian-js-engine-plugin-docs/api/classes/api/
- CustomJS: https://github.com/saml-dev/obsidian-custom-js, specifically:
    - each file may only contain/define/export a class
    - types/interface definitions are allowed

**Problem-Solving Process:**
1. **Think through the problem systematically** - analyze context and identify specific files/components involved
2. Consider multiple approaches and choose solutions that align with codebase patterns
3. **Break complex changes into smaller parts** when dealing with multi-component modifications
4. Implement carefully with attention to edge cases and error handling
5. Verify the solution addresses all stated requirements
6. Express uncertainty when appropriate rather than guessing

**Context Strategy:**
- For isolated changes: focus on the specific file/module
- For API changes: check both plugin and CustomJS usage patterns
- For workflow changes: examine the full data flow (source → processing → target)
- When unsure of scope: ask before reading extensively

## Commands

### Building and Development

- `npm run build` - Build both CustomJS scripts and Obsidian plugin
- `npm run dev` - Build and watch for changes, automatically pushing to repositories
- `npm run push` - Push built files to target repositories
- `npm run lint` - Lint all TypeScript files using Biome
- `npm run fix` - Auto-fix linting issues
- `npm run format` - Format code using Biome

### Component-specific commands

- `npm run build:customjs` - Build only the CustomJS TypeScript files
- `npm run build:plugin` - Build only the Obsidian plugin
- `npm run dev:customjs` - Watch and build CustomJS files
- `npm run dev:plugin` - Watch and build plugin files

## Architecture

This repository contains three main components:

### 1. CustomJS Scripts (`src/`)

TypeScript scripts that replace Dataview functionality in Obsidian vaults. These are compiled to JavaScript and deployed to vault assets directories. Key modules:

- **_utils.ts** - Core utility functions used across all scripts
- **areaRelated.ts** - Quest/area relationship management (renamed from priority.ts, removed priority/status/urgency fields)
- **Command modules** (`cmd-*.ts`) - CustomJS commands for vault operations like task cleanup, timeline generation, and content indexing
- **Domain modules** - Specialized functionality for different vault types:
    - AllTheThings vault: activity.ts, dated.ts, tasks.ts, templater.ts
    - Campaign Notes vault: campaign.ts, reference.ts

### 2. Campaign Notes Plugin (`plugin/`)

"Campaign Index" plugin that provides APIs and indexing for campaign note management:

- **Main plugin** (`src/campaignnotes-Plugin.ts`, exported via `src/main.ts`) - Plugin entry point with service initialization
- **Core services**:
    - CampaignNotesIndex - File indexing and metadata management
    - CampaignNotesCache - Caching layer for performance
    - EntitySelectorService - Entity selection UI components
    - TableGenerationService - Dynamic table generation
- **API layer** (`src/campaignnotes-Api.ts`) - Exposes plugin functionality to CustomJS scripts via `window.campaignNotes.api`

### 3. Task Index Plugin (`plugin-tasks/`)

"Task Index" plugin providing ADHD-friendly quest/project review workflow:

- **Main plugin** (`src/main.ts`) - Plugin entry point with review queue management
- **Core services**:
    - QuestIndex - Indexes quest/area files with tasks and metadata
    - ReviewDetector - Identifies projects needing attention (stale, no #next tasks, missing sphere)
    - ReviewModal - Interactive review UI with progress tracking and defer functionality
    - TaskParser - Parses markdown tasks with GTD tags (#next, #waiting, #someday)
    - FileUpdater - Updates quest files with changes from review
- **API layer** (`src/TaskIndex-Api.ts`) - Exposes quest data and configuration via `window.taskIndex.api`
- **ADHD Features**:
    - Frozen review list (no loops)
    - Progress indicators (X of Y, percentage)
    - Defer button (push to end of queue for later)
    - Clear action prompts explaining why each project needs review

### Build System

- **TypeScript compilation** for CustomJS scripts
- **esbuild** for plugin bundling
- **Biome** for linting and formatting
- **Custom local deployment** system using `.dev-target.json` to push built files to multiple local vault locations

### Vault Structure Support

The scripts support two distinct vault structures:

- **AllTheThings**: PARA-style areas/projects with Franklin-Covey prioritization
- **Campaign Notes**: TTRPG content with sessions, NPCs, locations, and timeline events using Calendarium integration

### Integration Points

- CustomJS scripts can access plugin functionality through:
    - `window.campaignNotes.api` - Campaign notes indexing and entity management
    - `window.taskIndex.api` - Quest/area data, role/sphere configuration
- Scripts work with Templater for interactive note creation
- Deep integration with Calendarium for timeline and event management
- Support for complex tagging hierarchies and cross-referencing systems
- Task Index plugin provides review workflow command: "What needs review?"

## Content Management Workflows

When working with content management systems (like templater.ts), document the main workflow patterns:

- **Pattern 1: Conversation References** - Linking to specific conversation sections
- **Pattern 2: Daily Progress Tracking** - Moving accomplishments from daily notes to projects
- **Pattern 3: Weekly Planning** - Using weekly files as staging areas for project tasks

Include purpose, source/target file types, and output examples for each pattern to make complex workflows understandable.

When documenting workflows, structure them as:
- **Purpose**: What this pattern accomplishes
- **Source**: Where the data/content originates
- **Target**: Where it gets processed/stored
- **Examples**: Concrete input → output transformations

## Code Style Guidelines

When working with TypeScript code in this repository, follow these formatting and style preferences:

### Formatting Rules

- **Line length**: Target approximately 80 characters per line (Biome will enforce this)
- **Trailing commas**: Biome will automatically add trailing commas to parameters, arrays, and objects - don't remove them
- **Parameter lists**: When parameters span multiple lines, Biome will add trailing commas - preserve them for consistency
- **Method chaining**: Always preserve line breaks at dots for readability:
  ```typescript
  // Good - chained operations wrapped at dots
  const files = this.utils()
      .filesWithPath(regex)
      .map((x) => x.path);

  // Avoid - smashed on one line
  const files = this.utils().filesWithPath(regex).map((x) => x.path);
  ```

### Control Flow Style

- **Always use braces**: Never use single-line conditionals without braces (easier to spot and modify)
  ```typescript
  // Good
  if (condition) {
      doSomething();
  }

  // Avoid
  if (condition) doSomething();
  ```

- **Ternary operators**: Put `?` and `:` on separate lines for better readability:
  ```typescript
  // Good
  const result = condition
      ? valueIfTrue
      : valueIfFalse;

  // Avoid
  const result = condition ? valueIfTrue : valueIfFalse;
  ```

### Template Literals

- **Multi-line strings**: Prefer arrays or concatenation over template literals that push content to the margin:
    ```typescript
    // Good - using array join
    const markdown = [
        `- [**${title}**](${file.path}#${day})`,
        `    ![${day}](${file.path}#${day})`,
    ].join("\n");

    // Good - using concatenation
    let markdown = `- [**${title}**](${file.path}#${day})\n`;
    markdown += `    ![${day}](${file.path}#${day})\n`;

    // Avoid - content pushed to margin/gutter
    const markdown = `
    - [**${title}**](${file.path}#${day})
        ![${day}](${file.path}#${day})
    `;

    // Avoid - long single lines that Biome might wrap awkwardly
    const markdown = `\n- [**${title}**](${file.path}#${day})\n    ![${day}](${file.path}#${day})\n`;
    ```

### Pattern Consistency

- **Centralize regex patterns**: Define all regex patterns in a single class property (like `patterns`) rather than scattered throughout methods
- **Reuse existing patterns**: Before creating new regex, check if existing patterns can be reused (e.g., `completed` pattern instead of creating `completionDate`)
- **Extract complex logic**: Break down complex methods into smaller, focused helper methods with descriptive names
- **Consistent parameter flow**: API methods should handle user interaction, then delegate to `do*` methods for implementation

### API Compatibility Requirements

- **Templater API requirements**: `pushOptions` must be `string[]` arrays, not `const` arrays
- **Date handling**: Use filename-based date extraction with fallbacks (line text → file path → current date)
- **File detection**: Use consistent patterns like `endsWith("_week.md")` for file type detection

### Refactoring Guidelines

When cleaning up existing code:
- **Preserve API compatibility**: Internal refactoring should not change public method signatures
- **Extract before you abstract**: Move duplicate logic to helper methods before creating new abstractions
- **Test with linting**: Always run `npm run lint` after refactoring to catch issues early
- **Document complex workflows**: Add comprehensive comments explaining multi-step processes

## Quality Assurance

- Always run `npm run build` after significant code changes, which includes linting step
- Consider backward compatibility and API stability
- Reference specific line numbers when discussing code issues (format: `file.ts:123`)

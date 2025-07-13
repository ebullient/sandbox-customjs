# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

This repository contains two main components:

### 1. CustomJS Scripts (`src/`)

TypeScript scripts that replace Dataview functionality in Obsidian vaults. These are compiled to JavaScript and deployed to vault assets directories. Key modules:

- **_utils.ts** - Core utility functions used across all scripts
- **Command modules** (`cmd-*.ts`) - CustomJS commands for vault operations like task cleanup, timeline generation, and content indexing
- **Domain modules** - Specialized functionality for different vault types:
    - AllTheThings vault: activity.ts, dated.ts, priority.ts, tasks.ts, templater.ts
    - Campaign Notes vault: campaign.ts, reference.ts

### 2. Obsidian Plugin (`plugin/`)

"Campaign Index" plugin that provides APIs and indexing for campaign note management:

- **Main plugin** (`src/main.ts`) - Plugin entry point with service initialization
- **Core services**:
    - CampaignNotesIndex - File indexing and metadata management
    - CampaignNotesCache - Caching layer for performance
    - EntitySelectorService - Entity selection UI components
    - TableGenerationService - Dynamic table generation
- **API layer** (`src/CampaignNotes-Api.ts`) - Exposes plugin functionality to CustomJS scripts via `window.campaignNotes.api`

### Build System

- **TypeScript compilation** for CustomJS scripts
- **esbuild** for plugin bundling
- **Biome** for linting and formatting
- **Custom deployment** system using `.dev-target.json` to push built files to multiple vault locations

### Vault Structure Support

The scripts support two distinct vault structures:

- **AllTheThings**: PARA-style areas/projects with Franklin-Covey prioritization
- **Campaign Notes**: TTRPG content with sessions, NPCs, locations, and timeline events using Calendarium integration

### Integration Points

- CustomJS scripts can access plugin functionality through the global `window.campaignNotes.api`
- Scripts work with Templater for interactive note creation
- Deep integration with Calendarium for timeline and event management
- Support for complex tagging hierarchies and cross-referencing systems

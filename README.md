# Sandbox: CustomJS + JS Engine

These are the scripts I use in my vault(s) to replace Dataview

I have two vaults: AllTheThings (actually, just most of the things) and Campaign Notes (TTRPG stuff).

I converted my CustomJS scripts to TypeScript, which brings some caveats to keep CustomJS happy.

## Building

```console
pnpm install

# Just build
npm run build

# Push built files to repositories
npm run push

# Build and watch for changes (and push those changes to repositories)
npm run dev

# Lint / Clean up files
npm run lint
```

## Pushing files to repositories

I have two repos, and not all of these scripts go to both places.

I use a json file, `.dev-target.tson` to determine what files to copy where. It contains something like the following: 

```json
{
  "_utils.ts": [
    "/path/to/AllTheThings/assets/customjs/",
    "/path/to/campaign-notes/assets/customjs/"
  ],
}
```

For each file in there, I define 1..n places it should get pushed. Works for me, you may think it's ridiculous. ;)

The scripts that achieve this are in `build/`

## Plugins

In addition to CustomJS scripts, this repository contains Obsidian plugins that provide additional functionality:

### Task Index Plugin (`plugin-tasks/`)

ADHD-friendly GTD task management plugin for the AllTheThings vault with project review and weekly planning workflows.

**Commands:**
- **"What needs review?"** - Interactive review workflow for projects needing attention
- **"Plan this week"** - View all actionable tasks (#next or due dates) grouped by sphere

**Features:**
- **Quest/Area Indexing**: Automatically indexes project and area files with tasks and metadata
- **Smart Review Detection**: Identifies projects needing review based on:
  - No #next tasks (skipped if current week already links to the project)
  - Stale projects (not modified in N weeks)
  - Long-waiting tasks (#waiting tasks older than N days)
  - Missing sphere assignment
  - Overdue tasks or tasks due today
- **ADHD-Friendly Review Workflow**:
  - Frozen review list (no loops - items don't reappear if updated during review)
  - Progress tracking: "Reviewing X of Y (25% complete)"
  - Defer button: push items to end of queue for later review
  - Clear action prompts explaining why each project needs attention
  - Edit sphere, purpose, and tasks inline
  - Quick task actions via dropdown (mark #next, #waiting, #someday, complete, cancel)
- **Weekly Planning Modal**:
  - Shows all quests with actionable tasks
  - Filter by sphere
  - Click to jump directly to Tasks section
  - Summary counts for #next and due tasks
- **API for CustomJS**: Exposes quest data and configuration via `window.taskIndex.api`

**Integration with AllTheThings vault:**
- Works with PARA-style quest/area files
- Supports GTD task tags (#next, #waiting, #someday) and due dates
- Detects backlinks from weekly planning files
- Complements areaRelated.ts and tasks.ts CustomJS scripts

## Repository structure

### AllTheThings

```
├ assets/
│ ├ customjs/
│ └ templates/
├ chronicles/
│ ├ yyyy/
│ │ ├ yyyy-mm-dd.md 
│ │ ├ yyyy-mm-dd_week.md 
│ │ ├ yyyy-mm_month_.md 
│ │ └ yyyy.md 
│ └ ...
├ demesne (areas)
└ quests (projects)
```

For PARA-esque areas and projects (with funner names), I fall back to a Franklin-Covey-ish prioritization scheme: urgent and important are first; not-urgent and not-important are last. The frontmatter looks like this: 

```yaml
---
aliases: ["Note Alias"]
type: quest
role: owner
sphere: community
---
```

I prompt for important, urgent, status, and role on creation.

### Campaign Notes

```
├ assets/
│ ├ customjs/
│ └ templates/
├ heist/
│ ├ calendar/
│ │ ├ yyyy-harptosMonth-dd.md 
│ │ └ ... 
│ ├ characters/  (pc notes)
│ ├ encounters/  (encounter notes: e.g. multi-session events, story threads)
│ ├ sessions/
│ │ └ nnn-session-title.md 
│ ├ tables/
│ │ └ random generator tables
│ ├ waterdeep/
│ │ ├ calendar/  (events and holidays) 
│ │ ├ groups/    (notes for groups and factions) 
│ │ ├ npcs/      (notes for npcs) 
│ │ ├ places/    (notes for locations, which may include npcs) 
│ │ └ ... 
│ ├ all-summaries.md
│ ├ all-timeline.md
│ ├ grouped-timeline.md
│ ├ heist.md
│ └ ...
└ ...
```

I use deeply nested tags in my notes. I have templater prompts to work through selecting tags from the right scope for all known tags, etc.

I use a *LOT* of events in my notes (session notes and others).

- I use with Calendarium span tag (never front-matter).
- I have an emoji key that I use to code event descriptions: 

My events look like this: 

```html
<span data-date='1499-Mirtul-02-20' data-category='heist' data-name="🧵😵🦹💃🗿 Dalakhar makes a run for the Stone and Sky">...</span>
```

## Development

For build commands, architecture overview, and development guidance, see [CLAUDE.md](CLAUDE.md).

This file is primarily written for Claude Code (AI assistant) but contains useful information for human contributors as well, including:

- Build and development commands
- Project architecture overview
- Integration points between components

## Scripts

The Templater templates that work with these scripts are in the templates directory

**Common**

- [_utils.ts](src/_utils.ts) - general utility functions
- [cmd-missing.ts](src/cmd-task-cleanup.ts) - CustomJS command; evaluate contents of vault, and update a note to list missing links and unreferenced files

**AllTheThings**

- [activity.ts](src/activity.ts) - activity charts, created by counting occurence of tags
- [areaRelated.ts](src/areaRelated.ts) - Functions for working with PARA-esque Projects and Areas (quest/area relationships, role, sphere)
- [cmd-all-tasks.ts](src/cmd-all-tasks.ts) - CustomJS command; create/update a note that embeds `Tasks` sections grouped by sphere
- [cmd-task-cleanup.ts](src/cmd-task-cleanup.ts) - CustomJS command; evaluate contents of vault. Find tasks completed earlier than this month, and remove their task status (✔️ or 〰️)
- [dated.ts](src/dated.ts) - Working with dated notes: daily notes for time blocking, weekly notes for planning, monthly for goals/reflection, years for "dates to remember"
- [tasks.ts](src/tasks.ts) - Functions for working with tasks (finding tasks in a file, collecting tasks completed in a given week grouped by sphere)
- [templater.ts](src/templater.ts) - Functions that augment templater templates (choosing values for prompts, transporting text

**Campaign Notes**

- [campaign.ts](src/activity.ts) - Campaign-specific utility functions
- [cmd-heist-summaries.ts](src/cmd-heist-summaries.ts) - CustomJS command; merges the summary sections from all heist session notes into one note 
- [cmd-tag-lists.ts](src/cmd-tag-lists.ts) - CustomJS command; evaluate contents of vault. Find all notes with a certain tag, and create a rollable table with a row for each note (dice roller w/o dataview)
- [cmd-timeline.ts](src/cmd-timeline.ts) - CustomJS command; Use the Calendarium API to find all events for a particular calendar. Update the contents of two notes: all-timeline (all events in chronological order), and grouped-timeline (all events grouped by faction or group, as determined by an emoji in the event title)
- [reference.ts](src/reference.ts) - utility functions to find and create cross-referencing lists or tables for different types (locations, npcs, areas, factions)

# Task Index Plugin

Personal Obsidian plugin for indexing quest/area files and managing tasks with an ADHD-friendly review workflow.

## Overview

This plugin provides:
- **Quest/Area Indexing** - Automatically indexes project and area files with their tasks
- **Smart Review System** - Identifies projects needing attention (stale, no next tasks, missing sphere, etc.)
- **ADHD-Friendly Workflow** - Progress tracking, defer functionality, and clear action prompts
- **Task Management** - Parse and track tasks with GTD-style tags (#next, #waiting, #someday)
- **API for CustomJS** - Exposes quest data and configuration via `window.taskIndex.api`

## Development

This plugin is part of the sandbox-customjs repository and follows the same build patterns as the Campaign Index plugin.

### Building

From the repository root:
```bash
npm run build:plugin-tasks
```

### Development Mode

From the repository root:
```bash
npm run dev:plugin-tasks
```

## Commands

### "What needs review?"
Opens the review workflow to triage projects/quests that need attention.

**Review Triggers:**
- **No #next tasks** - Projects with tasks but none tagged #next (skipped if current week already links to the project)
- **Stale project** - Not modified in 4+ weeks (configurable)
- **Long waiting tasks** - Tasks tagged #waiting for 14+ days (configurable)
- **Missing sphere** - Project lacks sphere assignment
- **Overdue tasks** - Has tasks with due dates that are overdue or due today

**Review Workflow (ADHD-Friendly):**
1. Shows progress: "Reviewing X of Y (25% complete)"
2. Displays why each project needs attention with clear, actionable prompts
3. Four button options:
   - **Cancel** - Exit review session
   - **Defer** - Not ready to decide? Puts item at end of queue to review later
   - **Skip** - Reviewed, move to next (doesn't come back)
   - **Save & Next** - Save changes and continue

**Key Features:**
- Review list is **frozen at session start** - items don't loop back if you update them during review
- Smart detection: Won't nag about missing #next if you've already linked the project in your weekly plan
- Clear priority sorting: overdue tasks and missing spheres surface first

### "Plan this week"
Opens a planning modal showing all quests with actionable items.

**Features:**
- Shows all quests with **#next tasks** or **due dates**
- Filter by sphere using dropdown
- Grouped by sphere with task counts
- Click quest title to jump directly to Tasks section
- Summary shows total actionable tasks across filtered quests

## Structure

- `src/taskindex-Plugin.ts` (exported via `src/main.ts`) - Plugin entry point with review and planning commands
- `src/taskindex-QuestIndex.ts` - Indexes quest/area files and parses tasks
- `src/taskindex-ReviewDetector.ts` - Identifies projects needing review with priority scoring
- `src/taskindex-ReviewModal.ts` - Interactive review UI with defer/skip functionality
- `src/taskindex-WeeklyPlanningModal.ts` - Planning UI showing actionable tasks grouped by sphere
- `src/taskindex-TaskParser.ts` - Parses markdown tasks with GTD tags and due dates
- `src/taskindex-FileUpdater.ts` - Updates quest files with changes from review
- `src/taskindex-Api.ts` - Public API for CustomJS scripts
- `src/@types/` - TypeScript type definitions

## Configuration

Settings can be adjusted in the plugin settings tab:

- **Valid Spheres** - Areas of life (work, home, community, etc.)
- **Current Sphere Focus** - Which sphere you're focusing on
- **Quest Folders** - Folders to scan for quest/area files
- **Valid Types** - Frontmatter type values to index (quest, area, project, demesne)
- **Stale Project Threshold** - Weeks before a project is considered stale
- **Long Waiting Threshold** - Days before #waiting tasks trigger review

## Integration

The plugin exposes APIs via `window.taskIndex.api` for use by CustomJS scripts:

```typescript
// Get all indexed quests
const quests = window.taskIndex.api.getAllQuests();

// Get a specific quest
const quest = window.taskIndex.api.getQuest("path/to/quest.md");

// Get quests by sphere
const workQuests = window.taskIndex.api.getQuestsBySphere("work");

// Get configuration
const roles = window.taskIndex.api.getValidRoles(); // ["owner", "collaborator", "observer"]
const spheres = window.taskIndex.api.getValidSpheres();
const roleEmoji = window.taskIndex.api.getRoleVisual("owner"); // "🖐"
```

## File Structure

Quest/area files should have:
- **Frontmatter**: `type`, `sphere`, `role`
- **Purpose section**: From frontmatter end to `## Tasks` heading
- **Tasks section**: `## Tasks` heading with task list below

Example:
```markdown
---
type: quest
sphere: work
role: owner
---
# Project Name

Project purpose and context here.

## Tasks
- [ ] First task #next
- [ ] Another task #waiting
- [ ] Future task #someday
```

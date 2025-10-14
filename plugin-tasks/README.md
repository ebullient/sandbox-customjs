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
- No #next tasks defined
- Project hasn't been updated in 4+ weeks (stale)
- Tasks have been #waiting for 14+ days
- Missing sphere assignment
- In your current focus sphere

**Review Workflow (ADHD-Friendly):**
1. Shows progress: "Reviewing X of Y (25% complete)"
2. Displays why each project needs attention with actionable prompts
3. Four button options:
   - **Cancel** - Exit review session
   - **Defer** - Not ready to decide? Puts item at end of queue to try later
   - **Skip** - Reviewed, move to next (doesn't come back)
   - **Save & Next** - Make changes and continue

**Key Feature:** Review list is **frozen at session start** - items don't loop back if you update them during review.

### "Plan this week"
(Coming soon) View all #next tasks for weekly planning.

## Structure

- `src/main.ts` - Plugin entry point and review workflow
- `src/QuestIndex.ts` - Indexes quest/area files and parses tasks
- `src/ReviewDetector.ts` - Identifies projects needing review
- `src/ReviewModal.ts` - Interactive review UI
- `src/TaskParser.ts` - Parses markdown tasks with GTD tags
- `src/FileUpdater.ts` - Updates quest files with changes
- `src/TaskIndex-Api.ts` - Public API for CustomJS scripts
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

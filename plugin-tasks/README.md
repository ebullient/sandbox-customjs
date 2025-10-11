# Task Index Plugin

Personal Obsidian plugin for indexing and managing task-related data.

## Overview

This plugin provides:
- Task data indexing
- Task-related APIs for CustomJS scripts
- Task management commands

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

## Structure

- `src/main.ts` - Plugin entry point
- `src/@types/` - TypeScript type definitions
- `src/TaskIndex-*.ts` - Core services and functionality

## Integration

The plugin exposes APIs via `window.taskIndex.api` for use by CustomJS scripts.

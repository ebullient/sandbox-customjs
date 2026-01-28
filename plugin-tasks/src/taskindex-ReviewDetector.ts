import { type App, getAllTags } from "obsidian";
import type {
    CurrentSettings,
    QuestFile,
    ReviewItem,
    ReviewReason,
} from "./@types";

/**
 * Detects which projects need review
 */
export class ReviewDetector {
    constructor(
        private app: App,
        private settings: CurrentSettings,
    ) {}

    /**
     * Analyze a quest and determine if it needs review
     */
    analyzeQuest(quest: QuestFile): ReviewItem | null {
        const reasons: ReviewReason[] = [];
        let priority = 0;

        const cache = this.app.metadataCache.getCache(quest.path);

        // Check for missing sphere
        if (!quest.sphere) {
            reasons.push("no-sphere");
            priority += 10; // High priority - required field
        }

        const monitored = getAllTags(cache).contains("#project");

        // Check for no #next tasks (but skip if current week links to this project)
        if (
            monitored &&
            !quest.hasNextTasks &&
            quest.tasks.length > 0 &&
            !this.isLinkedFromCurrentWeek(quest.path)
        ) {
            reasons.push("no-next-tasks");
            priority += 5;
        }

        // Check for overdue tasks (high priority)
        if (monitored && quest.hasOverdueTasks) {
            reasons.push("overdue-tasks");
            priority += 8;
        }

        // Check for stale project (not modified in X weeks)
        const weeksSinceModified = this.getWeeksSinceModified(quest);
        if (
            monitored &&
            weeksSinceModified >= this.settings.current().staleProjectWeeks
        ) {
            reasons.push("stale-project");
            priority += 3;
        }

        // Check for long-waiting tasks (future feature)
        if (monitored && quest.hasWaitingTasks && quest.oldestWaitingDate) {
            const daysSinceWaiting = this.getDaysSince(quest.oldestWaitingDate);
            if (daysSinceWaiting >= this.settings.current().waitingTaskDays) {
                reasons.push("long-waiting");
                priority += 4;
            }
        }

        // If no reasons, don't need review
        if (reasons.length === 0) {
            return null;
        }

        return {
            quest,
            reasons,
            priority,
        };
    }

    /**
     * Get all quests that need review, sorted by priority
     */
    getReviewList(quests: QuestFile[]): ReviewItem[] {
        const items: ReviewItem[] = [];

        for (const quest of quests) {
            const item = this.analyzeQuest(quest);
            if (item) {
                items.push(item);
            }
        }

        // Sort by priority (highest first)
        items.sort((a, b) => b.priority - a.priority);

        return items;
    }

    /**
     * Get human-readable description of review reasons
     */
    getReasonDescription(reason: ReviewReason): string {
        switch (reason) {
            case "no-sphere":
                return "Missing sphere";
            case "no-next-tasks":
                return "No #next tasks";
            case "overdue-tasks":
                return "Has overdue tasks";
            case "stale-project":
                return `Not updated in ${this.settings.current().staleProjectWeeks} weeks`;
            case "long-waiting":
                return `Has tasks waiting ${this.settings.current().waitingTaskDays}+ days`;
        }
    }

    /**
     * Calculate weeks since last modification
     */
    private getWeeksSinceModified(quest: QuestFile): number {
        const now = Date.now();
        const diff = now - quest.lastModified;
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
    }

    /**
     * Calculate days since a timestamp
     */
    private getDaysSince(timestamp: number): number {
        const now = Date.now();
        const diff = now - timestamp;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    /**
     * Build the current week file path: chronicles/YYYY/YYYY-MM-DD_week.md
     * Uses the Monday of the current week
     */
    private getCurrentWeekFilePath(): string {
        const today = window.moment();
        const monday = today.clone().day(1);
        return monday.format("[chronicles]/YYYY/YYYY-MM-DD[_week.md]");
    }

    /**
     * Check if the current week's file links to a project
     */
    private isLinkedFromCurrentWeek(questPath: string): boolean {
        const weekPath = this.getCurrentWeekFilePath();
        const resolvedLinks = this.app.metadataCache.resolvedLinks[weekPath];
        return resolvedLinks?.[questPath] > 0;
    }
}

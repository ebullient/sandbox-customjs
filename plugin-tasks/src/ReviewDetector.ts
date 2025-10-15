import type { QuestFile, ReviewItem, ReviewReason, TaskIndexSettings } from "./@types";

/**
 * Detects which projects need review
 */
export class ReviewDetector {
    constructor(private settings: TaskIndexSettings) {}

    /**
     * Analyze a quest and determine if it needs review
     */
    analyzeQuest(quest: QuestFile): ReviewItem | null {
        const reasons: ReviewReason[] = [];
        let priority = 0;

        // Check for missing sphere
        if (!quest.sphere) {
            reasons.push("no-sphere");
            priority += 10; // High priority - required field
        }

        // Check for no #next tasks
        if (!quest.hasNextTasks && quest.tasks.length > 0) {
            reasons.push("no-next-tasks");
            priority += 5;
        }

        // Check for stale project (not modified in X weeks)
        const weeksSinceModified = this.getWeeksSinceModified(quest);
        if (weeksSinceModified >= this.settings.staleProjectWeeks) {
            reasons.push("stale-project");
            priority += 3;
        }

        // Check for long-waiting tasks
        if (quest.hasWaitingTasks && quest.oldestWaitingDate) {
            const daysSinceWaiting = this.getDaysSince(quest.oldestWaitingDate);
            if (daysSinceWaiting >= this.settings.waitingTaskDays) {
                reasons.push("long-waiting");
                priority += 4;
            }
        }

        // Check sphere focus match
        if (this.settings.currentSphereFocus && quest.sphere === this.settings.currentSphereFocus) {
            reasons.push("sphere-focus");
            priority += 2;
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
            case "stale-project":
                return `Not updated in ${this.settings.staleProjectWeeks} weeks`;
            case "long-waiting":
                return `Has tasks waiting ${this.settings.waitingTaskDays}+ days`;
            case "sphere-focus":
                return `Matches current focus: ${this.settings.currentSphereFocus}`;
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
}

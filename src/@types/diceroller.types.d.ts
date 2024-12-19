// Note: Partial DiceRoller API

import type { Component } from "obsidian";

export interface DiceRoller {
    getRoller(
        raw: string,
        source?: string,
        options?: unknown,
    ): BasicRoller | null;
    parseDice(formula: string, source: string): Promise<RollResult>;
}

export interface RollResult {
    result: string;
    roller: BasicRoller;
}

export interface BasicRoller extends Component {
    roll(): Promise<unknown>;
}

declare global {
    interface Window {
        DiceRoller: DiceRoller;
    }
}

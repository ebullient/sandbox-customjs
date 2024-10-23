// Note: Partial DiceRoller API

export interface DiceRoller {
    parseDice(formula: string, source: string): Promise<{ result: string, roller: unknown }>;
}

declare global {
    interface Window {
        DiceRoller: DiceRoller;
    }
}

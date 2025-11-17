import type { Calendarium } from "./@types/calendarium.types";
import type { CustomJSType } from "./@types/customjs.types";
import type { DiceRoller } from "./@types/diceroller.types";
import type { FilterFn } from "./@types/journal-reflect.types";
import type { TaskIndex } from "./@types/taskIndex.types";

declare global {
    interface Window {
        Calendarium: Calendarium;

        forceLoadCustomJS?: () => Promise<void>;
        cJS?: (
            moduleOrCallback?: string | ((customJS: CustomJSType) => void),
        ) => Promise<CustomJSType>;
        customJS?: CustomJSType;

        DiceRoller: DiceRoller;

        taskIndex: {
            api: TaskIndex;
        };

        journal?: {
            filters?: Record<string, FilterFn>;
        };
        promptFlow?: {
            filters?: Record<string, FilterFn>;
        };
    }
}

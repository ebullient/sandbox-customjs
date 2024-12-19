// Note: Partial JS-Engine API

export interface EngineAPI {
    markdown: MarkdownAPI;
}

export interface MarkdownAPI {
    createBuilder(): MarkdownBuilder;
    create(markdown: string): string;
}

export interface MarkdownBuilder {
    createTable(arg0: string[], arg1: string[][]): unknown;
    createHeading(arg0: number, arg1: string): unknown;
}

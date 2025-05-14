// Type definitions for JS Engine Plugin's Markdown API

export interface MarkdownAPI {
    create(markdownString: string): string;
    createBuilder(): MarkdownBuilder;
}

export interface MarkdownBuilder {
    createHeading(arg0: number, arg1: string): unknown;
    createParagraph(arg0: string): unknown;
    addText(text: string): MarkdownBuilder;
}

// Engine API interface that includes Markdown API
export interface EngineAPI {
    markdown: MarkdownAPI;
    // ... other Engine API properties
}

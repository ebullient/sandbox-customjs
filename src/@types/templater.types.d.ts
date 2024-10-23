import { TFile } from "obsidian";

export type ItemToString<T> = (item: T) => string;

// Note: Partial Templater API

export interface Templater {
    file: TemplaterFile;
    system: TemplaterSystem;
}

export interface TemplaterFile {
    /**
     * The string contents of the file at the time that Templater was executed.
     * Manipulating this string will not update the current file.
     */
    content: string;

    /**
     *
     * @param filename: The filename we want to search and resolve as a TFile.
     */
    find_tfile(filename: string): TFile | null;

    /**
     * @param absolute If set to true, returns the vault-absolute path of the folder.
     *      If false, only returns the basename of the folder (the last part). Defaults to false.
     * @returns The folder path.
     */
    folder(absolute?: boolean): string;

    /**
     * @param relative If true, return the relative path to the vault root.
     * @returns The path to the file.
     */
    path(relative?: boolean): string;

    /**
     * Retrieves the file's title (name without the extension).
     */
    title: string;
}

export interface TemplaterSystem {
    /**
     * Spawns a prompt modal and returns the user's input.
     * @param prompt_text Text to display in the prompt.
     * @param default_value A default value to pre-fill the prompt with.
     * @param throw_on_cancel If true, throw an error if the prompt is canceled, instead of returning a null value.
     *      Defaults to false.
     * @param multiline If set to true, the input field will be a multiline textarea.
     *      Defaults to false.
     */
    prompt(prompt_text?: string,
        default_value?: string,
        throw_on_cancel?: boolean,
        multiline?: boolean): Promise<string>;

    /**
     * Spawns a prompt modal with a suggester and returns the user's input.
     *
     * @param text_items Array of strings (or a function that maps an items in the Array to a string)
     *      representing the text that will be displayed for each item in the suggester prompt.
     * @param items Array of values to suggest (should be in the same order as text_items).
     * @param throw_on_cancel If true, throw an error if the prompt is canceled, instead of returning a null value.
     *     Defaults to false.
     * @param placeholder Placeholder string of the prompt.
     * @param limit Limit the number of items rendered at once (can improve performance for large lists).
     * @returns The selected item
     * @template T
     */
    suggester<T>(text_items: string[] | ItemToString<T>,
            items: T[],
            throw_on_cancel?: boolean,
            placeholder?: string,
            limit?: number): Promise<string>;
}
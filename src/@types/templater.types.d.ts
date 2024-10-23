import { TFile, TFolder } from "obsidian";

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
     * Creates a new file using a specified template or with a specified content.
     * @param {TFile | string} template: Either the template used for the new file content, or the file content as a string.
     *  If it is the template to use, you retrieve it with tp.file.find_tfile(TEMPLATENAME).
     * @param {string} filename: The filename of the new file, defaults to "Untitled".
     * @param {boolean} open_new: Whether to open or not the newly created file. Warning: if you use this option, since commands are executed asynchronously, the file can be opened first and then other commands are appended to that new file and not the previous file.
     * @param {TFolder | string} folder: The folder to put the new file in, defaults to Obsidian's default location. If you want the file to appear in a different folder, specify it with "PATH/TO/FOLDERNAME" or app.vault.getAbstractFileByPath("PATH/TO/FOLDERNAME").
     */
    create_new(template: TFile | string, filename: string, open_new?: boolean, folder?: TFolder | string): Promise<void>;

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
     * Moves the file to the desired vault location.
     * @param {string} new_path: The new vault relative path of the file, without the file extension.
     *  Note: the new path needs to include the folder and the filename, e.g. "/Notes/MyNote".
     * @param {TFile} file_to_move: The file to move, defaults to the current file.
     */
    move(new_path: string, file_to_move?: TFile): Promise<void>;

    /**
     * @param relative If true, return the relative path to the vault root.
     * @returns The path to the file.
     */
    path(relative?: boolean): string;

    /**
     * Renames the file (keeps the same file extension).
     * @param {string} new_title The new file title.
     */
    rename(new_title: string): Promise<void>;

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

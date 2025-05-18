import type { Reference } from "obsidian";
import type { CampaignEntity, CleanLink } from "./@types";

/** Convert iff status into an emoji */
export const iffStatusIcon = (iff: string): string => {
    // ["family", "pet"], "friend", "ally", "enemy",
    // "positive", "neutral", "negative", "unknown"
    switch (iff) {
        case "family":
            return "💖";
        case "pet":
            return "💖";
        case "taproom":
            return "🍺";
        case "friend":
            return "🩵";
        case "ally":
            return "💚";
        case "enemy":
            return "🔥";
        case "positive":
            return "👍";
        case "negative":
            return "👎";
        case "neutral":
            return "🤝";
        default:
            return "⬜️";
    }
};

export const npcToIffGroup = (iff: string): string => {
    switch (iff) {
        case "family":
            return "family";
        case "pet":
            return "family";
        case "friend":
            return "allies";
        case "taproom":
            return "allies";
        case "ally":
            return "allies";
        case "enemy":
            return "enemies";
        default:
            return "other";
    }
};

/** Convert status into an emoji */
export const statusIcon = (alive: string): string => {
    switch (alive) {
        case "alive":
            return "🌱";
        case "dead":
            return "💀";
        case "undead":
            return "🧟‍♀️";
        case "ghost":
            return "👻";
        default:
            return "⬜️";
    }
};

/** Convert entity type to an emoji */
export const typeIcon = (type: string): string => {
    switch (type) {
        case "area":
            return "🗺️";
        case "encounter":
            return "🎢";
        case "group":
            return "👥";
        case "item":
            return "🧸";
        case "place":
            return "🎠";
        case "npc":
            return "👤";
        case "pc":
            return "😇";
        default:
            return "⬜️";
    }
};

export const entityToLink = (
    entity: CampaignEntity,
    strong = false,
): string => {
    const strongText = strong ? `<strong>${entity.name}</strong>` : entity.name;
    return `<a class="internal-link" data-href="${entity.id}" href="${entity.id}" target="_blank" rel="noopener nofollow">${strongText}</a>`;
};

/**
 * Cleans a link target by removing the title and extracting the anchor.
 * @param {LinkCache} linkRef The link reference to clean.
 * @returns {CleanLink} The cleaned link object.
 */
export const cleanLinkTarget = (linkRef: Reference): CleanLink => {
    let path = linkRef.link;

    // remove/drop title: vaultPath#anchor "title" -> vaultPath#anchor
    const titlePos = path.indexOf(' "');
    if (titlePos >= 0) {
        path = path.substring(0, titlePos);
    }

    // the entityRef will still contain %20 and the anchor.
    // see markdownLinkPath
    const mdLink = path.replace(/ /g, "%20").trim();

    // extract anchor and decode spaces: vaultPath#anchor -> anchor and vaultPath
    const anchorPos = path.indexOf("#");
    const anchor =
        anchorPos < 0
            ? ""
            : path
                  .substring(anchorPos + 1)
                  .replace(/%20/g, " ")
                  .trim();

    path = (anchorPos < 0 ? path : path.substring(0, anchorPos))
        .replace(/%20/g, " ")
        .trim();

    return {
        mdLink,
        text: linkRef.displayText,
        anchor,
        path,
    };
};

/**
 * Converts a name to lower kebab case.
 * @param {string} name The name to convert.
 * @returns {string} The name converted to lower kebab case.
 */
export const lowerKebab = (name: string): string => {
    return (name || "")
        .replace(/([a-z])([A-Z])/g, "$1-$2") // separate on camelCase
        .replace(/[\s_|]+/g, "-") // replace all spaces and low dash
        .replace(/[^0-9a-zA-Z_-]/g, "") // strip other things
        .toLowerCase(); // convert to lower case
};

/**
 * Converts a TFile to a markdown link path.
 * @param {TFile} tfile The TFile to convert.
 * @param {string} [anchor=""] The anchor to append to the path.
 * @returns {string} The markdown link path.
 */
export const markdownLinkPath = (filePath: string, anchor = ""): string => {
    const hashAnchor = anchor ? `#${anchor}` : "";
    return (filePath + hashAnchor).replace(/ /g, "%20");
};

export const scopeToRegex = (str: string): RegExp => {
    return new RegExp(`^${str}$`, "i");
};

export const segmentFilterRegex = (str: string): RegExp => {
    return new RegExp(`^${str}(\\/|$)`);
};

export const addToMappedArray = <T>(
    map: Map<string, T[]>,
    key: string,
    value: T,
): void => {
    const list = map.get(key) || [];
    map.set(key, list);

    list.push(value);
};

export const addToMappedMap = <K, V>(
    map: Map<string, Map<K, V>>,
    key: string,
    subKey: K,
    value: V,
): void => {
    const subMap = map.get(key) || new Map<K, V>();
    map.set(key, subMap);

    subMap.set(subKey, value);
};

export const addToMappedNestedArray = <K, T>(
    map: Map<string, Map<K, T[]>>,
    key: string,
    subKey: K,
    value: T,
): void => {
    const subMap = map.get(key) || new Map<K, T[]>();
    map.set(key, subMap);

    const nestedArray = subMap.get(subKey) || [];
    subMap.set(subKey, nestedArray);

    nestedArray.push(value);
};

export const addToMappedNestedMap = <K, X, Y>(
    map: Map<string, Map<K, Map<X, Y>>>,
    key: string,
    subKey: K,
    subKey2: X,
    value: Y,
): void => {
    const subMap = map.get(key) || new Map<K, Map<X, Y>>();
    map.set(key, subMap);

    const nestedMap = subMap.get(subKey) || new Map<X, Y>();
    subMap.set(subKey, nestedMap);

    nestedMap.set(subKey2, value);
};

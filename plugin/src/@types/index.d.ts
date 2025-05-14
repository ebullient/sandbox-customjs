import type { TFile } from "obsidian";

export enum EntityType {
    AREA = "area",
    ENCOUNTER = "encounter",
    GROUP = "group",
    ITEM = "item",
    PLACE = "place",
    NPC = "npc",
    PC = "pc",
    UNKNOWN = "unknown",
}

export enum EncounterStatus {
    NEW = "new",
    ACTIVE = "active",
    COMPLETE = "complete",
}

export enum GroupStatus {
    ACTIVE = "active",
    DEFUNCT = "defunct",
    UNKNOWN = "unknown",
}

export enum NPCStatus {
    ALIVE = "alive",
    DEAD = "dead",
    UNDEAD = "undead",
    UNKNOWN = "unknown",
}

export enum NPC_IFF {
    ALLY = "ally",
    ENEMY = "enemy",
    FAMILY = "family",
    FRIEND = "friend",
    TAPROOM = "taproom", // employee
    NEGATIVE = "negative",
    NEUTRAL = "neutral",
    PET = "pet",
    POSITIVE = "positive",
    UNKNOWN = "unknown",
}

export interface CleanLink {
    entityRef: string;
    link: string;
    text?: string;
    anchor?: string;
}

export interface CampaignEntity {
    // Core identification
    id: string; // Unique identifier (target path for linking)
    name: string; // Display name
    type: EntityType; // Entity type (npc, group, location, etc.)

    // File information
    file: TFile; // Reference to the original file
    anchor?: string; // Optional anchor for the entity

    // Common properties
    icon?: string; // Optional emoji icon for the entity
    idTag?: string; // ID tag for the entity
    scope?: string; // Optional scope (e.g., campaign name derived from path)
    subtype?: string; // Entity type (npc, group, location, etc.)
    tags: string[]; // Tags associated with the entity

    // Campaign-specific properties
    state?: {
        [key: string]: CampaignState;
    };
}

export interface CampaignState {
    notes?: string; // Optional notes for the entity
    icons?: string; // Optional icons for the entity (computed)
    lastSeen?: string; // Optional last seen session (computed)
}

type CampaignFrontMatter =
    | string
    | Array<string | Partial<CampaignEntity>>
    | Partial<CampaignEntity>;

export interface Area extends CampaignEntity {
    region?: string; // Optional region for the area
}

export interface Encounter extends CampaignEntity {
    status?: EncounterStatus; // Status (e.g., new, active, complete)
    level?: number; // Optional level for the encounter
}

export interface GroupState extends CampaignState {
    status?: GroupStatus; // Status (e.g., active, defunct, unknown)
    renown?: number; // Optional renown for the group
}

export interface Group extends CampaignEntity {
    state: {
        [key: string]: GroupState;
    };
}

export interface Item extends CampaignEntity {}

export interface Place extends CampaignEntity {
    area?: string; // Optional area for the place
}

export interface NPCState extends CampaignState {
    status?: NPCStatus; // Status (e.g., alive, dead, unknown)
    iff?: string; // is friend or foe
}

export interface NPC extends CampaignEntity {
    state: {
        [key: string]: NPCState;
    };
}

export interface PC extends CampaignEntity {}

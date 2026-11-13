import type { Lang } from "./i18n";

// Shared types for the redesigned social-to-mealie (jobs, drafts, settings).

export type JobStatus =
    | "queued"
    | "downloading"
    | "transcribing"
    | "writing"
    | "draft"
    | "saving"
    | "saved"
    | "failed"
    | "duplicate"
    | "discarded";

export const ACTIVE_STATUSES: JobStatus[] = ["downloading", "transcribing", "writing", "saving"];

export interface Ingredient {
    quantity: number | null;
    unit: string | null;
    food: string;
    note: string | null;
    /** Set when the food / unit exists in Mealie (filled by the server). */
    foodId?: string | null;
    unitId?: string | null;
}

export interface RecipeNote {
    title: string;
    text: string;
}

export interface RecipeStep {
    text: string;
    /** timer for this step (simmer, bake, rest …) */
    minutes: number | null;
    /** indices into DraftRecipe.ingredients used in this step */
    ingredients: number[];
}

export interface DraftRecipe {
    name: string;
    description: string;
    servings: number | null;
    totalTime: string | null;
    prepTime: string | null;
    ingredients: Ingredient[];
    instructions: RecipeStep[];
    notes: RecipeNote[];
    tags: string[];
    category: string | null;
}

export interface JobTimings {
    download?: number;
    transcribe?: number;
    write?: number;
    save?: number;
}

export interface Job {
    id: string;
    url: string;
    status: JobStatus;
    /** "ui" (this app), "shortcut" (iOS Kurzbefehl / API), "share" (Android share target) */
    source: string;
    direct: boolean;
    createdAt: string;
    updatedAt: string;
    platform?: string;
    title?: string;
    description?: string;
    transcript?: string;
    /** number of stored images (thumbnail first), served by /api/jobs/:id/image/:n */
    imageCount: number;
    recipe?: DraftRecipe;
    error?: string;
    duplicateOf?: { name: string; slug: string; date?: string; url: string };
    mealieSlug?: string;
    mealieUrl?: string;
    /** Mealie recipe id (for the meal plan) */
    mealieId?: string;
    /** last meal plan entry made from here */
    mealplan?: { date: string; entryType: string };
    model?: string;
    hint?: string;
    /** internal flags for the next run */
    mode?: "full" | "rewrite";
    force?: boolean;
    timings: JobTimings;
    stageStartedAt?: string;
}

export interface Settings {
    /** recipe language; also used for notifications and server messages */
    language: Lang;
    rules: {
        translate: boolean;
        metric: boolean;
        spoons: boolean;
        oven: boolean;
        existingTags: boolean;
    };
    freeText: string;
    model: "auto" | "fast" | "smart";
}

export const DEFAULT_SETTINGS: Settings = {
    language: "en",
    rules: { translate: true, metric: true, spoons: true, oven: true, existingTags: true },
    freeText: "",
    model: "auto",
};

export type StmEvent =
    | { type: "snapshot"; jobs: Job[] }
    | { type: "job"; job: Job }
    | { type: "remove"; id: string }
    | { type: "partial"; id: string; recipe: Partial<DraftRecipe> };
